import { z } from 'zod';

// ─── Input Schema (validated at runtime with Zod) ────────────────────────────

export const InputSchema = z.object({
    searchQueries: z.array(z.string()).optional().default([]),
    startUrls: z.array(z.object({ url: z.string().url() })).optional().default([]),
    maxPlacesPerQuery: z.number().int().min(1).max(500).optional().default(20),
    maxReviews: z.number().int().min(0).max(500).optional().default(5),
    maxImages: z.number().int().min(0).max(100).optional().default(0),
    language: z.string().optional().default('en'),
    deeperCrawl: z.boolean().optional().default(true),
    includeWebResults: z.boolean().optional().default(true),
    maxConcurrency: z.number().int().min(1).max(50).optional().default(5),
    proxyUrls: z.array(z.string()).optional(),
});

export type Input = z.infer<typeof InputSchema>;

// ─── Output / Place Data Types ───────────────────────────────────────────────

export interface PlaceReview {
    author: string;
    authorUrl: string | null;
    profilePhotoUrl: string | null;
    rating: number | null;
    relativeTimeDescription: string;
    text: string;
    publishedAtDate: string | null;
    responseFromOwnerText: string | null;
}

export interface PlaceImage {
    imageUrl: string;
    caption: string | null;
}

export interface OpeningHours {
    day: string;
    hours: string;
}

export interface PlaceData {
    // Basic info
    title: string;
    subTitle: string | null;
    category: string | null;
    categories: string[];
    placeId: string | null;

    // Location
    address: string | null;
    neighborhood: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    countryCode: string | null;
    latitude: number | null;
    longitude: number | null;
    plusCode: string | null;

    // Contact
    phone: string | null;
    website: string | null;
    email: string | null;
    socialProfiles: Record<string, string>;

    // Ratings & metrics
    totalScore: number | null;
    reviewsCount: number | null;
    reviewsDistribution: Record<string, number> | null;
    priceLevel: string | null;

    // Operating details
    openingHours: OpeningHours[] | null;
    temporarilyClosed: boolean;
    permanentlyClosed: boolean;

    // Media
    imageUrls: string[];
    images: PlaceImage[];

    // Reviews
    reviews: PlaceReview[];

    // Additional attributes
    additionalInfo: Record<string, string | boolean>[];

    // Meta
    url: string;
    searchQuery: string | null;
    scrapedAt: string;
    orderIndex: number | null;
}

// ─── Labels for Request Routing ──────────────────────────────────────────────

export enum Label {
    SEARCH = 'SEARCH',
    PLACE = 'PLACE',
    WEBSITE = 'WEBSITE',
}

// ─── User Data attached to each Request ──────────────────────────────────────

export interface SearchUserData {
    searchQuery: string;
    placesScraped: number;
    maxPlaces: number;
}

export interface PlaceUserData {
    searchQuery: string | null;
    orderIndex: number | null;
}

export interface WebsiteUserData {
    placeData: Partial<PlaceData>;
}
