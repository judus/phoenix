# Development and releases

## Branches

- `main` is the public default and release-ready branch. Never use it for routine development.
- `dev` integrates upcoming work. Use short-lived feature/fix branches from `dev` and PRs back to it.
- Promote `dev` to `main` with a PR after native CI passes. Use a **merge commit** for this
  long-lived branch promotion, not squash/rebase, so their shared history remains intact.
- Synchronize `main` back into `dev` through a PR after promotion; hotfixes must also return to `dev`.
- `dev` requires `CI passed`; `main` requires `Installers passed`, both from GitHub Actions,
  with up-to-date branches and a PR. Ordinary source checks cannot satisfy the promotion gate.
  Required human approval count is zero
  for this solo-maintainer repository; this does not waive CI. Force pushes/deletion are blocked,
  including for administrators. Feature branches can use squash merges.

Only PHOENIX is covered here; Control Deck has its own independent repository/release process.

## Automation

`ci.yml` runs on pushes and pull requests to `dev`/`main`, and manual dispatch. It calls the same
native verification workflow on Ubuntu 24.04 x64 and Windows Server 2022 x64 with Node 24.14.0.
Every run executes `npm ci` and `npm run check`. Pull requests into `main` and manual
CI runs additionally verify the native packages: Linux verifies the pinned AppImage runtime,
helpers and file hashes, then smoke-tests AppRun and the image's extract-and-run lifecycle;
Windows installs, smoke-tests its native launcher, then uninstalls. Ordinary
CI retains no installer artifacts or dependency caches. Superseded CI runs are cancelled.
Pushes to either branch skip packaging, avoiding a duplicate installer build after promotion.
The final gate is named `Installers passed` only for PRs into `main` and manual CI runs;
all ordinary runs report `CI passed`. It accepts only a successful aggregate native result:
failed, skipped or cancelled verification cannot pass. A cancelled gate also cannot authorize merge.
Version tags still build and verify release installers from the exact tagged commit, rather than
reusing development packages.

`release.yml` runs for `v*` version tags or a manual retry specifying an existing tag. It:

1. Checks that the tag exactly matches the root package/lock versions and belongs to `main`.
2. Checks out the same immutable commit on both native platforms and reruns verification.
3. Builds and verifies both installers with `preview` payload metadata and EDDN uploads off.
4. Stages stable download filenames, build manifests (source SHA/runtime/payload checksums and
   Linux AppImage dependency/file provenance) and
   retains intermediate workflow artifacts for **one day**.
5. Verifies both assets against the expected version/source/hash, generates `SHA256SUMS`, and
   creates a **draft prerelease** with generated notes. Only this final job has release write access.

There is no automatic publication. Reruns may replace assets on an existing **draft** only;
published releases are never overwritten. Failure on either OS prevents release assembly.
Actions are pinned by full commit SHA; monthly Dependabot PRs target `dev` for review.

## Preparing a release

Update `package.json` and both root version entries in `package-lock.json` together through `dev`.
Use three numeric components (for example `0.1.4`), compatible with Inno Setup and the optional Debian fallback. The
GitHub prerelease flag and payload channel identify preview builds. After promotion:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git tag -a v0.1.4 -m 'PHOENIX 0.1.4 preview'
git push origin v0.1.4
```

Use the actual next version; never reuse or move a release tag. Wait for `Draft release` to
complete, then review assets/notes in GitHub Releases. Native installer tests are not proof of real
Elite input, tablet pairing, antivirus acceptance or actual user-data upgrade behavior. Use the
acceptance checklist in `scripts/package/README.md`. Windows binaries are currently unsigned.
The [acceptance matrix](acceptance.md) records build-specific evidence and outstanding gameplay,
tablet and platform checks. Refresh it for the exact release revision; CI is not gameplay acceptance.

Publishing is an explicit maintainer action. The first release remains a preview. Keep it marked
prerelease; do not mark it latest. Later, a fully accepted build may be published as a normal
release. Installers do not self-update: users download and run the newer installer.

## README download links

The README links directly to the Windows installer and Linux AppImage in the published
v0.1.7 prerelease. Preview links must include the tag (`releases/download/v0.1.7/...`), because
prereleases are excluded from GitHub's `latest` release redirect. Update both links and the
release-notes link when publishing the next preview. Draft assets are not public downloads.

Once a normal release exists, these stable asset names allow permanent links without editing the
README for each version:

```text
https://github.com/judus/phoenix/releases/latest/download/PHOENIX-windows-x64-setup.exe
https://github.com/judus/phoenix/releases/latest/download/PHOENIX-linux-x64.AppImage
```

The Linux AppImage targets modern glibc-based x64 desktops; see the packaging guide for runtime
libraries and manual acceptance. The `.deb` is a frozen fallback, not a release asset. Source installation remains
available. Do not link Actions artifacts as the public download: they require authentication and expire.

## Quota or runner failures

Release assets are separate from temporary Actions artifacts. Builds upload only the installers
and small manifests, retain those intermediate artifacts one day, and do not cache npm data.
Check account-level Actions/Packages usage if upload is blocked; a repo's empty artifact list does
not prove available account quota. Never change billing limits or delete other repositories' data
as an automatic workaround.

The same scripts support local fallback. Check out the exact release tag and run `npm ci` and
`npm run check` on **each native OS**. Set `PHOENIX_RELEASE_CHANNEL=preview` and
`PHOENIX_EDDN_TEST_MODE=0` in that shell, run the OS's installer build/verification commands,
then `node scripts/release/assets.mjs stage`. Transfer only the staged files into one clean
`dist/release` directory. With `RELEASE_TAG` set to the existing tag and `GH_REPO=judus/phoenix`,
run `node scripts/release/draft.mjs` from that tag checkout (with `origin/main` fetched).
Use your authenticated GitHub CLI; never put tokens in tracked files. This path applies exactly
the same hash/source validation and never publishes. Linux cannot build the Windows installer.

References: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases),
[permanent download links](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases),
[branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches).
