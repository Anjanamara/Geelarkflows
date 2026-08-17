# GeeLark Flows — Reusable Automation Marketplace

A responsive marketplace for reusable GeeLark automation flows covering social account creation, warmup, publishing, profile management, dating apps, video tooling, analytics, mobile SEO, and custom development.

## Technology Stack & Architectural Patterns

- **Core Framework**: React 19 + Vite 6
- **Styling Paradigm**: Vanilla CSS custom properties implementing a **Modern Cyber-Industrial Theme** (Slate background, neon indigo accent lighting, glassmorphism, dynamic glow hover animations).
- **State Management**: Headless React Context providers (`CartContext` and `FilterContext`) managing checkout queues, platform tags, search indexes, and layout states.

## Design Tokens (`src/index.css`)

- **Palette Rules**: Harmonics focused around `#0f172a` (deep slate), `#818cf8` (neon indigo), with platform indicators matching specific brands (`#E1306C` for Instagram, `#00f2ea` for TikTok, `#EA4335` for Gmail).
- **Glassmorphism Spec**: `background: rgba(15, 23, 42, 0.65)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255, 255, 255, 0.08)`.
- **Spacing Grid**: Strict 4px baseline (`--sp-1: 4px` through `--sp-16: 64px`). No arbitrary values.
- **Typography Scale**: Body paired with *Inter*, metrics and system scripts utilizing *JetBrains Mono* to enforce technical confidence.

## Run Locally

Ensure you have Node.js installed, then execute:

```bash
# Install dependencies
npm install

# Start local server
npm run dev
```

The application will start on `http://localhost:5173`.

## SEO and Search Engine Setup

The production build creates crawlable static pages for every flow, unique titles and descriptions, canonical URLs, Product and Breadcrumb structured data, an XML sitemap, a plain-text Bing sitemap, `robots.txt`, and an IndexNow submission list.

```bash
# Optional: copy .env.example to .env and add ownership verification tokens
npm run build

# Run only after the new build and IndexNow key file are live
npm run seo:indexnow
```

Production discovery files:

- `https://geelarkflows.com/sitemap.xml`
- `https://geelarkflows.com/sitemap.txt`
- `https://geelarkflows.com/robots.txt`

Add the Google Search Console token to `GOOGLE_SITE_VERIFICATION` and the Bing Webmaster Tools token to `BING_SITE_VERIFICATION` in `.env` before building. Submit the XML sitemap in both webmaster dashboards after deployment.
