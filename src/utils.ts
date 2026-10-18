import type { Log } from 'crawlee';

/**
 * Build a Google Maps search URL from a query string.
 */
export function buildSearchUrl(query: string, language: string): string {
    const encoded = encodeURIComponent(query);
    return `https://www.google.com/maps/search/${encoded}/?hl=${language}`;
}

/**
 * Extract a clean URL from Google's redirect wrapper.
 * Google Maps wraps outbound links like: https://www.google.com/url?q=https://example.com&...
 */
export function unwrapGoogleUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname === 'www.google.com' && parsed.pathname === '/url') {
            return parsed.searchParams.get('q') ?? url;
        }
        return url;
    } catch {
        return url;
    }
}

/**
 * Extract place ID from a Google Maps URL.
 * Typical URL: https://www.google.com/maps/place/.../data=!...!1s0x...:0x...!...
 */
export function extractPlaceId(url: string): string | null {
    // Try to extract from ChIJ format in the URL
    const chiJMatch = url.match(/ChIJ[\w-]+/);
    if (chiJMatch) return chiJMatch[0];

    // Try the data parameter format
    const dataMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/);
    if (dataMatch) return dataMatch[1];

    // Try place_id: prefix
    const placeIdMatch = url.match(/place_id[=:]([A-Za-z0-9_-]+)/);
    if (placeIdMatch) return placeIdMatch[1];

    return null;
}

/**
 * Extract coordinates from a Google Maps URL.
 * URL patterns: /@40.7484,-73.9857,17z or /place/.../@40.7484,-73.9857,...
 */
export function extractCoordinates(url: string): { lat: number; lng: number } | null {
    const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
}

/**
 * Parse a rating string like "4.5" into a number, or null.
 */
export function parseRating(text: string | null | undefined): number | null {
    if (!text) return null;
    // Some locales use comma as decimal separator
    const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
}

/**
 * Parse a review count string like "(1,234 reviews)" or "1.234 reseñas" into a number.
 */
export function parseReviewCount(text: string | null | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9]/g, '');
    const val = parseInt(cleaned, 10);
    return isNaN(val) ? null : val;
}

/**
 * Wait for a random duration between min and max milliseconds.
 * Helps avoid detection by introducing human-like delays.
 */
export function randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Extract email addresses from text and HTML content.
 * Checks mailto: links, standard regex, and filters out assets/tracking.
 */
export function extractEmails(text: string): string[] {
    const emails: string[] = [];

    // 1. Extract from mailto: links (e.g., href="mailto:info@business.com?subject=...")
    const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    let mailtoMatch: RegExpExecArray | null;
    while ((mailtoMatch = mailtoRegex.exec(text)) !== null) {
        if (mailtoMatch[1]) {
            emails.push(mailtoMatch[1]);
        }
    }

    // 2. Standard email pattern matching
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const standardMatches = text.match(emailRegex) ?? [];
    emails.push(...standardMatches);

    // Filter out common false positives and assets
    const invalidExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
        '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
    ];
    const invalidDomains = [
        'example.com', 'sentry.io', 'wixpress.com', 'domain.com',
        'email.com', 'yourdomain.com', 'bootstrap.com', 'schema.org',
        'googleapis.com', 'google.com', 'gstatic.com',
    ];

    return [...new Set(emails.map((e) => e.toLowerCase()))].filter((email) => {
        if (email.length < 5 || email.length > 80) return false;
        if (invalidExtensions.some((ext) => email.endsWith(ext))) return false;
        if (invalidDomains.some((d) => email.includes(d))) return false;
        return true;
    });
}

/**
 * Extract social media profile URLs from page content.
 */
export function extractSocialProfiles(text: string): Record<string, string> {
    const profiles: Record<string, string> = {};

    const patterns: [string, RegExp][] = [
        ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/g],
        ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/g],
        ['twitter', /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+/g],
        ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/g],
        ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[a-zA-Z0-9._-]+/g],
        ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/g],
        ['whatsapp', /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)[0-9]+/g],
    ];

    for (const [name, regex] of patterns) {
        const match = text.match(regex);
        if (match && match[0]) {
            profiles[name] = match[0];
        }
    }

    return profiles;
}

/**
 * Safe text extraction — returns trimmed text or null.
 */
export function safeText(text: string | null | undefined): string | null {
    if (!text) return null;
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Retry wrapper for flaky page operations.
 */
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    log?: Log,
): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) {
                log?.warning(`Operation failed after ${maxRetries} attempts`, {
                    error: String(error),
                });
                return null;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
    }
    return null;
}
