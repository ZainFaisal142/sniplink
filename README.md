# ⚡ Sniplink — Edge URL Shortener & Analytics Web App

> A lightning-fast, production-ready, SEO-optimized URL shortener with real-time analytics. Built with the premium **"Origin Financial"** dark high-contrast aesthetic (Bento grids, subtle micro-transitions, fixed-height CLS-free ad spaces, and edge-powered redirects).

---

## 🚀 Architectural Overview

### 1. Frontend (`/frontend`)
- **Framework**: React 18 + React Router (SPA)
- **Design System**: Origin Financial aesthetic (`#090D16` slate background, rounded Bento grid cards, linear gradients `#6366F1` ➔ `#8B5CF6`, smooth hover lifts).
- **Core Views**:
  - `/` — **Shortener Engine**: Real-time URL validation (strict `http://` / `https://`), instant short-code generation, and one-click copy with animated feedback.
  - `/dashboard` — **Analytics Dashboard**: Bento Grid with **Total Links**, **Total Clicks**, **Average Clicks/Link**, and an activity table.
  - `*` — **404 Page**: Branded, high-contrast fallback view.
- **Zero Cumulative Layout Shift (CLS)**: Fixed-dimension `.ad-placeholder` containers (90px mobile / 250px desktop) engineered for Google AdSense compliance.
- **Hybrid API Service**: Seamlessly switches between Cloudflare Worker edge backend and high-performance local simulation.

### 2. Serverless Backend (`/worker`)
- **Runtime**: Cloudflare Workers (JavaScript ES Modules)
- **Database**: Cloudflare KV Storage (`LINKS_KV`) for sub-millisecond lookups.
- **Endpoints**:
  - `POST /api/shorten` — Validates URL, generates a 6-character alphanumeric code with collision retries, and stores JSON payload `{ url, clicks, createdAt }`.
  - `GET /api/stats` — Fetches active keys from Cloudflare KV and returns aggregated click metrics.
  - `GET /:shortCode` — Performs instant HTTP `301/302` redirects to destination and asynchronously increments click metrics.
- **Security & Headers**: Full CORS preflight (`OPTIONS`), strict origin handling, content-type verification.

---

## 📂 Project Structure

```
url-shortener-webapp/
├── preview.html                     # 🌟 Zero-config live standalone version (instant browser opening)
├── frontend/                        # React SPA
│   ├── index.html                   # Semantic HTML5 skeleton + SEO meta tags + Google Font Inter
│   ├── package.json                 # Vite + React 18 + React Router dependencies
│   ├── vite.config.js               # Optimized Vite configuration
│   └── src/
│       ├── main.jsx                 # React root mount
│       ├── App.jsx                  # Header, Footer, and SPA Route mappings
│       ├── index.css                # Origin Financial CSS design system & Bento Grid
│       ├── services/
│       │   └── apiService.js        # Hybrid Cloudflare / local edge fallback client
│       └── components/
│           ├── Shortener.jsx        # Link shortener hero & input card
│           ├── Dashboard.jsx        # Real-time analytics & recent activity table
│           ├── Redirector.jsx       # Client route redirector for /#/r/:code
│           └── NotFound.jsx         # Custom 404 page
└── worker/                          # Cloudflare Worker Backend
    ├── package.json                 # Wrangler scripts
    ├── wrangler.toml                # Worker configuration & KV namespace binding
    └── worker.js                    # Ultra-fast serverless edge API & 301 redirect engine
```

---

## 🛠️ Quick Start & Running

### Option A: Instant Live Preview (No setup needed)
Simply open `preview.html` in any web browser to test the complete UI, URL shortener, copy-to-clipboard, and live analytics dashboard immediately!

### Option B: Run Frontend with Vite
```bash
cd frontend
npm install
npm run dev
```

### Option C: Deploy Cloudflare Worker & KV
1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
2. Login to Cloudflare:
   ```bash
   wrangler login
   ```
3. Create the KV Namespace:
   ```bash
   wrangler kv namespace create "LINKS_KV"
   ```
4. Paste the generated `id` into `worker/wrangler.toml`.
5. Deploy to the Edge:
   ```bash
   cd worker
   wrangler deploy
   ```
6. Set your Worker URL in `frontend/.env`:
   ```env
   VITE_API_BASE=https://sniplink.zainfaisal107.workers.dev
   ```
