# Query suggestions

The first slice covers shipyard hulls, outfitting modules, and commodity markets only.
Reference-system, station and faction names are not a local game-item catalogue.

- Existing generated JSON snapshots remain authoritative for Elite commodity symbols and names.
- Spansh station field values supply accepted ship and module names. Both fields return
  composite `values.name` arrays. Providers cache these vocabularies for 24 hours in memory;
  failed fetches are retryable. Suggestions do not assert current station stock.
- `CatalogueSuggestionService` composes the vocabulary; `matchCatalogueSuggestions` in
  `@phoenix/elite` owns bounded, ranked matching. It is reusable by server-side consumers,
  including future Copilot resolution, without browser-specific aliases.
- A suggestion has a display label, a submitted value, and its vocabulary source. Module
  class/rating prefixes are retained. Commodity submissions use Elite symbols. Spansh
  submissions retain exact provider spelling. Input tolerance is not a new vocabulary.
- Partial or ambiguous input returns choices, not an automatic choice of item. Manual input
  remains possible if suggestions are missing or unavailable. No inferred module names are
  promoted to provider-supported suggestions.
- The authenticated `GET /api/galaxy/suggestions?kind=ship|module|commodity&q=...` endpoint
  returns at most 12 matches. It replaces the old module-names-only UI endpoint.
- Saved query strings, execution semantics, catalogue snapshot formats, and SQLite schemas
  are unchanged. No migration or catalogue refresh is required by this feature.

The UI debounces requests, aborts superseded requests, and supports pointer selection,
arrow-key selection, Enter, and Escape. Shell/Catalogue suggestions in Storybook exercises
the actual query editor in the PHOENIX workspace, with deterministic provider fixtures.

Catalogue files loaded by the existing readers are cached for the process lifetime. This
slice does not introduce hot reload, an encyclopedia, descriptions, or a SQL reference store.
