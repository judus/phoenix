# React guidance and upgrades

PHOENIX is a client-rendered React/Vite application, with a Strict Mode root in
`apps/web/src/main.tsx`. Use [React's API reference](https://react.dev/reference/react) and
[release notes](https://react.dev/blog) for the version actually installed. The live documentation
tracks the latest minor version, not every older minor; check the
[versioning explanation](https://react.dev/versions) before using newly documented APIs.

## Agent guidance

Keep always-on instructions in AGENTS.md small and use the existing UI, release and audit skills
for their respective tasks. This follows the useful guidelines-versus-skills split in
[Laravel Boost](https://laravel.com/framework/docs/boost), without adding Laravel tooling here.

Reviewed 2026-10-06: the official React repositories do contain AI instructions.
[React core's instructions](https://github.com/facebook/react/blob/17eca7b0263abbe4aeaa2f5b149c5071b0890f06/.claude/instructions.md)
describe its Yarn/Flow/build workflows; the
[documentation site's instructions](https://github.com/reactjs/react.dev/blob/046f17d04295ba047bb5739026b4ac3110f17028/CLAUDE.md)
and [react-expert skill](https://github.com/reactjs/react.dev/blob/046f17d04295ba047bb5739026b4ac3110f17028/.claude/skills/react-expert/SKILL.md)
target documentation research and contribution. These are not a shipped downstream application
skill or PHOENIX conventions. No official downstream skill was confirmed in that review.
Use their authoritative source-first approach, not their repository-specific rules.

## Upgrade checks

- Inspect `npm ls react react-dom react-test-renderer @types/react @types/react-dom` and the
  resolved lockfile, rather than relying on manifest ranges alone.
- Upgrade React, React DOM and the test renderer together; check the corresponding type packages
  and declared peers. Keep one resolved React installation for the application and UI workspace.
- Inspect installed Deskplane and Control Deck packages. Do not rebuild or modify another owner's
  runtime merely to silence a peer warning; investigate actual API usage and bundled dependencies.
- Keep the upgrade scoped: do not adopt new APIs, animations or a compiler as an incidental change.
- Validate a clean install, strict production/test types, tests and builds. Exercise the real shell
  in an isolated browser, including workspace navigation, input and live updates, in both themes
  and orientations. Browser evidence is not physical-tablet or real-Elite acceptance.

## React 19.3 compatibility checkpoint

The [19.3 release](https://react.dev/blog/2026/09/09/react-19-3) was evaluated on 2026-10-06.
Deskplane 0.1.4 declares React/DOM `>=18.3.0`; react-markdown 10.1.0 declares React `>=18`.
The PHOENIX Control Deck runtime 0.1.13 contains no React dependency or bundled React code.
React DOM and the test renderer 19.3.0 both require React `^19.3.0`; React DOM's type package
19.3.0 requires matching React types. PHOENIX updates these together without adding new APIs.
It does not hydrate server-rendered HTML or use React Server Components; checks still cover its
external stores, lazy/Suspense pages, forms and Deskplane composition.
