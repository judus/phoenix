# Navigation and shell proposals

Status: parked website reference; not the PHOENIX tablet-shell direction

## Shared shell contract

The two proposals intentionally share one semantic and layout contract:

- PHOENIX/ELITE presentation mode does not choose the navigation arrangement;
- navigation, application status, and utilities remain outside the page scroll region;
- the workspace is the single normal scroll owner;
- adaptation responds to the shell's assigned container width, including a Deskplane region;
- DOM order and navigation labels remain stable when the visual arrangement changes;
- essential state such as game connectivity remains visible at constrained widths;
- narrow navigation becomes a horizontally scrollable band rather than wrapping into several
  unpredictable rows.

## Proposal A: workspace sidebar

The primary destinations occupy a left sidebar on wider workspaces. Secondary destinations remain
in a bottom band.

Strengths:

- scales better when destinations have meaningful names, badges, or changing counts;
- keeps page width and navigation hierarchy visually distinct;
- leaves the header available for global state and utilities;
- collapses into the same compact band behavior when its container becomes narrow.

Costs:

- consumes horizontal workspace width;
- is less reminiscent of Elite's cockpit panels;
- requires a clear distinction between primary navigation and contextual page navigation.

## Proposal B: cockpit bands

Primary destinations occupy a top band and secondary workspace destinations occupy a bottom band.

Strengths:

- closer to the existing application and Elite cockpit rhythm;
- preserves maximum page width;
- creates strong spatial anchors at the top and bottom of the workspace.

Costs:

- many destinations compete for horizontal space and may require scrolling;
- badges and long translated labels are harder to accommodate;
- two horizontal navigation bands can visually dominate data-heavy pages.

## Current disposition

Do not use either proposal as the PHOENIX application baseline. They remain in Storybook only as
possible reminders for a future website or another desktop-first surface. PHOENIX keeps its
existing tablet-oriented shell: top bar, horizontal primary navigation, compact square utility and
context controls, bottom workspace navigation, and a single scrolling content region.
