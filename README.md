# PHOENIX

PHOENIX is a local-first Elite Dangerous companion and the future independent home of the AI Copilot.

## Requirements

- Node.js 24.14 or newer
- npm 11 or newer

## Development

```sh
npm install
npm run dev
```

The backend listens on `0.0.0.0:3400`. Vite serves the development UI on `0.0.0.0:3401` and proxies `/api` to the backend.

## Verification

```sh
npm run check
```

The production build can be served by the backend:

```sh
npm run build
npm start
```

Open `http://localhost:3400` after building, or `http://localhost:3401` during development.

## Game controls

PHOENIX discovers the active Elite Dangerous `.binds` preset and a suitable input backend at startup.
User choices live in the generated, gitignored `data/settings.json`; detected system state is rewritten
to `data/runtime/system.json` on each launch. On Linux with an X11/XWayland display, `auto` selects
`xdotool` when it is installed.

The Controls page is a configurable 8 x 5 dashboard. Its command picker uses the complete safe action
catalogue discovered from Elite's active preset; empty cells stay empty until assigned. Layout changes
are saved through the server into `data/settings.json`, so desktop and tablet clients share one layout.

The initial settings are:

```json
{
  "version": 1,
  "controls": {
    "enabled": true,
    "backend": "auto",
    "layout": {
      "version": 3,
      "pages": []
    }
  }
}
```

On first launch PHOENIX fills `layout.pages` with the default Ship, Combat, Navigation, Vessel, SRV,
On Foot, Radio, Emote, and Miscellaneous grids.

The backend sends each modifier before the bound key and releases the chord in reverse order. Native
Wayland input will use a separate backend rather than weakening the platform-neutral action gateway.
Developers may override selection with `PHOENIX_INPUT_BACKEND=recording` or `linux-xdotool`; a local
`.env` file is loaded automatically when present.

## Persistence

PHOENIX uses SQLite through Node's built-in `node:sqlite` module. The default database is `data/runtime/phoenix.sqlite`; runtime data is ignored by Git.

Copilot conversations deliberately use inspectable JSON files under `data/conversations/`. Each file is
written atomically and implements the reusable AI package's optimistic `ConversationStore` contract.

See [the SQLite architecture decision](docs/decisions/0001-use-sqlite.md) for the reasoning and driver boundary.

## Copilot development

The portable PHOENIX Copilot application layer lives in `packages/copilot`. Provider communication,
resilient streaming, MCP loops, and history selection remain in the sibling
`/home/maduser/workspace/maduser-ai-ts` repository, currently consumed as a local npm `file:` dependency.
Build that package after changing it, then run `npm install` in PHOENIX if its dependency metadata changed.

Set `PHOENIX_OPENAI_API_KEY` or `OPENAI_API_KEY` to enable `POST /api/copilot/chat`. Send
`Accept: text/event-stream` for streamed events. The default model, timeout, retries, and wire logging are
configurable through the variables documented in `.env.example`. Raw diagnostic events are written to the
gitignored `data/runtime/openai-wire.ndjson`; obvious credential field names are redacted.

The server also exposes a local Streamable HTTP MCP endpoint at `/mcp`. Configured Copilot clients discover
PHOENIX tools there rather than importing server internals. The initial tool surface provides a fresh compact
commander snapshot, focused action search, generic action execution, and telemetry-confirmed switch setting.
Both the control grid and Copilot tools use the same platform-neutral game-action gateway.

Realtime voice uses the same agent profile, runtime state, tools, and JSON conversation as text chat.
Connect it from the Copilot page on the PC that owns the microphone and audio output; the provider lives
above page routing, so voice remains connected while navigating PHOENIX. Live spoken and typed Realtime
turns appear in the shared conversation and are persisted when complete. The WebSocket audio transport uses
an ephemeral browser token, AudioWorklet microphone capture, and the configurable effect chain in
`agents/icarus/audio.json`; the standard API key never leaves the server.
