# 🗺️ Google Maps Scraper (Local & Standalone)

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Crawlee](https://img.shields.io/badge/Crawlee-v3-orange.svg)](https://crawlee.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-red.svg)](https://playwright.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

A production-grade, fast, and completely **free & standalone** Google Maps scraper. Runs 100% locally on your machine with **zero API keys, zero cloud accounts, and zero paid proxies required**.

Powered by **TypeScript**, **Crawlee**, and headless **Playwright** with built-in stealth fingerprinting and aggressive resource blocking.

---

## ✨ Features

- 🔍 **Search Keyword Scraping:** Query any term (e.g. `"gyms in Miami"`, `"hotels in vadapalani"`, `"plumbers near Chicago"`).
- 📍 **Direct Place URLs:** Provide exact Google Maps place links to extract specific businesses.
- 📧 **Website & Email Discovery:** Automatically navigates to business websites and discovers email addresses and contact page links (`mailto:`, `/contact`, `/about`).
- 📱 **Social Media Handles:** Automatically extracts Instagram, Facebook, LinkedIn, Twitter/X, and WhatsApp links.
- 📞 **Complete Contact Info:** Business name, full address, phone number, website, plus code, latitude, and longitude.
- ⭐ **Reviews & Ratings:** Overall rating, total review count, and full customer review text with author names and star ratings.
- 🕐 **Operating Hours:** Weekly schedule and opening times.
- ⚡ **Resource Blocking:** Intercepts and blocks images, fonts, media, and analytics trackers to run at 3x speed with minimal RAM consumption.
- 🛡️ **Anti-Detection:** Rotates realistic browser fingerprints, injects stealth scripts, and mimics human interaction.
- 📊 **One-Click Export:** Convert results directly to **Excel-ready CSV** or formatted **JSON** with `npm run export`.

---

## 📋 Scraped Data Fields

| Field | Description | Example |
|---|---|---|
| `title` | Business Name | `Grand Palace Hotel` |
| `category` | Primary Business Category | `Hotel` |
| `address` | Full Formatted Address | `123 Main St, Vadapalani, Chennai, 600026` |
| `phone` | Contact Phone Number | `+91 44 2480 1234` |
| `website` | Official Website URL | `https://grandpalace.com` |
| `email` | Scraped Contact Email | `info@grandpalace.com` |
| `socialProfiles` | Social Links & WhatsApp | Instagram, Facebook, LinkedIn, WhatsApp |
| `totalScore` | Average Star Rating | `4.6` |
| `reviewsCount` | Total Number of Reviews | `1,420` |
| `latitude` / `longitude` | Geographic Coordinates | `13.0521`, `80.2123` |
| `plusCode` | Google Plus Code | `362P+8Q Chennai, Tamil Nadu` |
| `openingHours` | Full Weekly Schedule | `[{"day": "Monday", "hours": "Open 24 hours"}]` |
| `reviews` | Customer Reviews | Text, rating, author, date, owner response |
| `url` | Google Maps URL | `https://www.google.com/maps/place/...` |

---

## 🚀 Quick Start

### 1. Prerequisites

Ensure you have [Node.js](https://nodejs.org/) version **20 or higher** installed.

```bash
node -v   # Should output v20.x or higher
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/google-maps-scraper.git
cd google-maps-scraper
```

### 3. Install Dependencies & Playwright Browser

```bash
# Install NPM packages
npm install

# Install Chromium browser binary for Playwright
npx playwright install chromium
```

### 4. Configure Your Search

Edit [`input.json`](./input.json) in the project root:

```json
{
  "searchQueries": [
    "hotels in vadapalani",
    "gyms in chennai"
  ],
  "maxPlacesPerQuery": 20,
  "maxReviews": 3,
  "language": "en",
  "deeperCrawl": true,
  "includeWebResults": true,
  "maxConcurrency": 3
}
```

### 5. Run the Scraper

```bash
# Run in development mode (fast, direct TypeScript execution)
npm run scrape
# or
npm start
```

### 6. Export Results to Excel / CSV

Once the crawl completes, run:

```bash
npm run export
```

Two files will be generated in your project root:
- 📄 **`results.csv`** — Open directly in **Microsoft Excel** or **Google Sheets** with formatted columns.
- 📄 **`results.json`** — Complete structured dataset with all review objects and metadata.

---

## ⚙️ Configuration Reference (`input.json`)

| Option | Type | Default | Description |
|---|---|---|---|
| `searchQueries` | `string[]` | `[]` | List of search queries to run on Google Maps. |
| `startUrls` | `object[]` | `[]` | Optional direct Google Maps URLs (`[{"url": "https://..."}]`). |
| `maxPlacesPerQuery` | `number` | `20` | Maximum number of businesses to scrape per query. |
| `maxReviews` | `number` | `2` | Maximum reviews to extract per place (`0` to skip reviews). |
| `maxImages` | `number` | `0` | Photo URLs to collect per place (`0` to skip). |
| `language` | `string` | `"en"` | Language code for Google Maps (e.g., `en`, `es`, `fr`, `de`). |
| `deeperCrawl` | `boolean` | `true` | Visits each individual place page for complete details. |
| `includeWebResults` | `boolean` | `true` | Navigates to business websites to extract **email addresses** and **social media profiles**. |
| `maxConcurrency` | `number` | `3` | Number of parallel browser tabs (recommended: `3` to `6`). |
| `proxyUrls` | `string[]` | `[]` | Optional list of HTTP/SOCKS proxies (`["http://user:pass@host:port"]`). |

---

## 📦 Output Example (`results.json`)

```json
[
  {
    "title": "Hotel Vadapalani",
    "category": "Hotel",
    "address": "100 Arcot Rd, Vadapalani, Chennai, Tamil Nadu 600026",
    "phone": "+91 44 2480 0000",
    "website": "https://hotelvadapalani.com",
    "email": "reservations@hotelvadapalani.com",
    "socialProfiles": {
      "instagram": "https://instagram.com/hotelvadapalani",
      "facebook": "https://facebook.com/hotelvadapalani",
      "whatsapp": "https://wa.me/919876543210"
    },
    "totalScore": 4.5,
    "reviewsCount": 850,
    "latitude": 13.0512,
    "longitude": 80.2114,
    "plusCode": "362P+9J Chennai, Tamil Nadu",
    "reviews": [
      {
        "author": "Arun Kumar",
        "rating": 5,
        "text": "Great stay, clean rooms, and courteous staff.",
        "relativeTimeDescription": "a week ago"
      }
    ],
    "url": "https://www.google.com/maps/place/...",
    "scrapedAt": "2026-10-19T02:00:00.000Z"
  }
]
```

---

## 🏗️ Architecture

```
                       ┌─────────────────────────┐
                       │       input.json        │
                       └────────────┬────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │     PlaywrightCrawler        │
                     │  (Fingerprinting & Blocking) │
                     └──────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
 ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
 │    SEARCH    │            │    PLACE     │            │   WEBSITE    │
 │ (Feed Scroll │ ─────────> │ (Place Card  │ ─────────> │ (Homepage &  │
 │  & Enqueue)  │            │  Extraction) │            │ Contact Sub) │
 └──────────────┘            └──────────────┘            └──────────────┘
                                                                │
                                                                ▼
                                                     ┌──────────────────────┐
                                                     │  storage/datasets/   │
                                                     └──────────┬───────────┘
                                                                │
                                                        npm run export
                                                                │
                                                                ▼
                                                     ┌──────────────────────┐
                                                     │ results.csv & .json  │
                                                     └──────────────────────┘
```

---

## 🛠️ Tech Stack

- **[TypeScript](https://www.typescriptlang.org/)** — Full type safety and modern syntax.
- **[Crawlee](https://crawlee.dev/)** — The web scraping and browser orchestration library for Node.js.
- **[Playwright](https://playwright.dev/)** — Headless Chromium automation.
- **[Zod](https://zod.dev/)** — Runtime schema validation for configuration.

---

## 📄 License

This project is licensed under the **ISC License**. Feel free to use and modify it for personal and commercial projects.
