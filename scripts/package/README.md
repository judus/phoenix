# Payload tooling

`npm run payload:build` creates a platform-specific, storefront-neutral PHOENIX payload under `dist/payload/`. It contains compiled application code, curated resources, production dependencies, and the Node runtime executing the build.

`npm run payload:verify` checks every staged file against `manifest.json`. `npm run payload:smoke` starts a temporary copy in installed mode and verifies that mutable state is written to isolated platform user directories. Linux additionally makes the temporary installation read-only.

The manual `Payload proof` GitHub Actions workflow runs this sequence on Linux and Windows and uploads short-lived artifacts. These artifacts are engineering evidence, not public releases or installers.
