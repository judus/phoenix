# PHOENIX design-system rules

Status: initial design contract

## 1. One product, two presentation modes

PHOENIX supports two user-selectable presentation modes:

- **PHOENIX** is restrained, technical, information-dense, and game-neutral. It may use a palette
  and a small amount of cockpit character inspired by the current Elite integration, but its
  composition must remain reusable for other games.
- **ELITE** is a bolder cockpit interpretation. It uses larger block controls, stronger filled
  states, more obvious action hierarchy, and a tactile panel rhythm where an Elite-like analogue
  is useful.

This is not merely a colour theme. A component may change spacing, weight, border treatment,
surface fill, typography scale, and internal arrangement between modes while preserving its
meaning, states, accessible name, and interaction contract.

ELITE mode is selective. Data-heavy pages and components with no useful cockpit analogue retain
their PHOENIX treatment. Never force orange blocks onto a surface merely to prove that the mode is
active.

The selected mode is applied once at the application/design-system root. Components consume it
through tokens and component styles; pages do not prop-drill the mode or branch their markup for
cosmetic reasons.

## 2. Composition layers

The system has five layers, ordered from least to most specific:

1. **Tokens** define semantic decisions: colour roles, type roles, spacing, borders, elevation,
   motion, density, and control sizes.
2. **Layout primitives** define relationships: stack, inline flow, cluster, adaptive grid, split,
   frame, scroll region, and divider.
3. **Components** define reusable interface objects: page header, section header, panel, button,
   field, tabs, status, table, list row, metric, and callout.
4. **Patterns** compose components for recurring product needs: dashboard groups, command tiles,
   entity summaries, inspectors, filters, and master-detail arrangements.
5. **Pages** choose content, order primitives/patterns, and connect behavior. Pages do not invent a
   sixth styling layer.

Move a solution downward only after repeated use proves that the lower layer owns the decision.
Do not create a public UI package merely because a component exists.

## 3. Page ownership

A page may:

- choose documented component variants;
- choose a primitive's gap, alignment, minimum item width, and column limits from supported tokens;
- supply content, actions, status, and slots;
- compose a genuinely unique widget from existing primitives.

A page must not:

- redeclare the page frame, content width, header spacing, section rhythm, or standard grid;
- impose a centered website-style maximum width on the application workspace; page content uses
  the full region assigned by the shell and creates structure through its internal composition;
- set raw colours, font sizes, borders, shadows, radii, or z-index values;
- reach into a component with descendant selectors;
- use `!important` to change a design-system component;
- copy component CSS to obtain a slightly different arrangement;
- introduce a breakpoint solely to repair a standard component;
- attach cosmetic mode conditionals to application behavior.

If a page cannot work with a component, first determine whether it needs an existing variant, a
new generally useful variant, a different composition, or a genuinely unique widget. A local CSS
override is not the default answer.

## 4. Layout primitives

Layout primitives own recurring spatial rules. The initial vocabulary should remain small:

- `Stack`: vertical rhythm between direct children;
- `Inline`: one-dimensional horizontal arrangement with wrapping and alignment;
- `Cluster`: wrapping group of independently sized controls or tags;
- `AutoGrid`: adaptive equal-role cells using a minimum item size rather than page breakpoints;
- `Grid`: explicit documented column arrangements for strong content relationships;
- `Split`: primary/secondary regions that collapse in a defined order;
- `Frame`: bounded full-height or aspect-constrained region;
- `ScrollRegion`: the explicit owner of overflow;
- `Divider`: semantic separation without ad hoc border declarations.

The parent owns the space between siblings. Children do not add external margins to position
themselves. Components own only their internal layout and documented size behavior.

Optional and swappable regions must compose intrinsically. Adding or removing a navigation bar,
rail, toolbar, panel, or secondary region happens in JSX and the surrounding layout adapts without
CSS changes. Do not hardcode a page or shell `grid-template` whose named rows or columns assume
optional children exist. Prefer stacking, flexible siblings, auto-flow, and content-driven tracks.
An explicit fixed grid is allowed only when every track represents an invariant relationship in
that component's contract—not merely the components currently present in one screen.

Open composition is the default. Lists, tables, forms, control groups, and grids should normally
be structured by spacing, alignment, typography, and occasional dividers—not enclosed in another
border. A bordered `Panel` is reserved for content that acts as an independent dashboard card,
widget, selectable region, or otherwise needs a meaningful boundary. Do not put a decorative
frame around an already bordered collection of controls.

Prefer intrinsic layout, `minmax()`, wrapping, and container queries. Viewport breakpoints belong
to application chrome or rare viewport-level behavior, not to individual pages compensating for
rigid components.

No primitive should encode a PHOENIX domain concept. `AutoGrid` knows about available width and
item constraints, not ships, engineers, or commands.

## 5. Components and variants

Components should be small enough to compose and substantial enough to own a visual contract.
`PageHeader` is a component because title hierarchy, optional context, actions, wrapping, and
spacing must remain consistent. A one-line wrapper that owns no behavior or design rule is not.

Variants are finite, named decisions rather than arbitrary style bags. For example:

- `PageHeader`: `standard`, `entity`, `compact`;
- `Panel`: `standard`, `quiet`, `interactive`, `danger`;
- `Button`: `primary`, `secondary`, `quiet`, `danger`;
- `AutoGrid`: supported minimum-size and density choices;
- command control: `available`, `active`, `macro`, `unavailable`, `dangerous` as semantic states.

A variant must describe why the presentation differs, not the page on which it appears. Avoid
names such as `engineering`, `dashboard-left`, or `specialPageHeader`.

Do not expose unrestricted style objects as an escape hatch. `className` may support identity,
instrumentation, or the root of a documented unique widget; it is not permission for pages to
restyle component internals.

## 6. Tokens and colour

The existing palette is the starting point. The design-system task is to regularize its roles,
not replace it casually.

Components consume semantic tokens such as:

- surface, raised surface, interactive surface, and selected surface;
- primary text, secondary text, subdued text, and disabled text;
- structural border, interactive border, and focus indication;
- accent, information, success, warning, danger, and destructive action;
- telemetry/provenance states where a normal status role is insufficient.

Raw palette values belong only in token definitions. Page and component files do not contain
literal colour values. A status must never be communicated by colour alone.

Spacing uses only `--spacing-xxs` through `--spacing-xxl`. Type sizes use only
`--font-size-xxs` through `--font-size-xxl`. A component may expose a documented semantic size
variant that resolves to these tokens; it may not introduce a private near-duplicate value.

Presentation-mode tokens may remap roles and geometry. They must not change the semantic meaning
of success, warning, danger, selection, availability, or focus.

Press feedback uses `:active` and is momentary. `:focus-visible` is a separate, persistent keyboard
navigation cue and must not be reused to simulate a click. Standard actions may flash the action
colour while pressed; dangerous actions retain their danger colour, and disabled controls provide
no press feedback.

## 7. Responsive and adaptive behavior

Every reusable component defines its own behavior under constrained width, long labels, larger
text, and touch input. Pages arrange components; they do not rescue them.

Required rules:

- grids adapt from available container width and declared minimum viable cell size;
- headers wrap actions without overlapping titles or truncating essential state;
- tables declare an intentional narrow-width strategy: scroll, priority columns, row cards, or a
  separate compact component;
- text truncation is allowed only when the complete value remains accessible;
- scroll ownership is explicit and nested scroll regions are exceptional;
- touch targets remain usable in both modes, regardless of visual density;
- ELITE mode may become visually heavier but must not reduce the amount of usable information
  below the component's documented contract.

Viewport breakpoints and component containers share the `xxs` through `xxl` naming scale.
Custom-property values document that scale for tooling and stories, but query conditions use the
matching literal values because CSS custom properties cannot be evaluated inside media or
container conditions. Orientation queries are allowed only when portrait or landscape geometry
materially changes the arrangement; orientation is not a proxy for device type or input method.

Standard data-display contracts:

- lists are open compositions with row separators; selection may add a semantic indicator and
  restrained surface, but the list does not gain a decorative outer frame;
- `DataTable` owns its overflow and exposes named narrow strategies rather than relying on a page
  wrapper;
- `scroll` preserves every comparison column inside a labelled, keyboard-focusable horizontal
  scroll region;
- `priority` lets the page mark genuinely optional columns as secondary or tertiary while the
  component owns when those columns disappear;
- identity, primary value, status, and row actions must not be marked optional merely to make a
  layout fit.

## 8. States are part of the component

Reusable components and patterns own their complete state matrix where applicable:

- default, hover, focus-visible, pressed, selected, and disabled;
- loading, empty, partial, error, stale, and unavailable;
- caution, dangerous, destructive, accepted, and confirmed where actions require them;
- short, long, missing, and overflowing content;
- pointer, keyboard, and touch interaction.

Pages must not create one-off state banners or opacity conventions for states already represented
by the system. Accepted input and confirmed in-game outcome remain visually distinguishable.

Navigation state is data, not an inline style. A navigation component receives the current item
identifier, adds the shared `.active` styling class, and emits `aria-current="page"` as accessibility
metadata. Its documented `selection` variant chooses strong or subtle presentation through
component variables. Callers never construct active-state CSS.

## 9. Accessibility

- Semantic HTML and accessible names are invariant across presentation modes.
- Focus is always visible and must not rely on the browser's colour being compatible by accident.
- Filled ELITE controls require verified foreground contrast in every state.
- Motion respects reduced-motion preferences.
- Mode, selection, warning, and availability are not conveyed only through colour or glow.
- DOM order follows reading and keyboard order even when a visual arrangement changes.
- Dense presentation does not justify tiny controls or illegible secondary text.

## 10. Unique widgets and exceptions

Unique widgets are expected for purpose-built surfaces such as symbolic cartography. They may own
local styles when all of the following are true:

1. no existing component or composition expresses the requirement;
2. the visual behavior is genuinely specific rather than merely inconvenient;
3. surrounding layout, typography, controls, and states still use system primitives/components;
4. local tokens reference semantic system tokens rather than raw values;
5. both presentation modes and constrained widths have an explicit outcome;
6. the exception is demonstrated in Storybook.

An exception must stay inside the widget root. It may not redefine page or application chrome.

## 11. Deskplane layout contract

Deskplane is the workspace transport, not the visual design system. It does, however, define the
environment in which every page and pattern must remain sound:

- each desktop receives a bounded workspace region rather than owning the browser viewport;
- application chrome remains outside the moving desktop surface;
- pages fill their assigned region without using fixed positioning against the viewport;
- one explicit region owns scrolling; the Deskplane viewport must not become the page scroller;
- component adaptation prefers container queries because a desktop's available region matters more
  than the browser's total width;
- viewport and orientation queries are reserved for shell-level changes or behavior that genuinely
  depends on the physical viewport;
- desktop transitions and transforms must not alter component sizing, focus order, or interaction;
- a page must remain valid when mounted beside other desktops, kept mounted while inactive, opened
  directly, restored after refresh, or displayed on a different device.

Storybook scenarios should place important compositions inside representative Deskplane-sized
containers. They do not need to reproduce Deskplane's movement engine unless the behavior under
test specifically concerns transitions, clipping, focus, or scroll ownership.

`ApplicationShell` owns the established top bar, horizontal primary navigation, compact utility/context
controls, bottom workspace navigation, and the single page scroll region. Presentation mode may
restyle that shell but must not replace it with a website navigation pattern. The parked `AppShell`
alternatives are reference proposals only, not application-shell variants.

## 12. Storybook is both contract and design laboratory

Every foundation, component, pattern, and approved exception is demonstrated without the live
PHOENIX backend.

The current application is reference material, not a specification that must be reproduced.
Storybook also hosts clearly labelled proposals that may:

- rename navigation, sections, actions, and recurring interface concepts;
- compare alternative information hierarchies and navigation models;
- rearrange views or split/merge existing surfaces;
- compare PHOENIX and ELITE presentations of the same capability;
- test a new composition before it becomes a production component;
- demonstrate why an existing pattern should be replaced rather than merely normalized.

Explorations are labelled `Proposal` and remain separate from accepted foundations/components.
When a direction is accepted, its reusable parts move into the normal component or pattern
catalogue and obsolete proposals are retired. Storybook must not become a museum of unresolved
mockups.

Stories should include, as relevant:

- both PHOENIX and ELITE presentation modes;
- normal, interactive, disabled, loading, empty, error, stale, dangerous, and selected states;
- desktop and tablet-sized containers;
- narrow containers, long labels, large values, and overflow;
- keyboard focus and touch-sized presentation;
- deterministic fixtures with no credentials, game process, provider, or local runtime data.

A new page-specific override is a design-system failure signal. Reproduce the need in Storybook,
then improve the component, variant, or composition before adding page CSS.

## 13. Review gate

UI work is ready when:

- the page is composed from documented primitives, components, and patterns;
- no standard layout or component is locally redefined;
- both modes produce a deliberate result, including an explicit PHOENIX fallback where ELITE
  styling is inapplicable;
- representative state and responsive stories exist;
- focus, keyboard order, contrast, overflow, and touch behavior have been checked;
- any unique widget exception is isolated and documented;
- new assets have recorded provenance and redistribution rights.
