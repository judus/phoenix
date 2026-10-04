# Supplemental styles and configuration audit — 2026-10-04

## Scope and method

Read-only supplement to the systematic complexity audit. Fully read all 65 tracked CSS/HTML files below: 54 UI stylesheets, eight Storybook stylesheets, and three HTML entry/head files. No files under Control Deck or generated/vendor output were included. No stylesheet or HTML production edits were made.

Reviewed imports and cascade ordering; state/theming selectors; minimum-size/overflow/container contracts; keyboard-focus replacements; gesture touch-action ownership; and responsive branches. Shared field markup was traced through `packages/ui/src/components/field.tsx` and all tracked UI CSS focus selectors were checked before reporting S1/S2. Findings are pre-existing behavior, not regressions from this audit's approved TypeScript refactors.

Supplemental compiler/package/build configuration coverage is recorded file-by-file in [the infrastructure ledger](complexity-2026-10-04-infrastructure.md). That supplement covers eight tsconfigs, eight package manifests, `.nvmrc`, the Windows installer definition, and workflow/build boundaries. The two Storybook HTML heads are also listed there because they were inspected with configuration; this ledger explicitly accounts for their CSS/HTML ownership. No tracked `.npmrc` exists.

## Candidate proof and disposition

### S1 — Shared form controls have no visible keyboard focus indication (deferred)

`packages/ui/src/styles/base/forms.css:197–212` sets `:focus-visible { outline: none }` on `.form-control, .form-select`. `field.tsx:50–68` emits those classes for text, number, select and textarea controls. `components/multi-select.tsx:35` applies `.form-select` to the native summary. Full CSS reads and focused selector search found no border, background, box-shadow or ancestor focus-within replacement for these controls. Invalid/open/disabled states are not keyboard focus replacements. Thus tabbing through normal query/settings fields provides no field-level visible focus indicator.

No production edit: this is a small accessibility behavior change, not a behavior-preserving simplification. A follow-up should add a semantic focus-color outline/border that survives invalid state and input-action clipping, then verify keyboard focus on public query/settings compositions in Phoenix and Elite with a real browser.

### S2 — Elite command tiles override the shared keyboard focus ring (deferred)

`base/buttons.css:142–144` gives buttons an action-colored focus outline. `patterns/tile-groups.css:128` explicitly suppresses it for `.theme-elite .tile.btn`; no replacement changes when a tile receives keyboard focus. Active/pressed glow reflects command state, not focus. The atlas and system-body outline suppression were not grouped with this finding: each has a concrete stroke or border/background replacement.

No production edit: preserve the existing theme during this behavior-preserving pass. Follow-up can restore or replace only the Elite keyboard indicator with browser coverage; do not change active glow or held-command safety.

### S3 — Repeated traffic import (kept)

`main.css:54–55` imports the same traffic stylesheet twice consecutively. This adds no meaningful architecture or defensive-programming complexity; removing it is a cosmetic bundle cleanup, so it was not used to justify production churn.

### S4 — Undeclared bold watermark token (kept/deferred)

`patterns/control-deck-tiles.css:253` references `--font-weight-bold`, whereas the centralized font-weight tokens define normal, medium and semibold. Repository CSS search found no declaration of the bold token. Its invalid declaration falls back to inherited font weight; this is not an application-state correctness issue. Leave current appearance unchanged here. A separate visual review can deliberately choose a defined weight.

## File-by-file full-read coverage

All dispositions below mean the file was fully read, not merely located by search. Retained visual behavior has source review evidence, not a claim of cross-browser visual equivalence or screenshot validation.

| File | Review disposition |
| --- | --- |
| `apps/storybook/.storybook/manager-head.html` | Kept: one favicon link only; no inline executable logic or style cascade. |
| `apps/storybook/.storybook/preview-head.html` | Kept: preview favicon link only; same asset purpose as manager but independent iframe head. |
| `apps/storybook/src/styles/control-stories.css` | Kept: story-only control examples, container dimensions and responsive demonstrations; not application state. |
| `apps/storybook/src/styles/current-ship-stories.css` | Kept: full-height and flowing story wrappers intentionally exercise both widget layouts. |
| `apps/storybook/src/styles/data-display-stories.css` | Kept: identifier demo sizing only; no production selector coupling. |
| `apps/storybook/src/styles/foundations.css` | Kept: token/type/spacing demonstration grids and responsive examples; illustrative repetition is appropriate. |
| `apps/storybook/src/styles/page-stories.css` | Kept: page/route form examples and narrow-column stacking; story scope preserves production layout. |
| `apps/storybook/src/styles/shell-stories.css` | Kept: bounded Deskplane example, brand and activity list; full-height behavior intentionally distinct from flowing examples. |
| `apps/storybook/src/styles/storybook.css` | Kept: import entrypoint for Deskplane and seven story style bundles; order retained. |
| `apps/storybook/src/styles/tablet-shell-stories.css` | Kept: tablet full-height wrapper, brand SVG and story-scoped :has selectors; do not merge into production shell. |
| `apps/web/index.html` | Kept: root mount, module entry, viewport/theme/favicon metadata; no duplicated application executable code. |
| `packages/ui/src/styles/app-shell.css` | Kept: shell rail/sidebar/workspace grid, overflow ownership, focus-mode chrome suppression and responsive brand. Gesture touch-action retained as interaction contract. |
| `packages/ui/src/styles/base/buttons.css` | Kept: semantic variants, pressed/disabled/busy states, grip pseudo-element and keyboard focus indicator; reduced-motion rule retained. |
| `packages/ui/src/styles/base/fonts.css` | Kept: bundled font faces and display font metadata; no runtime fallback logic to remove. |
| `packages/ui/src/styles/base/forms.css` | Deferred S1: shared controls explicitly suppress keyboard focus indication without replacement. Form grid, input actions, multiselect and responsive cascade otherwise retained. |
| `packages/ui/src/styles/base/links.css` | Kept: small semantic link style; browser keyboard focus remains available. |
| `packages/ui/src/styles/base/lists.css` | Kept: row/definition-list layouts, state backgrounds, focus styles and widget exclusion from Elite textured rows. Similar selectors serve distinct markup. |
| `packages/ui/src/styles/base/tables.css` | Kept: independent scroll regions, sticky headers, sortable focus, themed textured row gaps and intentional widget exception. Header thickness is prior user design choice. |
| `packages/ui/src/styles/base/typo.css` | Kept: display/numeric/currency/assistive text helpers; intentional reusable primitives. |
| `packages/ui/src/styles/components/data-display.css` | Kept: status/metric/meter/progress roles and native-engine progress styling; no complex defensive behavior. |
| `packages/ui/src/styles/components/mission-title.css` | Kept: mission detail typography and grid alignment; semantically scoped presentation. |
| `packages/ui/src/styles/components/navigation.css` | Kept: full/compact rail variants, active states and keyboard outlines. Redundant font-family declaration is cosmetic, not substantive complexity. |
| `packages/ui/src/styles/components/page-header.css` | Kept: header actions/status/breadcrumb layout and container breakpoints; primary layout contract. |
| `packages/ui/src/styles/components/system-location.css` | Kept: compact linked location ellipsis and copy-button alignment; overflow constraints necessary for long names. |
| `packages/ui/src/styles/layouts/layout.css` | Kept: named-container responsive grids, fill/zero-min-size contracts and gap helpers; broad consolidation would risk scroll behavior. |
| `packages/ui/src/styles/main.css` | Deferred S3: duplicate adjacent traffic.css import is cosmetic; global sizing, density, scrollbars and import order preserved. |
| `packages/ui/src/styles/pages/commander.css` | Kept: compact commander summary/readout alignment; no unnecessary state-dependent cascade. |
| `packages/ui/src/styles/pages/controls.css` | Kept: editable command grids, theme/editor variants and narrow layout. touch-action:none on held controls is game-input safety behavior. |
| `packages/ui/src/styles/pages/copilot.css` | Kept: layered conversation/profile/message/composer rules and bounded scroll grid. Layer priority differences require browser/design evidence before any cascade rewrite. |
| `packages/ui/src/styles/pages/credits.css` | Kept: small scoped scroll/source-panel rules. |
| `packages/ui/src/styles/pages/current-ship-consolidated.css` | Kept: intentionally exceptional mixed widget/command dashboard, Elite-only placement, warning lamps, meter sizing and breakpoint layout. Independent semantic states retained. |
| `packages/ui/src/styles/pages/current-ship-loadout.css` | Kept: list/grid loadout forms, engineered/broken/disabled/empty states and independent scroll focus. State-specific color precedence intentional. |
| `packages/ui/src/styles/pages/current-ship.css` | Kept: named current-ship size container, matrix areas and readout breakpoints; shared parent layout needed by consolidated variant. |
| `packages/ui/src/styles/pages/dashboard.css` | Kept: alert overlay bounds/dismiss focus, log tail space, command slots and market widget resize/overflow behavior. |
| `packages/ui/src/styles/pages/developer.css` | Kept: tool list/projection workspace and responsive stacked inspectors; JSON wraps and scroll ownership are deliberate. |
| `packages/ui/src/styles/pages/engineering.css` | Kept: semantic table widths, positive/negative feature color inheritance and plan form spacing. |
| `packages/ui/src/styles/pages/exobiology.css` | Kept: fixed index width, name truncation and start-name RTL overflow presentation; not a vocabulary/data normalization concern. |
| `packages/ui/src/styles/pages/fleet-runtime.css` | Kept: runtime scroll page grid and keyboard-visible focused scroll region. |
| `packages/ui/src/styles/pages/fleet.css` | Kept: notices-dependent grid row count and vessel table scroll constraints. |
| `packages/ui/src/styles/pages/galactic-atlas.css` | Kept: theme-driven SVG stroke/fill, pointer-owned viewport, overlay zoom controls and marker focus replacement via hit-area stroke; outline suppression here has an actual replacement. |
| `packages/ui/src/styles/pages/galaxy-query-editor.css` | Kept: envelope/parameter/result scroll ownership, save panel and responsive collapse; nested grids are distinct layout responsibilities. |
| `packages/ui/src/styles/pages/galnet-radio.css` | Kept: radio display and four equal command controls; hidden widget body is explicit display-only mode. |
| `packages/ui/src/styles/pages/galnet.css` | Kept: index/reader split, paragraph width, focused scroll regions and narrow composition. |
| `packages/ui/src/styles/pages/help.css` | Kept: topic/reader panes and scroll-margin section navigation. Smooth scrolling is existing design behavior, not changed in this audit. |
| `packages/ui/src/styles/pages/journal.css` | Kept: toolbar/workspace/inspector layout and importance colors. Repeated inspector selectors add separate properties rather than overwrite invariants. |
| `packages/ui/src/styles/pages/macros.css` | Kept: presence-dependent grid rows, editor/library scroll and narrow layouts; :has branches reflect actual optional status/playback rows. |
| `packages/ui/src/styles/pages/numpad.css` | Kept: keypad dimensions, numeric watermark/grip colors and Elite ink overrides; no new button vocabulary introduced. |
| `packages/ui/src/styles/pages/pairing.css` | Kept: authorization form, code/address/QR layout and narrow-container behavior. No credential content in stylesheet. |
| `packages/ui/src/styles/pages/personal-stores.css` | Kept: bounded stores scroller and focused scroll region. |
| `packages/ui/src/styles/pages/plotted-route.css` | Kept: overview/path/preview/sequence panes with independent scroll and narrow layout. |
| `packages/ui/src/styles/pages/query-console.css` | Kept: landscape five-by-two versus portrait two-by-five query tile grid; breakpoint is intentional layout choice. |
| `packages/ui/src/styles/pages/saved-galaxy-queries.css` | Kept: saved-query fill grid and action group only. |
| `packages/ui/src/styles/pages/settings.css` | Kept: bounded settings sections, controls/output sizing, pairing panel and narrow field widths. |
| `packages/ui/src/styles/pages/ship-catalogue.css` | Kept: roster/schematic/table views, capacity matrix and responsive constraints. Repeated schematic block targets separate optional view. |
| `packages/ui/src/styles/pages/stored-modules.css` | Kept: manifest scroll containment and compact-height spacing. |
| `packages/ui/src/styles/pages/system-schematic.css` | Kept: orbital hierarchy, transforms, SVG glyphs, installation/selection/detail pane and responsive grid. Body focus replaces outline with border/background. Duplicate structural declarations are low-value cosmetic; no flattening or coordinate rewrite. |
| `packages/ui/src/styles/pages/traffic.css` | Kept: summary/list/detail panes, raw payload wrapping, importance/readout styling and narrow layout. |
| `packages/ui/src/styles/patterns/control-deck-tiles.css` | Deferred S4: undefined bold token in keypad watermark falls back through CSS invalid-declaration semantics. Canonical Control Deck tile content/metadata/grip/grid contract retained. |
| `packages/ui/src/styles/patterns/copilot-permission-editor.css` | Kept: details groups and policy editor summaries; no JavaScript/runtime authorization responsibility here. |
| `packages/ui/src/styles/patterns/panels.css` | Kept: widget/panel variants, separate body scroll and intentional Elite widget exceptions; do not genericize header/body grids. |
| `packages/ui/src/styles/patterns/record-page.css` | Kept: record-page fill/scroll and keyboard focus boundaries. |
| `packages/ui/src/styles/patterns/settings-list.css` | Kept: row/control sizing, hidden toggle with visible adjacent-span focus replacement and responsive widths. |
| `packages/ui/src/styles/patterns/switchers.css` | Kept: tab/button/radio-track variants and keyboard focus; transforms describe checked state. |
| `packages/ui/src/styles/patterns/tile-groups.css` | Deferred S2: Elite-only focus outline suppression overrides shared button focus without replacement. Existing active glow, burnt grip, theme and responsive behavior retained. |
| `packages/ui/src/styles/variable.css` | Kept: centralized semantic palette/font/spacing and Phoenix/Elite texture/bloom roles; changing token values would intentionally change design. |

## Validation and boundaries

This supplement changed documentation only, so no new style/browser tests were claimed. The infrastructure implementation's focused 192-test run is documented in its own ledger; the parent owns integration/fullcheck and other agents' UI characterizations. Candidate S1/S2 were sent to the parent before any potential styling changes. No network, workflow dispatch, live journal/database/game input, commit, or push was performed for this supplement.

