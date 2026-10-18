/**
 * routes.ts — Request handler routes for the PlaywrightCrawler.
 *
 * Three route labels:
 *   SEARCH  — Google Maps search result pages (infinite-scroll list)
 *   PLACE   — Individual place/business detail pages
 *   WEBSITE — Business website (for email/social extraction)
 */

import { createPlaywrightRouter, Dataset } from 'crawlee';
import { Label, type SearchUserData, type PlaceUserData, type WebsiteUserData } from './types.js';
import { extractSearchResults, extractPlaceData } from './extractors.js';
import { extractEmails, extractSocialProfiles, randomDelay } from './utils.js';
import { getConfig } from './config.js';

export const router = createPlaywrightRouter();

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — Scroll through search results and enqueue individual place URLs
// ─────────────────────────────────────────────────────────────────────────────

router.addHandler(Label.SEARCH, async ({ page, request, log, crawler }) => {
    const userData = request.userData as unknown as SearchUserData;
    const config = getConfig();

    log.info(`🔍 Searching: "${userData.searchQuery}" (max ${userData.maxPlaces} places)`);

    // Dismiss consent dialogs / cookie banners
    await dismissConsentBanner(page);

    // Wait for the page to stabilize
    await randomDelay(1500, 3000);

    // Extract place URLs by scrolling the search results panel
    const placeUrls = await extractSearchResults(page, userData.maxPlaces, log);

    if (placeUrls.length === 0) {
        log.warning(`No places found for query: "${userData.searchQuery}"`);
        return;
    }

    log.info(`📌 Found ${placeUrls.length} places for "${userData.searchQuery}". Enqueueing...`);

    // Enqueue each place URL with PLACE label
    for (let i = 0; i < placeUrls.length; i++) {
        await crawler.addRequests([
            {
                url: placeUrls[i],
                label: Label.PLACE,
                userData: {
                    searchQuery: userData.searchQuery,
                    orderIndex: i + 1,
                } satisfies PlaceUserData,
            },
        ]);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLACE — Extract all data from an individual place page
// ─────────────────────────────────────────────────────────────────────────────

router.addHandler(Label.PLACE, async ({ page, request, log, crawler }) => {
    const userData = request.userData as unknown as PlaceUserData;
    const config = getConfig();

    log.info(`📍 Extracting place: ${request.url}`);

    // Dismiss consent dialogs
    await dismissConsentBanner(page);

    // Wait for the page to load
    await randomDelay(1000, 2000);

    // Extract all place data
    const placeData = await extractPlaceData(
        page,
        request.url,
        userData.searchQuery,
        userData.orderIndex,
        config.maxReviews,
        config.maxImages,
        log,
    );

    // Optionally enqueue the business website for email/social extraction
    if (config.includeWebResults && placeData.website) {
        await crawler.addRequests([
            {
                url: placeData.website,
                label: Label.WEBSITE,
                userData: {
                    placeData,
                } satisfies WebsiteUserData,
            },
        ]);
        // Don't push data yet — the WEBSITE handler will do it with enriched data
        return;
    }

    // Push the place data to the dataset
    await Dataset.pushData(placeData);
    log.info(`✅ Saved: ${placeData.title} (${placeData.address ?? 'no address'})`);
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBSITE — Visit business website to extract emails and social profiles
// ─────────────────────────────────────────────────────────────────────────────

router.addHandler(Label.WEBSITE, async ({ page, request, log }) => {
    const userData = request.userData as unknown as WebsiteUserData;
    const placeData = { ...userData.placeData };

    log.info(`🌐 Scraping business website for emails: ${request.url}`);

    try {
        // Wait for page to load basic DOM
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
        await randomDelay(800, 1500);

        // Get homepage HTML and body text
        const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
        const pageHtml = await page.content();

        // 1. Extract emails from homepage
        const foundEmails = extractEmails(bodyText + ' ' + pageHtml);

        // 2. Extract social profiles
        const profiles = extractSocialProfiles(pageHtml);
        placeData.socialProfiles = { ...placeData.socialProfiles, ...profiles };

        // 3. If no email found on homepage, search for a Contact page link
        if (foundEmails.length === 0) {
            const contactUrl = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                for (const a of anchors) {
                    const href = (a.getAttribute('href') || '').toLowerCase();
                    const text = (a.textContent || '').trim().toLowerCase();

                    const isContactHref = /contact|reach|about|touch|help/i.test(href);
                    const isContactText = /^(contact|contact us|get in touch|about us|reach us)$/i.test(text);

                    if (isContactHref || isContactText) {
                        const absHref = (a as HTMLAnchorElement).href;
                        // Avoid mailto, tel, or javascript pseudo-links
                        if (absHref.startsWith('http')) {
                            return absHref;
                        }
                    }
                }
                return null;
            });

            if (contactUrl && contactUrl !== request.url) {
                try {
                    log.info(`🔎 Checking contact page: ${contactUrl}`);
                    await page.goto(contactUrl, { timeout: 12_000, waitUntil: 'domcontentloaded' });
                    await randomDelay(800, 1200);

                    const contactHtml = await page.content();
                    const contactBody = await page.evaluate(() => document.body?.innerText ?? '');
                    const contactEmails = extractEmails(contactBody + ' ' + contactHtml);

                    if (contactEmails.length > 0) {
                        foundEmails.push(...contactEmails);
                    }

                    const contactProfiles = extractSocialProfiles(contactHtml);
                    placeData.socialProfiles = { ...placeData.socialProfiles, ...contactProfiles };
                } catch {
                    // Contact sub-page navigation is best-effort
                }
            }
        }

        // Deduplicate collected emails
        const uniqueEmails = [...new Set(foundEmails)];
        if (uniqueEmails.length > 0) {
            placeData.email = uniqueEmails[0];
            log.info(`📧 Found email: ${placeData.email} for ${placeData.title}`);
        } else {
            log.info(`ℹ️ No email found on website for: ${placeData.title}`);
        }

        if (Object.keys(placeData.socialProfiles).length > 0) {
            log.info(`📱 Found ${Object.keys(placeData.socialProfiles).length} social profiles for ${placeData.title}`);
        }
    } catch (error) {
        log.warning(`Could not fully scrape website ${request.url}: ${error}`);
    }

    // Push enriched data
    await Dataset.pushData(placeData);
    log.info(`✅ Saved (enriched): ${placeData.title}`);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Dismiss Google consent/cookie banners that block interaction.
 */
async function dismissConsentBanner(page: import('playwright').Page): Promise<void> {
    const consentSelectors = [
        'button[aria-label="Accept all"]',
        'button[aria-label="Reject all"]',
        'form[action*="consent"] button',
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
    ];

    for (const selector of consentSelectors) {
        try {
            const btn = await page.$(selector);
            if (btn && await btn.isVisible()) {
                await btn.click();
                await randomDelay(500, 1000);
                break;
            }
        } catch {
            // Ignore — banner may not exist
        }
    }
}
