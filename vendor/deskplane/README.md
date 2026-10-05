# Deskplane integration preview

`deskplane-0.1.4-swipe.0.tgz` is an unpublished, versioned package built with `npm pack`
in Deskplane's `feature/swipe-through-buttons` branch, based on `9c3609e` (0.1.3).
The owning source commit is `376187b27875ef1fe7ddb2853d1d8b95937c48fa`, reviewed in
[Deskplane PR #1](https://github.com/judus/deskplane/pull/1).
It adds opt-in `data-deskplane-swipe-through` tap buttons and suppresses pointer clicks
after recognized drags, including snap-back and cancellation. Hold/arming/edit gestures
remain excluded by PHOENIX. The shared implementation and tests belong to Deskplane;
PHOENIX contains no fork or runtime patch. Its npm lockfile pins the archive integrity.

This archive lets the feature branch install and test independently of a sibling checkout.
Before publishing/merging the integration, review and merge the owning Deskplane branch;
publish an authorized Deskplane release and switch the dependency to that version, or retain
an explicitly approved versioned artifact. Do not silently replace a published archive.
