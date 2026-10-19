<<<<<<< HEAD
# 🗺️ Google Maps Scraper Pro (MapIntel)

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Crawlee](https://img.shields.io/badge/Crawlee-v3-orange.svg)](https://crawlee.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-red.svg)](https://playwright.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Google--Map--Scraper-blue.svg)](https://github.com/KaranAKDEV/Google-Map-Scraper)

A production-grade, lightning-fast, and completely **free & standalone** Google Maps business lead scraper with an **interactive Web UI** and **CLI mode**. Runs 100% locally on your machine with **zero API keys, zero cloud accounts, and zero paid subscriptions**.

Extract verified business names, addresses, phone numbers, websites, **emails**, **social media links** (Instagram, Facebook, LinkedIn, Twitter/X, WhatsApp), average star ratings, customer reviews, coordinates, and opening hours.

---

## 🌟 Key Highlights

- 🖥️ **Interactive Web Interface (Default Light Theme):** Clean, modern dashboard with a dual **Light / Dark theme toggle**, intuitive controls, and mobile responsiveness.
- 🎯 **Highlighted Query Input:** Prominently styled query tag bar with rapid single-click industry presets (`Gyms NYC`, `Cafes Seattle`, `Tech Austin`, `Dentists Miami`, etc.).
- 📡 **Live Radar & Progress Animation:** Dynamic sonar radar scanner and real-time progress bar indicating active place processing.
- 📧 **Deep Website Email & Social Extraction:** Automatically navigates to business websites to extract contact emails (`mailto:`, contact forms, header/footer) and social handles.
- 📊 **Real-time KPI Dashboard:** Live counters for Total Places, Verified Emails Found, Direct Phone Numbers, and Average Rating.
- 📋 **Flexible Leads Explorer:** Search, filter, switch between **Table View** and **Card Grid View**, view detailed modal breakdowns, and delete individual records.
- 📥 **One-Click Exports & Outreach:** Instant export to **Excel-ready CSV** or **JSON**, plus a 1-click button to copy all emails or phone numbers to clipboard.
- ⚡ **Resource Interception & Anti-Detection:** Automatically blocks images, media, and third-party trackers for 3x scraping speeds while rotating browser fingerprints and human scroll heuristics.

---

## 📋 Scraped Data Fields

| Field | Description | Example |
|---|---|---|
| `title` | Business Name | `Grand Palace Hotel` |
| `category` | Primary Business Category | `Hotel` |
| `address` | Full Formatted Address | `123 Main St, Vadapalani, Chennai, 600026` |
| `phone` | Direct Phone Number | `+91 44 2480 1234` |
| `website` | Official Website URL | `https://grandpalace.com` |
| `email` | Scraped Contact Email | `info@grandpalace.com` |
| `socialProfiles` | Social Links & WhatsApp | Instagram, Facebook, LinkedIn, Twitter, WhatsApp |
| `totalScore` | Average Rating | `4.6` |
| `reviewsCount` | Total Reviews Count | `1,420` |
| `latitude` / `longitude` | GPS Coordinates | `13.0521`, `80.2123` |
| `plusCode` | Google Plus Code | `362P+8Q Chennai, Tamil Nadu` |
| `openingHours` | Full Weekly Schedule | `[{"day": "Monday", "hours": "Open 24 hours"}]` |
| `reviews` | Customer Reviews | Author, star rating, text, date, response |
| `url` | Google Maps URL | `https://www.google.com/maps/place/...` |

---

## 🛠️ Tech Stack

- **Runtime & Language:** [Node.js](https://nodejs.org/) (>= 20) with [TypeScript](https://www.typescriptlang.org/) & [TSX](https://github.com/privatenumber/tsx)
- **Web Scraping Engine:** [Crawlee](https://crawlee.dev/) (`PlaywrightCrawler`)
- **Browser Automation:** [Playwright](https://playwright.dev/) (Headless Chromium with Fingerprint generation)
- **Backend Server:** [Express.js](https://expressjs.com/) with Server-Sent Events (SSE) for live streaming
- **Frontend UI:** Vanilla HTML5, Modern CSS (Glassmorphism, CSS Custom Properties, Responsive Grid), and Vanilla JavaScript
- **Schema Validation:** [Zod](https://zod.dev/)

---

## 🚀 Quick Start Guide

### 1. Clone the Repository

```bash
git clone https://github.com/KaranAKDEV/Google-Map-Scraper.git
cd Google-Map-Scraper
```

### 2. Install Dependencies & Playwright Browser

```bash
# Install NPM packages
npm install

# Install Chromium browser binary for Playwright
npx playwright install chromium
```

---

## 🌐 Method 1: Using the Web Interface (Recommended)

Launch the full-featured Web UI with a single command:

```bash
npm start
# or
npm run ui
```

Then open your browser at:
👉 **`http://localhost:3000`**

### How to use the Web UI:
1. **Search Queries (Required):** Type any search keyword (e.g. `gym in new york`) and press <kbd>Enter</kbd> or click **+ Add**, or click one of the preset chips.
2. **Configure Parameters:**
   - **Max Places per Query:** Adjust the slider (e.g. 10 to 100 places).
   - **Max Reviews:** Choose how many customer reviews to extract per place (set to 0 to skip).
   - **Deep Crawl:** Keep enabled to visit individual place pages for complete hours, plus codes, and full categories.
   - **Website & Email Discovery:** Keep checked to visit company websites for emails and socials.
   - **Concurrency:** Select parallel browser tabs (recommended: 2 to 5 depending on your CPU/RAM).
3. **Launch Scraper:** Click the blue **"Launch Scraper"** button.
   - The UI will immediately switch to an animated scanning radar with a live progress bar.
   - Results will stream into the KPI cards and leads table as they are discovered.
4. **Export & Outreach:**
   - Click **"Export CSV"** to download an Excel-formatted spreadsheet.
   - Click **"Export JSON"** to download complete structured JSON.
   - Use the **"Quick Actions"** dropdown to copy all discovered emails or phone numbers directly to your clipboard.
   - Switch between **Light Theme** and **Dark Theme** using the toggle in the header.

---

## 💻 Method 2: Command Line Interface (CLI)

If you prefer to run headlessly without a browser window or UI:

### 1. Configure `input.json`

Open [`input.json`](./input.json) in your project root:

```json
{
  "searchQueries": [
    "gym in new york",
    "software company in austin"
  ],
  "maxPlacesPerQuery": 20,
  "maxReviews": 2,
  "language": "en",
  "deeperCrawl": true,
  "includeWebResults": true,
  "maxConcurrency": 3
}
```

### 2. Run the Scraper

```bash
npm run scrape
```

### 3. Export to CSV & JSON

```bash
npm run export
```

The exported files will be created in the root directory:
- 📄 **`results.csv`** — Open directly in **Microsoft Excel**, **Numbers**, or **Google Sheets**.
- 📄 **`results.json`** — Full JSON dataset with complete reviews array.

---

## ⚙️ Configuration Reference (`input.json`)

| Option | Type | Default | Description |
|---|---|---|---|
| `searchQueries` | `string[]` | `[]` | List of search queries to run on Google Maps. |
| `startUrls` | `object[]` | `[]` | Optional direct Google Maps URLs (`[{"url": "https://..."}]`). |
| `maxPlacesPerQuery` | `number` | `20` | Maximum number of businesses to scrape per query. |
| `maxReviews` | `number` | `2` | Maximum reviews to extract per place (`0` to skip). |
| `maxImages` | `number` | `0` | Photo URLs to collect per place (`0` to skip). |
| `language` | `string` | `"en"` | Language code for Google Maps (e.g., `en`, `es`, `fr`, `de`). |
| `deeperCrawl` | `boolean` | `true` | Visits place details page for full metadata. |
| `includeWebResults` | `boolean` | `true` | Navigates to business websites to extract **email addresses** and **social media profiles**. |
| `maxConcurrency` | `number` | `3` | Number of parallel browser tabs (recommended: `3` to `5`). |
| `proxyUrls` | `string[]` | `[]` | Optional list of HTTP/SOCKS proxies (`["http://user:pass@host:port"]`). |

---

## 📦 Sample Output (`results.json`)

```json
[
  {
    "title": "Equinox Columbus Circle",
    "category": "Gym",
    "address": "10 Columbus Cir, New York, NY 10019",
    "phone": "+1 212-871-0425",
    "website": "https://www.equinox.com/clubs/new-york/columbuscircle",
    "email": "concierge@equinox.com",
    "socialProfiles": {
      "instagram": "https://instagram.com/equinox",
      "facebook": "https://facebook.com/equinox",
      "linkedin": "https://linkedin.com/company/equinox"
    },
    "totalScore": 4.6,
    "reviewsCount": 384,
    "latitude": 40.7685,
    "longitude": -73.9829,
    "plusCode": "Q298+9P New York",
    "openingHours": [
      { "day": "Monday", "hours": "5:30 AM–10:00 PM" },
      { "day": "Tuesday", "hours": "5:30 AM–10:00 PM" }
    ],
    "reviews": [
      {
        "author": "Sarah M.",
        "rating": 5,
        "text": "Top notch amenities, clean spa, and great personal trainers.",
        "relativeTimeDescription": "2 weeks ago"
      }
    ],
    "url": "https://www.google.com/maps/place/...",
    "scrapedAt": "2026-10-19T03:00:00.000Z"
  }
]
```

---

## 📁 Project Structure

```
Google-Map-Scraper/
├── public/                # Web UI frontend assets
│   ├── index.html         # Modern responsive dashboard
│   ├── style.css          # Dual theme (Light/Dark) design system
│   └── app.js             # Client interactivity, SSE & export triggers
├── src/
│   ├── main.ts            # Core crawler runner & Crawlee setup
│   ├── routes.ts          # Page handlers (Search, Details, Website Emails)
│   ├── server.ts          # Express API server & SSE live stream
│   ├── export.ts          # JSON & CSV generator logic
│   └── utils.ts           # Anti-bot stealth, resource blockers, regex parser
├── input.json             # Configuration file for CLI runs
├── package.json           # Dependencies and run scripts
├── tsconfig.json          # TypeScript compiler configuration
└── README.md              # Documentation & guide
```

---

## 💡 Performance & Pro-Tips

1. **Light Theme & Dark Theme:** The interface defaults to a clean, crisp Light Mode. You can click the **Theme** button in the top right to switch to Dark Mode anytime.
2. **Email Crawling Speed:** Deep crawling websites for emails takes 1–3 seconds per place. If you only need phone numbers, addresses, and ratings at maximum speed, uncheck **"Deep Crawl Website for Emails"**.
3. **Optimizing Concurrency:** For most laptops and standard home connections, `maxConcurrency: 3` to `4` is optimal. If you have 16GB+ RAM and a high-speed connection, you can increase concurrency to `6`.
4. **Large Batches:** For large scrapes (100+ places), Google may show verification checks if you scrape too aggressively. Keep concurrency moderate and scrape in batches.

---

## ☁️ Deploying on Render.com

This project includes a pre-configured `Dockerfile` built on Microsoft's official Playwright image (`mcr.microsoft.com/playwright:v1.49.0-noble`), with all Linux system libraries and headless Chromium pre-installed.

### Steps to Deploy:
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Select your repository: `https://github.com/KaranAKDEV/Google-Map-Scraper`.
4. Under **Runtime**, select **Docker** (Render will automatically detect the root `Dockerfile`).
5. Leave the default settings:
   - **Environment:** `Docker`
   - **Port:** `3000` (detected automatically)
   - **Plan:** Free (or Starter with 1GB RAM recommended for large batch scrapes)
6. Click **Create Web Service**.

---

## 📄 License

This project is licensed under the **ISC License**. Feel free to use, modify, and distribute for personal and commercial lead generation projects.
