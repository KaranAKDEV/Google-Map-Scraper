/**
 * extractors.ts — Page-level data extraction functions.
 *
 * These functions operate on a Playwright `Page` object and extract structured
 * data from Google Maps place pages and search result listings.
 */

import type { Page } from 'playwright';
import type { Log } from 'crawlee';
import type { PlaceData, PlaceReview, PlaceImage, OpeningHours } from './types.js';
import {
    unwrapGoogleUrl,
    extractPlaceId,
    extractCoordinates,
    parseRating,
    parseReviewCount,
    safeText,
    randomDelay,
    retryOperation,
    extractEmails,
} from './utils.js';

// ─── Selectors ───────────────────────────────────────────────────────────────

const SELECTORS = {
    // Search results
    searchFeed: 'div[role="feed"]',
    searchResult: 'div[role="feed"] a[href*="/maps/place/"], a.hfpxzc',
    endOfList: '.HlvSq',  // "You've reached the end of the list"

    // Place page
    placeTitle: 'h1',
    placeCategory: 'button[jsaction*="category"]',
    placeRating: 'div.F7nice span[aria-hidden="true"]',
    placeReviewCount: 'div.F7nice span[aria-label]',
    placeAddress: 'button[data-item-id="address"] div.fontBodyMedium',
    placePhone: 'button[data-item-id*="phone"] div.fontBodyMedium',
    placeWebsite: 'a[data-item-id="authority"]',
    placePriceLevel: 'span[aria-label*="Price"]',
    placeHoursButton: 'button[data-item-id*="oh"]',
    placeHoursTable: 'table.eK4R0e',
    placeHoursRow: 'table.eK4R0e tr',
    placeClosed: '[data-temporary-closed], .permanentlyClosed',
    placeSubtitle: 'div.fontBodyMedium span:first-child',
    placePlusCode: 'button[data-item-id="oloc"] div.fontBodyMedium',

    // Reviews
    reviewsButton: 'button[jsaction*="review"]',
    allReviewsButton: 'button.hqzQac span',
    reviewContainer: 'div[data-review-id]',
    reviewAuthor: 'div.d4r55',
    reviewAuthorLink: 'a.WNxzHc',
    reviewRating: 'span.kvMYJc',
    reviewText: 'span.wiI7pd',
    reviewTime: 'span.rsqaWe',
    reviewMoreButton: 'button.w8nwRe',
    reviewOwnerResponse: 'div.CDe7pd',
    reviewProfilePhoto: 'img.NBa7we',

    // Images
    imageTab: 'button[data-tab-index="2"]',
    imageContainer: 'div.U39Pmb',
    imageElement: 'img.Uf0tqf',

    // Additional info
    aboutTab: 'button[aria-label*="About"]',
    infoItem: 'div.iP2t7d',
} as const;

// ─── Search Results Extraction ───────────────────────────────────────────────

/**
 * Scroll the search results panel and collect place URLs.
 */
export async function extractSearchResults(
    page: Page,
    maxPlaces: number,
    log: Log,
): Promise<string[]> {
    const placeUrls: string[] = [];

    // Wait for the feed to appear
    try {
        await page.waitForSelector(SELECTORS.searchFeed, { timeout: 15_000 });
    } catch {
        log.warning('Could not find search results feed — the page may not have loaded correctly.');
        return placeUrls;
    }

    let scrollAttempts = 0;
    const maxScrollAttempts = 100;
    let lastCount = 0;
    let staleRounds = 0;

    while (placeUrls.length < maxPlaces && scrollAttempts < maxScrollAttempts) {
        // Collect visible result links
        const links = await page.$$eval(SELECTORS.searchResult, (anchors) =>
            anchors.map((a) => (a as HTMLAnchorElement).href),
        );

        for (const link of links) {
            if (!placeUrls.includes(link) && placeUrls.length < maxPlaces) {
                placeUrls.push(link);
            }
        }

        log.info(`Found ${placeUrls.length}/${maxPlaces} place URLs so far...`);

        if (placeUrls.length >= maxPlaces) break;

        // Check for "end of list" indicator
        const endOfList = await page.$(SELECTORS.endOfList);
        if (endOfList) {
            const text = await endOfList.textContent();
            if (text && text.includes("You've reached the end")) {
                log.info('Reached end of search results list.');
                break;
            }
        }

        // Scroll the feed container down
        await page.evaluate((feedSelector) => {
            const feed = document.querySelector(feedSelector);
            if (feed) {
                feed.scrollTop = feed.scrollHeight;
            }
        }, SELECTORS.searchFeed);

        await randomDelay(800, 1500);
        scrollAttempts++;

        // Detect stale scroll — no new results after scrolling
        if (placeUrls.length === lastCount) {
            staleRounds++;
            if (staleRounds >= 5) {
                log.info('No new results after 5 scroll attempts. Stopping.');
                break;
            }
        } else {
            staleRounds = 0;
            lastCount = placeUrls.length;
        }
    }

    log.info(`Extracted ${placeUrls.length} place URLs from search results.`);
    return placeUrls;
}

// ─── Place Page Extraction ───────────────────────────────────────────────────

/**
 * Extract all available data from a Google Maps place page.
 */
export async function extractPlaceData(
    page: Page,
    url: string,
    searchQuery: string | null,
    orderIndex: number | null,
    maxReviews: number,
    maxImages: number,
    log: Log,
): Promise<PlaceData> {
    // Wait for the main title to confirm page is loaded
    await page.waitForSelector(SELECTORS.placeTitle, { timeout: 20_000 }).catch(() => {
        log.warning(`Place title not found at ${url}`);
    });

    await randomDelay(500, 1000);

    // ─── Basic Info ──────────────────────────────────────────────────────
    const title = safeText(await page.$eval(SELECTORS.placeTitle, (el) => el.textContent).catch(() => null)) ?? 'Unknown';

    const category = safeText(
        await page.$eval(SELECTORS.placeCategory, (el) => el.textContent).catch(() => null),
    );

    const categories = await page.$$eval(
        'button[jsaction*="category"]',
        (buttons) => buttons.map((b) => b.textContent?.trim() ?? ''),
    ).catch(() => []);

    const subTitle = safeText(
        await page.$eval(SELECTORS.placeSubtitle, (el) => el.textContent).catch(() => null),
    );

    // ─── Rating & Reviews Count ──────────────────────────────────────────
    const ratingText = await page.$eval(SELECTORS.placeRating, (el) => el.textContent).catch(() => null);
    const totalScore = parseRating(ratingText);

    const reviewCountText = await page.$eval(
        SELECTORS.placeReviewCount,
        (el) => el.getAttribute('aria-label'),
    ).catch(() => null);
    const reviewsCount = parseReviewCount(reviewCountText);

    // ─── Address ─────────────────────────────────────────────────────────
    const address = safeText(
        await page.$eval(SELECTORS.placeAddress, (el) => el.textContent).catch(() => null),
    );

    // ─── Phone ───────────────────────────────────────────────────────────
    const phone = safeText(
        await page.$eval(SELECTORS.placePhone, (el) => el.textContent).catch(() => null),
    );

    // ─── Website ─────────────────────────────────────────────────────────
    const rawWebsite = await page.$eval(
        SELECTORS.placeWebsite,
        (el) => (el as HTMLAnchorElement).href,
    ).catch(() => null);
    const website = unwrapGoogleUrl(rawWebsite);

    // ─── Price Level ─────────────────────────────────────────────────────
    const priceLevel = safeText(
        await page.$eval(SELECTORS.placePriceLevel, (el) => el.textContent).catch(() => null),
    );

    // ─── Plus Code ───────────────────────────────────────────────────────
    const plusCode = safeText(
        await page.$eval(SELECTORS.placePlusCode, (el) => el.textContent).catch(() => null),
    );

    // ─── Coordinates ─────────────────────────────────────────────────────
    const currentUrl = page.url();
    const coords = extractCoordinates(currentUrl);

    // ─── Place ID ────────────────────────────────────────────────────────
    const placeId = extractPlaceId(currentUrl);

    // ─── Closed Status ───────────────────────────────────────────────────
    const closedEl = await page.$(SELECTORS.placeClosed);
    const closedText = closedEl ? await closedEl.textContent() : null;
    const temporarilyClosed = closedText?.toLowerCase().includes('temporarily') ?? false;
    const permanentlyClosed = closedText?.toLowerCase().includes('permanently') ?? false;

    // ─── Opening Hours ───────────────────────────────────────────────────
    const openingHours = await extractOpeningHours(page, log);

    // ─── Reviews ─────────────────────────────────────────────────────────
    const reviews = maxReviews > 0 ? await extractReviews(page, maxReviews, log) : [];

    // ─── Images ──────────────────────────────────────────────────────────
    const images = maxImages > 0 ? await extractImages(page, maxImages, log) : [];
    const imageUrls = images.map((img) => img.imageUrl);

    // ─── Additional Info / Attributes ────────────────────────────────────
    const additionalInfo = await extractAdditionalInfo(page, log);

    // ─── Direct Email from Place Page (if listed) ───────────────────────
    const placePageHtml = await page.content().catch(() => '');
    const directEmails = extractEmails(placePageHtml);
    const directEmail = directEmails.length > 0 ? directEmails[0] : null;

    return {
        title,
        subTitle,
        category,
        categories: categories.filter(Boolean),
        placeId,
        address,
        neighborhood: null,
        street: null,
        city: null,
        state: null,
        postalCode: null,
        countryCode: null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        plusCode,
        phone,
        website,
        email: directEmail,
        socialProfiles: {},
        totalScore,
        reviewsCount,
        reviewsDistribution: null,
        priceLevel,
        openingHours,
        temporarilyClosed,
        permanentlyClosed,
        imageUrls,
        images,
        reviews,
        additionalInfo,
        url: currentUrl,
        searchQuery,
        scrapedAt: new Date().toISOString(),
        orderIndex,
    };
}

// ─── Opening Hours ───────────────────────────────────────────────────────────

async function extractOpeningHours(page: Page, log: Log): Promise<OpeningHours[] | null> {
    return retryOperation(
        async () => {
            // Click the hours button to expand the table
            const hoursButton = await page.$(SELECTORS.placeHoursButton);
            if (!hoursButton) return null;

            await hoursButton.click();
            await page.waitForSelector(SELECTORS.placeHoursTable, { timeout: 5_000 });

            const rows = await page.$$(SELECTORS.placeHoursRow);
            const hours: OpeningHours[] = [];

            for (const row of rows) {
                const cells = await row.$$('td');
                if (cells.length >= 2) {
                    const day = safeText(await cells[0].textContent());
                    const time = safeText(await cells[1].textContent());
                    if (day && time) {
                        hours.push({ day, hours: time });
                    }
                }
            }

            return hours.length > 0 ? hours : null;
        },
        2,
        1000,
        log,
    );
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

async function extractReviews(page: Page, maxReviews: number, log: Log): Promise<PlaceReview[]> {
    const reviews: PlaceReview[] = [];

    try {
        // Click the reviews tab/button to open the reviews panel
        const reviewsTab = await page.$('button[aria-label*="Reviews"], button[aria-label*="reviews"]');
        if (!reviewsTab) {
            log.debug('No reviews tab found.');
            return reviews;
        }
        await reviewsTab.click();
        await randomDelay(1000, 2000);

        // Wait for review containers to appear
        await page.waitForSelector(SELECTORS.reviewContainer, { timeout: 10_000 }).catch(() => null);

        // Scroll the reviews panel to load more
        let scrollAttempts = 0;
        while (reviews.length < maxReviews && scrollAttempts < 30) {
            // Expand "More" buttons on truncated reviews
            const moreButtons = await page.$$(SELECTORS.reviewMoreButton);
            for (const btn of moreButtons) {
                await btn.click().catch(() => { /* ignore */ });
            }

            // Extract review data from visible review containers
            const reviewElements = await page.$$(SELECTORS.reviewContainer);

            for (const reviewEl of reviewElements) {
                if (reviews.length >= maxReviews) break;

                const reviewId = await reviewEl.getAttribute('data-review-id');
                if (reviewId && reviews.some((r) => r.text === reviewId)) continue;

                const author = safeText(
                    await reviewEl.$eval(SELECTORS.reviewAuthor, (el) => el.textContent).catch(() => null),
                ) ?? 'Anonymous';

                const authorUrl = await reviewEl
                    .$eval(SELECTORS.reviewAuthorLink, (el) => (el as HTMLAnchorElement).href)
                    .catch(() => null);

                const profilePhotoUrl = await reviewEl
                    .$eval(SELECTORS.reviewProfilePhoto, (el) => (el as HTMLImageElement).src)
                    .catch(() => null);

                const ratingAttr = await reviewEl
                    .$eval(SELECTORS.reviewRating, (el) => el.getAttribute('aria-label'))
                    .catch(() => null);
                const rating = ratingAttr ? parseRating(ratingAttr) : null;

                const text = safeText(
                    await reviewEl.$eval(SELECTORS.reviewText, (el) => el.textContent).catch(() => null),
                ) ?? '';

                const relativeTime = safeText(
                    await reviewEl.$eval(SELECTORS.reviewTime, (el) => el.textContent).catch(() => null),
                ) ?? '';

                const ownerResponse = safeText(
                    await reviewEl.$eval(SELECTORS.reviewOwnerResponse, (el) => el.textContent).catch(() => null),
                );

                reviews.push({
                    author,
                    authorUrl,
                    profilePhotoUrl,
                    rating,
                    relativeTimeDescription: relativeTime,
                    text,
                    publishedAtDate: null,
                    responseFromOwnerText: ownerResponse,
                });
            }

            if (reviews.length >= maxReviews) break;

            // Scroll reviews panel
            await page.evaluate(() => {
                const scrollable = document.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf');
                if (scrollable) {
                    scrollable.scrollTop = scrollable.scrollHeight;
                }
            });

            await randomDelay(800, 1500);
            scrollAttempts++;
        }
    } catch (error) {
        log.warning(`Error extracting reviews: ${error}`);
    }

    log.info(`Extracted ${reviews.length} reviews.`);
    return reviews;
}

// ─── Images ──────────────────────────────────────────────────────────────────

async function extractImages(page: Page, maxImages: number, log: Log): Promise<PlaceImage[]> {
    const images: PlaceImage[] = [];

    try {
        // Click the photos tab
        const photosTab = await page.$('button[aria-label*="Photos"], button[aria-label*="photos"]');
        if (!photosTab) {
            log.debug('No photos tab found.');
            return images;
        }
        await photosTab.click();
        await randomDelay(1000, 2000);

        // Wait for images to load
        await page.waitForSelector('img', { timeout: 5_000 }).catch(() => null);

        const imgElements = await page.$$('button[jsaction] img[src*="googleusercontent"]');

        for (const img of imgElements) {
            if (images.length >= maxImages) break;
            const src = await img.getAttribute('src');
            if (src) {
                // Replace size parameters to get a higher resolution image
                const highResUrl = src.replace(/=w\d+-h\d+/, '=w800-h600');
                images.push({
                    imageUrl: highResUrl,
                    caption: await img.getAttribute('alt'),
                });
            }
        }
    } catch (error) {
        log.warning(`Error extracting images: ${error}`);
    }

    log.info(`Extracted ${images.length} images.`);
    return images;
}

// ─── Additional Info / Attributes ────────────────────────────────────────────

async function extractAdditionalInfo(
    page: Page,
    log: Log,
): Promise<Record<string, string | boolean>[]> {
    const info: Record<string, string | boolean>[] = [];

    try {
        // Try clicking the "About" tab if it exists
        const aboutTab = await page.$(SELECTORS.aboutTab);
        if (aboutTab) {
            await aboutTab.click();
            await randomDelay(500, 1000);
        }

        const infoItems = await page.$$(SELECTORS.infoItem);
        for (const item of infoItems) {
            const text = safeText(await item.textContent());
            if (text) {
                // Try to parse as key-value from aria-label
                const ariaLabel = await item.getAttribute('aria-label');
                if (ariaLabel) {
                    info.push({ attribute: ariaLabel, available: true });
                } else {
                    info.push({ attribute: text, available: true });
                }
            }
        }
    } catch (error) {
        log.debug(`Could not extract additional info: ${error}`);
    }

    return info;
}
