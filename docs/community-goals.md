# Community Goals

Activities → CMG shows the campaigns currently listed by Frontier, their official briefings,
destinations, objectives, global contribution totals and targets. It requires neither AI nor a
Frontier account. Destination links open the system schematic; a station/megaship might not yet
be present in community cartography even though Frontier lists it as the campaign destination.

## Source and freshness

Source: [Frontier Community Goals](https://www.elitedangerous.com/community/goals/).
The site's listing component uses
`https://www.elitedangerous.com/elite-proxy/2.0/website/initiatives/list?lang=en`.
Verified on 2026-10-07. This is a public website endpoint, **not a documented supported developer
API**. `FrontierCommunityGoalsSource` isolates it, validates required fields and converts decimal
quantity strings to safe nonnegative integers. A zero/invalid target is rejected rather than
producing a misleading progress percentage. Additive provider fields do not break the adapter.

The application uses the existing SQLite provider cache with a 15-minute TTL and coalesced
concurrent refreshes. Requests are bounded by a 20-second network timeout. While the page is open,
it requests an update every 15 minutes; navigation back also requests the current snapshot.
No new always-running worker, per-commander credentials, subscriptions or AI requests are involved.

The API response includes the source fetch timestamp and `fresh`, `refreshed` or `stale` cache
status. A failed or malformed refresh preserves the last valid snapshot, including an empty one,
and the UI warns that availability/progress may have changed. Without any valid snapshot, failure
is an error, **not** an empty list. A successful empty list replaces the previous list; it does not
establish why earlier goals disappeared. These are current snapshots, not a goal-history archive.

Frontier's `expiry` is a wall-clock string with **no timezone supplied**. PHOENIX preserves it and
labels it “Frontier time”; it only applies Elite's calendar-year offset for display. It does not
convert this value through the browser's local timezone or infer a completion instant from it.
The source's current listing is not proof of personal participation, reward eligibility or tier.
Numeric progress is the reported total/target, not an inferred success or completion flag.
Briefings are rendered as text paragraphs, never executable HTML.

## Ownership and follow-ups

- Contracts: `packages/contracts/src/community-goals.ts`.
- Server: source port/Frontier adapter and `CommunityGoalsService`; the existing provider cache owns storage.
- HTTP: paired `GET /api/operations/community-goals`.
- Browser: the existing Activities controller and Community Goals route.
- #121: this non-AI listing slice; #60: optional GalNet intelligence/investigation leads.
- #36: personal participation/progress from journal events; separate scope and gameplay validation.

Later Atlas activity markers and Copilot tools should consume the same authoritative read model,
not scrape briefing text again or add transient campaigns to the permanent landmarks catalogue.
