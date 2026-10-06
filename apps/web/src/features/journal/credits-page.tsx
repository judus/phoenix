import { AutoGrid, Breadcrumbs, DescriptionItem, DescriptionList, PageFrame, PageHeader, Panel } from '@phoenix/ui'

export function CreditsPage() {
  return <PageFrame className="credits-page" layout="fit">
    <PageHeader context={<Breadcrumbs items={[{ label: 'Log' }, { label: 'Credits' }]} />} title="Credits" variant="cockpit" />
    <AutoGrid
      className="credits-sources"
      gap="xs"
      minimum="xl"
    >
        <Panel title="Elite Dangerous · Frontier Developments">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem label="Journal files" value="Commander, career, fleet, missions, communications, engineering and exploration events." />
            <DescriptionItem label="Status.json" value="Current game status, location and vehicle flags." />
            <DescriptionItem label="Cargo.json · ShipLocker.json · Backpack.json" value="Cargo and on-foot inventory snapshots." />
            <DescriptionItem label="NavRoute.json" value="The route currently plotted in-game." />
            <DescriptionItem label="Custom bindings" value="Configured Elite Dangerous keyboard bindings used by Control Deck." />
            <DescriptionItem
              label={<SourceLink href="https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article">GalNet</SourceLink>}
              value="Official live GalNet articles."
            />
          </DescriptionList>
        </Panel>
        <Panel title="Bundled catalogue snapshots">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://github.com/EDCD/FDevIDs">EDCD · FDevIDs</SourceLink>}
              value="Ship, module, commodity, material and engineer identifiers."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/EDCD/coriolis-data">EDCD · Coriolis Data</SourceLink>}
              value="Ship definitions, engineering blueprints and experimental effects."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/DarkSession/Elite-Dangerous-Almanac">Elite Dangerous Almanac</SourceLink>}
              value="Personal equipment, upgrade and modification recipes, specialists and on-foot materials."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/jixxed/ed-odyssey-materials-helper">Odyssey Materials Helper · Jixxed</SourceLink>}
              value="Upstream personal-equipment and recipe source used through the Almanac."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/klightspeed/EliteDangerousRegionMap">EliteDangerousRegionMap · Ben Peddell</SourceLink>}
              value="Galactic Atlas region boundaries and coordinate lookup."
            />
          </DescriptionList>
        </Panel>
        <Panel title="Live community data services">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://www.edsm.net/">EDSM</SourceLink>}
              value="System cartography, station shipyard/outfitting stock and coordinate lookups."
            />
            <DescriptionItem
              label={<SourceLink href="https://spansh.co.uk/">Spansh</SourceLink>}
              value="System, station, shipyard, outfitting, faction and exploration searches."
            />
            <DescriptionItem
              label={<SourceLink href="https://ardent-insight.com/">Ardent Insight</SourceLink>}
              value="Nearest facilities, commodity markets, trade opportunities and market signals."
            />
          </DescriptionList>
        </Panel>
        <Panel title="Community references and contribution">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://github.com/EDCD/EDDN">EDDN · EDCD</SourceLink>}
              value="Contribution protocol and bundled validation schemas; delivery depends on build availability and settings."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/EDCD/EDMarketConnector">Elite Dangerous Market Connector · EDCD</SourceLink>}
              value="Reference for EDDN event mapping and privacy rules. No EDMC implementation is bundled."
            />
            <DescriptionItem
              label={<SourceLink href="https://inara.cz/elite/experimentaleffects/">Inara</SourceLink>}
              value="Cross-checks and corrections for experimental-effect material recipes; not a live data connection."
            />
            <DescriptionItem
              label={<SourceLink href="https://elite-dangerous.fandom.com/wiki/Elite_Dangerous_Wiki">Elite Dangerous Wiki</SourceLink>}
              value="Community-maintained reference for biological habitats and game mechanics; not a live data connection."
            />
            <DescriptionItem
              label={<SourceLink href="https://www.elitedangerous.net/exobiology-stratum-tectonicas-search.php">PMC Elite Dangerous</SourceLink>}
              value="Inspiration for the pre-Odyssey Stratum candidate query, with independently corrected filters."
            />
          </DescriptionList>
        </Panel>
        <Panel title="Software and fonts">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem label="Control Deck" value="Embedded command, keyboard and Numpy runtime, under its own PHOENIX Runtime Licence." />
            <DescriptionItem
              label={<SourceLink href="https://github.com/judus/deskplane">Deskplane</SourceLink>}
              value="Workspace navigation and touch gestures."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/IBM/plex">IBM Plex Sans · IBM</SourceLink>}
              value="Body typeface, under the SIL Open Font License 1.1."
            />
            <DescriptionItem
              label={<SourceLink href="https://www.dafont.com/euro-caps.font">Euro Caps · Tom Oetken</SourceLink>}
              value="Display typeface, published as Ash Pikachu Font."
            />
          </DescriptionList>
          <p>Other dependencies and bundled components retain their own licences. See the{' '}
            <SourceLink href="https://github.com/judus/phoenix/blob/dev/THIRD_PARTY_NOTICES.md">third-party notices</SourceLink>
            {' '}and the licence files included with PHOENIX.</p>
        </Panel>
        <Panel title="Optional Copilot service">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://api.openai.com/">OpenAI</SourceLink>}
              value="Copilot text, transcription and voice responses when the user configures an API key."
            />
          </DescriptionList>
        </Panel>
        <Panel title="PHOENIX">
          <p>Created by Julien Duseyau. PHOENIX source is Apache-2.0; bundled components and game data retain their own terms.</p>
          <p>Elite Dangerous and its game data belong to Frontier Developments plc. PHOENIX is an unofficial fan-made companion, not endorsed by or affiliated with Frontier.</p>
        </Panel>
    </AutoGrid>
  </PageFrame>
}

function SourceLink({ children, href }: { children: string, href: string }) {
  return <a href={href} rel="noreferrer" target="_blank">{children}</a>
}
