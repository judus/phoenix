# Legacy behavior boundaries

These styles remain production-owned during the Storybook design-system migration. Do not delete or replace them merely because a replacement page looks equivalent.

| Surface | Production owner | Behavior that must survive replacement | Removal gate |
| --- | --- | --- | --- |
| Deskplane workspace | `primitives/desktop-workspace.css` plus `deskplane/style.css` imported by `main.tsx` | Full-height viewport, transformed desktop movement, swipe zones, fixed top row and bottom switcher, correct initial desktop sizing | Exercise all desktop and utility-row transitions after a cold refresh at desktop and tablet widths |
| Controls | `patterns/control-grid.css` | Viewport-fitted command grid, category rail, edit compression, active/dangerous states, macro cells, no page scroll | Execute a bound action and a macro; edit/save a layout; verify compact tablet layout |
| Copilot | `patterns/copilot.css` | Independently scrolling transcript, bottom-anchored composer, profile views, Realtime voice controls, full-height desktop containment | Text and voice turns complete; transcript order/scrolling and profile editing work on desktop and tablet |
| Numpad | `patterns/numpad.css` | Keyboard activation, status strip, computed tile rows/columns, exact/ambiguous states, shortcuts editor | Activate globally with `0`; navigate, execute, cancel with `.`, and test Enter-confirm mode |
| Journal | `patterns/journal.css` | Live-follow list, independent list/inspector scrolling, filters, selected raw payload, compact breakpoint | Receive a live journal event, filter/select it, and verify both panes remain usable |
| System schematic | `features/navigation/system-schematic.css` | Symbolic body hierarchy, attached installations, selection details, horizontal cartography scrolling, responsive selection panel | Load a populated system, select body and installation, clear selection, and verify narrow layout |

The first five files are temporary migration boundaries. The System schematic is already feature-owned and is expected to survive the general legacy stylesheet retirement.
