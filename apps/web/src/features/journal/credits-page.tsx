import { DashboardColumns, DescriptionItem, DescriptionList, PageFrame, PageHeader, Panel } from '@phoenix/ui'

export function CreditsPage() {
  return <PageFrame className="credits-page" layout="fit">
    <PageHeader context="Log · Credits" title="Credits" variant="cockpit" />
    <DashboardColumns
      className="credits-sources"
      gap="xs"
      primary={<>
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
              value="Module, material, engineer and shipyard identifiers."
            />
            <DescriptionItem
              label={<SourceLink href="https://github.com/EDCD/coriolis-data">EDCD · Coriolis Data</SourceLink>}
              value="Ship definitions and engineering blueprint data."
            />
          </DescriptionList>
        </Panel>
      </>}
      secondary={<>
        <Panel title="Live community data services">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://www.edsm.net/">EDSM</SourceLink>}
              value="System cartography and station commodity stock."
            />
            <DescriptionItem
              label={<SourceLink href="https://spansh.co.uk/">Spansh</SourceLink>}
              value="System, station, shipyard, outfitting, faction and exploration searches."
            />
            <DescriptionItem
              label={<SourceLink href="https://api.ardent-insight.com/v2/">Ardent Insight</SourceLink>}
              value="Station search."
            />
          </DescriptionList>
        </Panel>
        <Panel title="Optional service">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem
              label={<SourceLink href="https://api.openai.com/">OpenAI</SourceLink>}
              value="Copilot text, transcription and voice responses when the user configures an API key."
            />
          </DescriptionList>
        </Panel>
      </>}
    />
  </PageFrame>
}

function SourceLink({ children, href }: { children: string, href: string }) {
  return <a href={href} rel="noreferrer" target="_blank">{children}</a>
}
