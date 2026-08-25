---
name: GeeLark Flows Marketplace
colors:
  primary: '#8b7cff'
  secondary: '#45d8e8'
  background: '#070b12'
  surface: '#0e1623'
  on-surface: '#f4f7fb'
  surface-variant: '#141e2c'
  outline: 'rgba(190, 205, 230, 0.16)'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 'clamp(46px, 6vw, 92px)'
    fontWeight: '650'
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '650'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
rounded:
  DEFAULT: 12px
spacing:
  gutter: 'clamp(18px, 4vw, 48px)'
---

## Brand & style

A polished midnight SaaS marketplace using deep navy surfaces, high-contrast typography, and restrained violet/cyan accents. Manrope carries the interface and display typography; JetBrains Mono is reserved for prices and identifiers. Decorative light is concentrated in the hero and primary actions while catalogue surfaces stay calm and readable.

The brand mark is an original continuous `G` loop that exits as a forward arrow: `G` for GeeLark, a loop for repeatable automation, and an arrow for flow. The symbol is kept as a scalable SVG and paired with live HTML text so it stays crisp, accessible, and readable from favicon to large display sizes.

The storefront is mobile-first: the 320px single-column composition is the source layout, then content-led breakpoints progressively add roomier phone, tablet, landscape, laptop, and desktop arrangements. It uses a 1200px content bound, fluid gutters, a viewport-safe hero, and auto-fitting catalogue grids rather than device-specific card counts. Cards, filters, cart items, checkout choices, and workspace details also respond to their own container width. Short landscape screens receive a compact two-column hero, while narrow phones progressively simplify secondary header text without removing accessible labels. Body copy stays in the 12–18px range rather than micro typography. Controls provide at least a 24px target and primary actions use a 44px minimum height. Keyboard focus uses a visible three-pixel outline, and modal dialogs lock page scroll, support Escape, cycle focus, and return focus to their trigger.

Hero and catalogue sections must never create horizontal overflow. Demo media is conditional: when a product has no real video URL, the card and modal reserve no demo space.
