# PHOENIX

> **Work in progress:** PHOENIX is under active development and is not ready for public use.

PHOENIX is a local-first companion application for Elite Dangerous, built around live game telemetry, ship controls, exploration tools, and an AI Copilot with text and voice interaction.

It currently provides:

- live commander, ship, location, journal, navigation, and exploration data;
- configurable ship-control panels for desktop and tablet;
- system cartography, engineering, cargo, inventory, and activity views;
- a persistent AI Copilot with text, realtime voice, telemetry, and tools.

The Copilot can:

- converse through persistent text chat or low-latency realtime voice;
- answer situational questions using current commander, ship, cargo, location, and navigation telemetry;
- inspect modules, inventory, materials, routes, systems, and ship specifications;
- find and execute configured ship controls, with telemetry-aware status checks;
- open system and body information for the commander across connected PHOENIX screens.

Development currently targets Node.js 24+:

```sh
npm install
npm run dev
```

Expect incomplete features, breaking changes, and no installation support yet.

## Acknowledgements

Thanks to [Iain Collins](https://github.com/iaincollins), author of [ICARUS Terminal](https://github.com/iaincollins/icarus), for the inspiration and the valuable lessons learned from his work.
