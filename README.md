# PHOENIX

> **Work in progress:** PHOENIX is under active development and is not ready for public use—or unsupervised operation of suspiciously red buttons.

PHOENIX is a local-first companion application and ship-computer interface for Elite Dangerous. It turns live telemetry, journal history, control bindings, public galaxy data, and an optional AI Copilot into one cockpit for desktop, tablet, and auxiliary displays.

Its three workspaces—**Controls**, **Information**, and **Copilot**—currently provide:

- commander, inventory, progression, current-ship, fleet, cargo, and loadout views;
- system cartography, plotted routes, exploration data, and a galaxy query console;
- missions, engineering, communications, contacts, GalNet, and journal history;
- configurable ship-control decks, semantic macros, and a Numpad command navigator;
- synchronized multi-device navigation and display commands;
- a persistent AI Copilot with text, realtime voice, live context, and application tools.

The Copilot can:

- converse through persistent text chat or low-latency realtime voice;
- answer situational questions using current commander, ship, cargo, location, and navigation telemetry;
- inspect ships, modules, inventory, materials, missions, routes, systems, stations, and markets;
- find and execute configured ship controls, with telemetry-aware status checks;
- open system and body information for the commander across connected PHOENIX screens.

Development currently targets Node.js 24.14+:

```sh
npm install
npm run dev
```

Open `http://localhost:3401` for development. To build and serve the production application on
`http://localhost:3400`:

```sh
npm run build
npm start
```

Copilot is optional and uses `PHOENIX_OPENAI_API_KEY` or `OPENAI_API_KEY` when configured. See
[`.env.example`](.env.example) for ports, paths, models, input backends, and other overrides.

Expect incomplete features, breaking changes, and no installation support yet. PHOENIX reports
unknown data as unknown and distinguishes “command sent” from “ship definitely did the thing.”
