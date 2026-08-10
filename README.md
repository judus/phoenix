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

Linux live input is available through the display-server-independent `ydotool` backend. It requires
`ydotool` 1.x and a running `ydotoold` socket owned by the PHOENIX user. Enable it explicitly:

```sh
PHOENIX_INPUT_BACKEND=linux-ydotool \
YDOTOOL_SOCKET=/run/user/1000/.ydotool_socket \
npm run dev:server
```

The Ubuntu 24.04/Linux Mint 22 package is currently `ydotool` 0.1.8 and does not implement the raw
key-event protocol required for reliable press and release operations. PHOENIX detects and rejects
that version rather than enabling a partially functional backend.

## Persistence

PHOENIX uses SQLite through Node's built-in `node:sqlite` module. The default database is `data/runtime/phoenix.sqlite`; runtime data is ignored by Git.

See [the SQLite architecture decision](docs/decisions/0001-use-sqlite.md) for the reasoning and driver boundary.
