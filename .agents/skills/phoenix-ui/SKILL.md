---
name: phoenix-ui
description: Implement or review PHOENIX UI, styles, navigation and touch interactions using the shared component and ownership contracts. Not a whole-codebase audit.
---

# PHOENIX UI

Inspect the affected page, shared component, stylesheet and existing tests before editing. PHOENIX
uses React/TypeScript and plain CSS with native nesting; check installed versions, not just ranges.

## Owners

- `apps/web/src/features`: page content, typed routes and application adapters.
- `packages/ui/src`: reusable primitives, semantic markup and theme-aware style cascade.
- Control Deck: reusable deck/Numpy/input behavior. Consume its versioned runtime, never copy source.
- Deskplane: generic desktop gestures/navigation. PHOENIX owns workspace route history and defaults.
- Server read models/contracts: authoritative game state. Unknown telemetry is not zero or false.

## Presentation contract

- One short component root plus finite modifiers (`btn btn-sm`, `form-control form-mini`, `active`).
  No BEM child-class trees, visual data attributes, arbitrary styling props or `!important`.
- Semantic HTML and owner-rooted CSS nesting; styles enter through `packages/ui/src/styles/main.css`.
  Pages compose primitives rather than reaching into their descendants to restyle them.
- Use named spacing/type/color tokens. EURO CAPS means the display typeface and uppercase
  presentation, not rewriting catalogue identities or exact-name query values.
- Navigation visuals live only in `styles/components/navigation.css`; preserve default/active states.
- Keep Phoenix/Elite distinct. Widget lists keep their compact widget treatment; page record tables
  can use Elite texture. No invented beveled/3D button treatment.
- SVG/map coordinates may be runtime geometry. Routine spacing/colors belong in CSS, not inline JS.

## Interactions and verification

Trace remembered routes and cold/default states as well as loaded pages. Map pan/pinch and deck-edit
move gestures must not accidentally trigger workspace navigation. Preserve touch target usability
when shrinking a visual icon. Use native control/ARIA semantics for toggle and keyboard interaction.

Test behavior, including empty/loading state, selected detail, filters, cancellation and relevant
async updates. Run focused regressions and `npm run check`. Verify UI in the real PHOENIX shell,
both themes and landscape/portrait; static markup and screenshots alone do not prove interaction.
If browser or device validation is unavailable, state precisely what is not verified.

When available, ignored `.context/css-and-component-guidelines.md` has the detailed local contract.
Do not depend on ignored context for the essential rules above or commit player data/screenshots.
