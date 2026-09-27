# Local tool-error validation build

`jdu-llm-client-0.1.2.tgz` is a locally built, patched 0.1.2 package from
`/home/maduser/workspace/maduser-ai-ts`, not the published 0.1.2 artifact.
It adds public `ToolUsageError` correction hints and preserves MCP error text.
PHOENIX server and Copilot explicitly consume this archive pending approval to
publish the shared library. Replace both dependency references with the new
registry version after release. Do not publish this patched build as 0.1.2.

Build: run `pnpm run build` in the library, then `npm pack --ignore-scripts
--pack-destination /home/maduser/workspace/control-deck-suite/phoenix/vendor/llm-client`.
Reinstall the archive in both workspaces and run PHOENIX checks after changes.
