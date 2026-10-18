/**
 * main.ts — Entry point for the Google Maps Scraper (Standalone Crawlee + Playwright).
 *
 * Configures the PlaywrightCrawler with stealth fingerprints, resource blocking,
 * and launches the crawl pipeline:
 *   1. Search queries → SEARCH handler (scrolls results, enqueues place URLs)
 *   2. Place URLs → PLACE handler (extracts full business details)
 *   3. Business websites → WEBSITE handler (extracts emails, social links, contact page)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PlaywrightCrawler, ProxyConfiguration, Dataset, KeyValueStore, log } from 'crawlee';
import { InputSchema, Label, type SearchUserData, type WebsiteUserData } from './types.js';
import { buildSearchUrl } from './utils.js';
import { setConfig } from './config.js';
import { router } from './routes.js';

// ─── Input Loading ───────────────────────────────────────────────────────────

async function loadInput(): Promise<Record<string, unknown>> {
    // 1. Try reading input.json from root directory
    const rootInputPath = path.resolve(process.cwd(), 'input.json');
    try {
        const raw = await fs.readFile(rootInputPath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        // Not in root, check KeyValueStore
    }

    // 2. Try Crawlee KeyValueStore
    try {
        const kvsInput = await KeyValueStore.getInput<Record<string, unknown>>();
        if (kvsInput && Object.keys(kvsInput).length > 0) {
            return kvsInput;
        }
    } catch {
        // Fall back to default
    }

    return {};
}

const rawInput = await loadInput();
const parseResult = InputSchema.safeParse(rawInput);

if (!parseResult.success) {
    log.error('Invalid input configuration:', {
        errors: parseResult.error.flatten(),
    });
    process.exit(1);
}

const input = parseResult.data;
setConfig(input);

log.info('🗺️  Google Maps Scraper starting (Local Standalone)...', {
    searchQueries: input.searchQueries,
    startUrls: input.startUrls.length,
    maxPlacesPerQuery: input.maxPlacesPerQuery,
    maxReviews: input.maxReviews,
    maxImages: input.maxImages,
    language: input.language,
    deeperCrawl: input.deeperCrawl,
    includeWebResults: input.includeWebResults,
    maxConcurrency: input.maxConcurrency,
});

// ─── Proxy Configuration ─────────────────────────────────────────────────────

let proxyConfiguration: ProxyConfiguration | undefined;

if (input.proxyUrls && input.proxyUrls.length > 0) {
    proxyConfiguration = new ProxyConfiguration({
        proxyUrls: input.proxyUrls,
    });
}

// ─── Crawler Setup ───────────────────────────────────────────────────────────

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,

    // ─── Performance tuning ──────────────────────────────────────────────
    maxConcurrency: input.maxConcurrency,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 180,
    navigationTimeoutSecs: 60,

    // ─── Browser configuration ───────────────────────────────────────────
    headless: true,
    browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
            fingerprintGeneratorOptions: {
                browsers: ['chrome'],
                operatingSystems: ['windows', 'macos', 'linux'],
                locales: [input.language],
            },
        },
    },

    launchContext: {
        launchOptions: {
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
            ],
        },
    },

    // ─── Resource blocking — reduces memory & accelerates page load ────────
    preNavigationHooks: [
        async ({ page }, goToOptions) => {
            // Block heavy static resources not needed for data extraction
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                const url = route.request().url();

                if (['image', 'media', 'font'].includes(resourceType)) {
                    return route.abort();
                }

                // Block tracking and analytics domains
                const blockedDomains = [
                    'google-analytics.com',
                    'googletagmanager.com',
                    'doubleclick.net',
                    'facebook.net',
                    'hotjar.com',
                    'analytics',
                ];

                if (blockedDomains.some((domain) => url.includes(domain))) {
                    return route.abort();
                }

                return route.continue();
            });

            // Standard desktop viewport
            await page.setViewportSize({ width: 1920, height: 1080 });

            // Remove navigator.webdriver stealth indicator
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });
        },
    ],

    // ─── Error handling ──────────────────────────────────────────────────
    failedRequestHandler: async ({ request, log }, error) => {
        log.error(`❌ Request failed: ${request.url}`, {
            error: String(error),
            retryCount: request.retryCount,
        });

        // If a website request fails, ensure we still save the original place data
        if (request.label === Label.WEBSITE && request.userData) {
            const userData = request.userData as unknown as WebsiteUserData;
            if (userData?.placeData) {
                await Dataset.pushData(userData.placeData);
                log.info(`⚠️ Saved place without website data: ${userData.placeData.title}`);
            }
        }
    },
});

// ─── Build Initial Request Queue ─────────────────────────────────────────────

const initialRequests: { url: string; label?: string; userData?: Record<string, unknown> }[] = [];

// Add search queries as SEARCH requests
for (const query of input.searchQueries) {
    const searchUrl = buildSearchUrl(query, input.language);
    initialRequests.push({
        url: searchUrl,
        label: Label.SEARCH,
        userData: {
            searchQuery: query,
            placesScraped: 0,
            maxPlaces: input.maxPlacesPerQuery,
        } satisfies SearchUserData,
    });
}

// Add direct start URLs
for (const { url } of input.startUrls) {
    if (url.includes('/maps/place/') || url.includes('place_id')) {
        initialRequests.push({
            url,
            label: Label.PLACE,
            userData: {
                searchQuery: null,
                orderIndex: null,
            },
        });
    } else if (url.includes('/maps/search/') || url.includes('maps?q=')) {
        const queryMatch = url.match(/search\/([^/]+)/);
        initialRequests.push({
            url,
            label: Label.SEARCH,
            userData: {
                searchQuery: queryMatch ? decodeURIComponent(queryMatch[1]) : 'custom search',
                placesScraped: 0,
                maxPlaces: input.maxPlacesPerQuery,
            },
        });
    } else {
        initialRequests.push({
            url,
            label: Label.PLACE,
            userData: {
                searchQuery: null,
                orderIndex: null,
            },
        });
    }
}

if (initialRequests.length === 0) {
    log.error('No search queries or start URLs provided. Check your input.json file.');
    process.exit(1);
}

log.info(`🚀 Starting crawl with ${initialRequests.length} initial requests...`);

// ─── Run ─────────────────────────────────────────────────────────────────────

await crawler.run(initialRequests);

// ─── Finish ──────────────────────────────────────────────────────────────────

const { requestsFinished, requestsFailed } = crawler.stats.state;

log.info(`🏁 Crawl finished! Run "npm run export" to generate results.csv and results.json.`, {
    requestsFinished,
    requestsFailed,
});
