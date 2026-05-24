# Nexus Vault — Digital Asset & Automation Marketplace

A high-conversion, premium marketplace web application for selling GeeLark RPA automation flows and aged social/communication accounts.

## Technology Stack & Architectural Patterns

- **Core Framework**: React 19 + Vite 6
- **Styling Paradigm**: Vanilla CSS custom properties implementing a **Modern Cyber-Industrial Theme** (Slate background, neon indigo accent lighting, glassmorphism, dynamic glow hover animations).
- **State Management**: Headless React Context providers (`CartContext` and `FilterContext`) managing checkout queues, platform tags, search indexes, and layout states.

## Design Tokens (`src/index.css`)

- **Palette Rules**: Harmonics focused around `#0f172a` (deep slate), `#818cf8` (neon indigo), with platform indicators matching specific brands (`#E1306C` for Instagram, `#00f2ea` for TikTok, `#EA4335` for Gmail).
- **Glassmorphism Spec**: `background: rgba(15, 23, 42, 0.65)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(255, 255, 255, 0.08)`.
- **Spacing Grid**: Strict 4px baseline (`--sp-1: 4px` through `--sp-16: 64px`). No arbitrary values.
- **Typography Scale**: Body paired with *Inter*, metrics and system scripts utilizing *JetBrains Mono* to enforce technical confidence.

## Run & Deploy Locally

Ensure you have Node.js installed, then execute:

```bash
# Navigate to project root
cd marketplace

# Install dependencies
npm install

# Start local server
npm run dev
```

The application will start on `http://localhost:5173`.
