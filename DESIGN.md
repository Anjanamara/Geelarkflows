---
name: GeeLark Flows Marketplace
colors:
  background: '#fbfaf7'
  surface: '#ffffff'
  surface-muted: '#f4f2ec'
  on-surface: '#14181f'
  on-surface-secondary: '#414a58'
  primary: '#0f6b5c'
  primary-hover: '#0b5548'
  outline: 'rgba(20, 24, 31, 0.16)'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 'clamp(2.1rem, 6.4vw, 3.6rem)'
    fontWeight: '700'
  headline-md:
    fontFamily: Manrope
    fontSize: 'clamp(1.5rem, 3.6vw, 2.1rem)'
    fontWeight: '700'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
rounded:
  DEFAULT: 8px
spacing:
  gutter: 'clamp(18px, 4vw, 40px)'
---

## Brand & style

Quiet, plain and proof-first. A warm paper background, white surfaces, ink-coloured text and a single deep-green accent. The aim is that a first-time visitor understands in five seconds what is sold, what it costs, and what protects them, and can find the policies without hunting.

Rules the design follows, and new work should keep following:

- **One accent, no gradients, no glows, no decorative animation.** Colour is used to mark the primary action and nothing else.
- **One job per section.** The home page is: hero, flow list, services (custom builds, account management, virtual assistants), how buying works, what is visible before you pay, FAQ.
- **Say it in plain words.** Headlines describe the product, not a mood. Trust statements are specific and verifiable; do not add claims (counts, testimonials, "active use") that cannot be backed up.
- **No interruptions.** No popups, notification prompts, email-capture interstitials, or cart animations.
- **Flows are a list, not a card wall.** Each row shows platform and task, title, one-line description, and price. Add to cart and the full scope live on the flow's own page.

The single theme is light. Legacy token names in `src/index.css` (for example `--accent-lime`) are kept so every page inherits the palette; they now resolve to the green accent.

The brand mark is a plain route of connected steps (a workflow) in white on a solid green tile. It deliberately avoids a letterform or arrow so it cannot be mistaken for another brand, and stays crisp from favicon to large sizes.

The storefront is mobile-first: the 320px single-column layout is the source layout, with a 1120px content bound and fluid gutters. Body copy stays in the 12–18px range, controls are at least 44px tall for primary actions, keyboard focus uses a visible three-pixel outline, and modal dialogs lock page scroll, support Escape, cycle focus, and return focus to their trigger.
