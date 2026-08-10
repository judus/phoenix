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

PHOENIX discovers the active Elite Dangerous `.binds` preset automatically. Input execution uses
the non-injecting `recording` backend by default.

Linux live input is available through the X11/XWayland `xdotool` backend. It requires an accessible
X display and the `xdotool` executable. Enable it explicitly:

```sh
PHOENIX_INPUT_BACKEND=linux-xdotool \
npm run dev:server
```

The backend sends each modifier before the bound key and releases the chord in reverse order. Native
Wayland input will use a separate backend rather than weakening the platform-neutral action gateway.

## Persistence

PHOENIX uses SQLite through Node's built-in `node:sqlite` module. The default database is `data/runtime/phoenix.sqlite`; runtime data is ignored by Git.

See [the SQLite architecture decision](docs/decisions/0001-use-sqlite.md) for the reasoning and driver boundary.
