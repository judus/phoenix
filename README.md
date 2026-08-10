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

The initial settings are:

```json
{
  "version": 1,
  "controls": {
    "enabled": true,
    "backend": "auto"
  }
}
```

The backend sends each modifier before the bound key and releases the chord in reverse order. Native
Wayland input will use a separate backend rather than weakening the platform-neutral action gateway.
Developers may override selection with `PHOENIX_INPUT_BACKEND=recording` or `linux-xdotool`; a local
`.env` file is loaded automatically when present.

## Persistence

PHOENIX uses SQLite through Node's built-in `node:sqlite` module. The default database is `data/runtime/phoenix.sqlite`; runtime data is ignored by Git.

See [the SQLite architecture decision](docs/decisions/0001-use-sqlite.md) for the reasoning and driver boundary.
