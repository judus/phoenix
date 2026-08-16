# Elite Dangerous reference assets

Status: researched 2026-08-15

## Finding

No current, publicly downloadable Elite Dangerous fan kit was found that provides fonts, icons,
interface assets, or a colour specification with redistribution rights suitable for PHOENIX.

Frontier currently provides two relevant routes:

- the [Frontier Press Portal](https://www.frontier.co.uk/press), described by Frontier as an asset
  portal for verified journalists and media partners;
- the [Elite Dangerous media usage rules](https://customersupport.frontier.co.uk/hc/en-us/articles/4404292442642-How-can-I-use-Elite-Dangerous-media),
  which permit attributed use for non-commercial fan content but require advance permission for
  commercial or promotional use.

PHOENIX is intended for possible commercial distribution. The non-commercial fan-content
permission is therefore not a sufficient asset licence for the shipped application.

## What this means

Until Frontier gives explicit written permission:

- do not ship fonts, icons, logos, textures, screenshots, sounds, or extracted interface files from
  Elite Dangerous;
- do not copy assets from an installed game or from the restricted press portal;
- do not assume a community asset pack has Frontier's permission;
- do not treat attribution as a substitute for commercial permission;
- do not imply that PHOENIX is official, endorsed by, or produced with Frontier;
- keep reference screenshots out of production bundles and package manifests.

Community projects such as EDAssets and look-alike font or icon packs may help locate references,
but each asset needs its own documented author, source, licence, modification terms, commercial-use
permission, and Frontier rights analysis before it can enter PHOENIX.

## Safe design direction

The ELITE presentation mode should be a clean-room interpretation built from:

- PHOENIX-owned CSS geometry, layout, borders, illumination, and motion;
- the existing PHOENIX palette and semantic colour tokens;
- independently licensed fonts with recorded redistribution rights;
- PHOENIX-owned icons or icons from a commercially compatible library;
- screenshots used only to study general interaction qualities such as scale, density, hierarchy,
  contrast, rhythm, and state treatment.

General visual ideas are useful references. Exact artwork, icons, typeface files, logos, and other
protected expression are not implementation inputs.

## Permission path

Frontier's public guidance directs commercial and promotional enquiries to
`community@frontier.co.uk`. Before PHOENIX ships an actual Frontier asset, obtain written permission
that explicitly covers:

1. the named asset files;
2. use inside downloadable application binaries;
3. commercial distribution and storefront promotion;
4. modification, recolouring, and responsive presentation where required;
5. the required attribution and trademark wording;
6. duration, territories, revocation, and update obligations.

Store the written grant and an asset inventory alongside the eventual release provenance records.

## Official sources

- [Elite Dangerous media usage rules](https://customersupport.frontier.co.uk/hc/en-us/articles/4404292442642-How-can-I-use-Elite-Dangerous-media)
- [Frontier EULA](https://www.frontier.co.uk/legal/eula)
- [Frontier Press Portal](https://www.frontier.co.uk/press)
