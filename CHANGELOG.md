# Changelog

Player-visible changes are recorded here. Unreleased entries are not available in an installer yet.

## Unreleased

- Add a journal-only Fleet Carrier WIP proposal: management identity, observed location/jumps,
  fuel, capacity, finances, permissions, service snapshots, associated personal stored ships
  and bounded event history. Unknown data stays unknown; no CAPI or complete visitor/trade ledger.

- Add a journal-only Colonisation WIP proposal: last-observed construction sites and
  supply balances, separate claim/release observations and personal contribution history.
  Contributions do not imply ownership or locally advance global construction totals.

- Add a journal-backed Powerplay proposal under Activities → PWR: pledge/rank/merits
  overview, observed activity, and a player-entered module/perk target. Preserve fractional
  merits and unknown state; target progress does not assert an in-game reward unlock.
  The header marks the feature as work in progress pending gameplay validation.

- Reduce SQLite startup disk writes by committing each base schema as a single transaction,
  including EDDN storage. Keep later migrations independently committed and retain normal
  durability; failed schema setup rolls back cleanly before retrying.

## 0.1.7 — 2026-10-10 (prerelease)

- Add attached-label input groups: notes search moves into the header with a compact [+] action,
  deck editing gets visible Layout/Columns/Rows/Theme labels, and the schematic system loader
  attaches its submit button directly to the input.

- Add the NTS workspace between INF and CPT in the bottom rail, with optional mission/location links, player/Copilot
  authorship, and explicit permission-controlled Copilot search/read/write tools. Mission
  details can open a linked note; notes remain available after the mission ends. Cards show
  short notes directly and expand longer text; titles/text may be blank. Mission links show
  ledger titles and select that mission; location links open the matching schematic selection.
  Note-icon actions in schematic system tools, body/station details and Atlas POI details open
  a new note with its location already linked.
  Body detail places compact bookmark/note icons together below the body glyph.

- Enrich on-foot mission briefs with known activity/conditions, separate targets, required items
  and kills, and mission-tagged backpack/locker observations. Keep expected credits separate
  from received credits/material rewards and share the same brief with Copilot.

- Align deck edit-bar action buttons with the full height of the layout-settings panel.

- Show a translucent button preview following your finger while relocating deck buttons,
  including small movements before the move threshold is reached.

- Use scalable square tactile grips, aligned with button text insets. In deck edit mode,
  the same grip becomes a bright drag handle without changing its shape or touch target.

- Remove tactile grips from small action buttons and align deck management actions with the
  existing form-button styles and Save changes / Cancel labels. Use compact, bordered square
  icons with accessible labels for deck-row actions instead of crowded text buttons.

- Manage personal control decks: create, rename, reorder and delete decks; the Controls rail and
  Numpy follow saved deck identity and order. Existing decks remain editable starting defaults.
  Resizing refuses to discard configured buttons, and layout presets are available on every deck.

- Experiment with an optional orthographic 3D Galactic Atlas: tilt/orbit the reference plane,
  show real POI heights with connecting lines, and return to top-down without losing map selection.
  Keep its floating controls grip-free and remove the map's browser focus outline.

- Zoom twice as close on the Galactic Atlas to separate nearby Bubble locations more easily.

- Keep Atlas bookmark, Community Goal and GalNet lead markers visible while their layers refresh,
  replacing each marker set together instead of flickering when switched back on.

## 0.1.6 — 2026-10-09 (prerelease)

- Keep entering Copilot chat responsive with long conversations: initially show recent messages,
  load older messages on demand, and preserve your reading position instead of forcing a jump.

- Keep Copilot text turns running across workspace switches and when a tool opens another page. Returning to chat preserves
  the pending exchange and its completed history instead of silently cancelling and losing it.

- Let Copilot open the Galactic Atlas and show a system, centred with its location details.
  The new Atlas tool lives under Display permissions and checks coordinates before navigating.

- Browse and search retained GalNet articles independently of the latest feed. Open related
  coverage inside PHOENIX with its source and saved analysis, even after it leaves the feed;
  archive browsing stays local and never runs AI.

- Give Copilot the reconciled GalNet lead picture rather than original activity counts. Keep
  source-backed resolutions, replacements and campaign links alongside unchanged original reports;
  uncertain or conflicting leads remain visible, including those without a map destination.

- Refresh saved GalNet stories automatically when earlier related coverage is analysed or changes,
  while background analysis is enabled. Process dependencies oldest-first, reuse valid cached
  reports and keep failed unchanged evidence from retrying itself.

- Keep Community Goal activities out of editable GalNet story leads. Constrain analysis updates
  to the supplied independent lead IDs; campaign-only stories can still produce a story summary.

- Accept harmless added outer quotation marks in GalNet evidence and retain the original source
  passage. Keep wording and punctuation validation strict, without automatic paid retries.

- Connect related GalNet articles into a source-backed story update within the existing analysis
  request. Keep original reports and dated campaign references; retire only explicitly reconciled
  earlier Atlas leads, leaving unrelated or uncertain activities visible. Changed source context
  invalidates those decisions. Copilot reads the same saved story without another analysis call.

- Prototype optional background GalNet analysis for newly received or revised news and changed
  Community Goal briefings. Add a persistent queue, daily attempt limit, visible failures and
  explicit historical catch-up. Show related saved coverage in publication order; shared subjects
  do not automatically merge stories or retire Atlas leads. Background AI is off until enabled.

- Color-code Atlas sources: magenta investigation leads, green Community Goals, cyan bookmarks
  and amber landmarks.

- Accept harmless whitespace and straight/curly quote differences in GalNet analysis evidence,
  saving the original source passage. Keep wording checks strict and identify rejected quotes in
  errors. Simplify Atlas destination notices; keep older-report update notices beside the article.

- Show explicitly located GalNet investigation leads as a separate Atlas layer, with source quotes,
  dates and uncertainty. Community Goal references stay in the CG layer; unresolved destinations
  remain unplotted. Older reports need an explicit analysis update; opening the Atlas never runs AI.

- Let Copilot read saved GalNet analysis summaries and individual reports through separate Comms
  permissions, retaining sources, uncertainty and dated Community Goal references. Reading does not
  trigger analysis or refresh sources.

- Analyse individual GalNet articles on request using your configured AI, with evidence quotes,
  separate investigation leads and references to existing Community Goals rather than duplicate
  goals. Save reports with source revisions, CG snapshot freshness and token usage; unchanged
  evidence reuses the saved analysis. Automatic work has its own optional setting.

- Retain observed GalNet articles and distinct revisions locally, including source references and
  dates, as a foundation for future analysis. The latest-news feed is unchanged; no AI runs.

- Show Community Goal destinations as a separate CG layer on the Galactic Atlas, with official
  objectives, progress and freshness in the location panel. Green diamond markers distinguish them
  from bookmarks; unresolved coordinates stay unplotted.

- Let Copilot read official Community Goals on request, including briefings, destinations and
  source freshness, with a separate Activities permission for the installation and each profile.

- Show current Frontier Community Goals under Activities, with official briefings, global progress,
  expiry and destination links. No AI or Frontier account required; failed refreshes are marked stale.

- Give an incomplete old journal tail one extra refresh to finish during rotation, preserving
  event order while allowing permanently truncated files to give way to newer gameplay journals.

- Retry EDDN capacity-loss counts when a signal batch could not enter the queue and the initial
  counter write failed, including after opt-out; no extra payload queue or receipt growth.

- Align the browser authorization card with the Android pairing layout: grouped logo/title,
  help text below, and one divider spanning the content width. Pairing behavior is unchanged.

- Focus the chat composer on entry and keep it editable while Copilot replies, preserving the next
  draft and returning focus after Send without stealing it when a response arrives. Keep its orange
  border without the extra blue focus outline.

- Add a read-only Copilot engineering-project report with planned upgrades, shared material
  requirements and inventory shortfalls. Give it its own installation and per-profile permission;
  unavailable inventory stays unknown and personal-equipment previews are not treated as saved projects.

- Restrict Android shell HTTP pairing to numeric private, link-local or loopback addresses;
  reject public HTTP destinations and HTTP hostnames. HTTPS keeps normal certificate validation.

- Shorten Numpy's invalid-address status to “No match”.

- Add an experimental Android tablet shell that loads PHOENIX from your computer, remembers
  its connection and pairing session, and provides fullscreen, keep-awake and Android Back navigation.
  Its Phoenix-branded connection card supports local QR scanning or manual URL/code pairing,
  without a second browser form. Add the Phoenix logo to browser device authorization too.
  Hide the redundant F11 fullscreen button inside the Android app, while keeping it in browsers.
  Return revoked devices to pairing globally, including idle pages; the APK reopens its QR/manual card.
  Add `npm run android:install` to build, select/connect a debug device, reinstall and launch the app.

- Correct EDDN's gated-build status: pending uploads are cleared, not held for a future release.
  Document offline recovery, downtime omissions and unchanged retention limits, with an explicit
  real-game/native acceptance checklist.

- Preserve the observed first-footfall flag in EDDN scan contributions. Verify public Powerplay
  and colonisation station metadata without uploading personal progress or unsupported events;
  community publishing remains test-only.

- Drain unread live-journal tails and intervening files in order during rotation. Preserve EDDN
  context, pending signals and commander-log grouping across explicitly linked session parts,
  while retaining new-session resets and latest-file-only startup replay.

- Checkpoint open EDDN discovery-signal batches in the bounded local outbox, recovering validated
  batches after a crash without replaying journal history. Count unresolved recovery and oversized
  batches as skipped; retain privacy/session boundaries and test-only delivery.
- Keep durable EDDN delivery totals for expired, invalid, rejected and capacity-skipped observations,
  with deliberate queue clears counted separately. Show them in Settings and DEV even after a
  successful upload, restart or attempt-history expiry; keep existing retention and retry policies.
- Show a subtle Phoenix highlight animation while page content loads, respecting reduced motion
  without delaying navigation or replacing error feedback.
- Keep live journal ingestion responsive by yielding between bounded record batches, and drain
  in-flight journal projections before shutdown closes their dependencies. Add an isolated,
  repeatable startup/tail/backfill HTTP/SSE performance diagnostic.
- Group galaxy provider/query wiring in one explicit composition boundary, preserving shared
  providers, source overrides, query caching and application-owned startup/shutdown.
- Separate Fleet SQLite operations from the database lifecycle owner, retaining shared storage,
  existing ordering and validation, and atomic stored-module snapshot replacement.
- Isolate Engineering catalogue and project HTTP handling behind a plain feature handler,
  preserving validation, pairing, project notifications and existing response contracts.
- Distinguish invalid Settings requests (400) from storage and service failures (500),
  preserving validation feedback without blaming valid input for server-side failures.
- Isolate Settings HTTP handling behind a plain function and shared JSON helpers, preserving
  pairing, endpoint behavior and response contracts without introducing a routing framework.
- Report malformed, empty and oversized EDDN settings requests as client errors, while keeping
  actual preference-service failures distinguishable as server errors.
- Ignore unread journal buffer bytes after a short filesystem read, preserving incomplete records
  for the next poll rather than skipping them or reporting spurious parse errors.
- Complete application cleanup even when a subsystem fails to stop, and preserve startup failures
  alongside rollback errors instead of leaving later resources running.
- Split the Copilot profile editor into Profile and Permissions tabs, with a one-third-width
  roster, pinned Save/Create actions and profile AI load, and immediate permission-save feedback.
- Move New profile into the Profiles page header, keeping it accessible while the roster scrolls.
- Update the UI to React 19.3 with matching DOM renderer, test renderer and type definitions.
- Update source-map tooling to fix malformed indexed source-map denial of service.
- Use the published LLM client package for Copilot tool-correction hints and MCP error feedback,
  replacing the patched local archive.
- Navigate back in Numpy with Backspace: erase a pending digit or return to the parent menu.
- Restore Numpy's root shortcut 4 to the Macros library and align the Cancel header with its keys.
- Shorten Numpy's ambiguous-address prompt to keep the status row compact.
- Place Settings and Developer tools after Log in the top workspace row for horizontal swiping.
- Require a distinct installer-verification CI gate before merging releases into main.
- Keep EDDN validation dependencies bundled in installers while preserving development startup.
- Fix development server startup when loading EDDN schema validation through tsx.
- Strengthen regression tests for loadouts, journal ownership, contribution file limits and command
  safety; consolidate duplicated test helpers and make event-stream tests independent of network chunking.
- Add strict compilation of TypeScript tests and helpers to the development and native CI checks.
- Keep the Atlas quiet by default, with opt-in catalogue landmarks, sidebar Finder, explicit
  filtered state and reset controls; order header actions Regions, Bookmarks, Landmarks, Finder.
- Expand the Galactic Atlas with cached GEC and Canonn Guardian POIs, compact text/category
  filters, source-backed site details and Live coordinates for Jameson's crash site.
- Avoid duplicate installer builds after merging into main; keep native packaging checks on
  promotion PRs, manual CI runs and tagged releases.
- Copilot Profiles highlights the profile being edited, uses the ship-catalogue-style roster, and keeps
  supporting header text in the compact top-right status slot.
- Show AI load only for individual Copilot profiles, not the installation-wide permission ceiling.
- Credit the community-maintained Elite Dangerous Wiki and use standard breadcrumbs on Credits,
  Commander log and Macros.
- Expand Credits with missing catalogue, Atlas, recipe-reference, contribution and font attributions;
  correct provider descriptions and starter-catalogue notices.
- Consolidate installer and real-play acceptance evidence, with explicit outstanding platform,
  tablet and gameplay checks for each build.
- Add an opt-in, read-only EDDN upstream checker for reviewing schema and protocol changes;
  submission behavior remains unchanged.
- Correct pre-Odyssey exploration guidance and ship an editable Stratum candidate saved query for new profiles.
  Existing profiles can add predefined queries from the Saved Queries header without overwriting their edits.
- Restore workspace swipes across page and table scroll surfaces; CTR and CPT now remember
  their last pages, while a first visit to CTR uses the first configured deck.
- Allow workspace swipes starting on ordinary control-deck tap buttons without firing commands;
  retain protected hold/arming buttons and edit-mode dragging.
- Retain journal system coordinates for Atlas bookmarks, including visited systems absent from
  EDSM; rebuild retained coordinates from journals and distinguish lookup errors from unknown positions.
- Atlas selection details use a side panel (below the map on narrow screens); system names link
  directly to their schematics, with a compact current-position footer.
- Align cartography sidebars with a subtle gradient and map/panel spacing; tap empty Atlas map
  space to dismiss selection, retaining panels while panning or pinching.
- Galaxy opens on the Atlas, initially centred and zoomed around your position. Remove the
  redundant Whole galaxy/Locate me buttons; keep keyboard Home for the whole-galaxy view.
- Move fleet-carrier visibility into the schematic header and give carriers a distinct shared icon.
- Preview previously visited systems in a plotted route without changing in-game targeting.
- Add compact blueprint search and saved-query text/type filters; use display labels for effects.
- Show the commander dashboard log newest first, without scrolling to the oldest entry.
- Put Projects last in Engineering navigation; keep Equipment's preview-only Upgrade planner last as PLN.
- Move Engineering's New project action to the page header and show project settings only when Edit project is selected.
- Open the active Copilot profile editor immediately; keep manual selection and unsaved edits safe.
- Inset dropdown chevrons, reduce the visible edit grip without shrinking its touch target, and
  show Numpy cancellation keys beneath a Cancel label.
- Remove the Module Health threshold count; retained conditions remain explicitly last reported.

## 0.1.5 — 2026-10-05 (prerelease)

- Move individual Control Deck buttons to empty slots or swap occupied slots in edit mode.
- Numpy follows saved deck order: Quick access starts at 011, Ship at 012. Macros are reachable
  through their assigned deck buttons, not a separate generated address.
- Rapid Numpy entry no longer waits for intermediate views to render, including cold console opens.
- Restore README screenshots and add direct Windows installer and Linux AppImage download links.

Earlier preview details are available in [GitHub Releases](https://github.com/judus/phoenix/releases).
