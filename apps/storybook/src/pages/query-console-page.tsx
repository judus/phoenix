import { ActionTile, Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'

const queries = [
  {
    status: 'Cartography',
    label: 'System search',
    description: 'Find nearby systems, optionally narrowed by demographic, economic, and political characteristics.',
  },
  {
    status: 'Cartography',
    label: 'Exploration targets',
    description: 'Locate reported bodies by physical characteristics and surface signals.',
  },
  {
    status: 'Facilities',
    label: 'Shipyards selling a hull',
    description: 'Locate shipyards reporting a particular hull in stock.',
  },
  {
    status: 'Facilities',
    label: 'Nearest facility',
    description: 'Find the nearest station providing an operational service.',
  },
  {
    status: 'Markets',
    label: 'Commodity markets',
    description: 'Find markets buying or selling a specific commodity.',
  },
  {
    status: 'Facilities',
    label: 'Outfitting stock',
    description: 'Locate stations reporting a named module in stock.',
  },
  {
    status: 'Facilities',
    label: 'Station lookup',
    description: 'Locate a known or partially remembered station.',
  },
  {
    status: 'Politics',
    label: 'Faction and BGS presence',
    description: 'Locate faction presence and matching BGS conditions.',
  },
  {
    status: 'Markets',
    label: 'Trade opportunities',
    description: 'Compare reported buy and sell markets for profitable cargo movement.',
  },
  {
    status: 'Query library',
    label: 'Saved queries',
    description: 'Run and manage reusable galaxy queries.',
  }
]

export function QueryConsolePage() {
  return (
    <PageFrame layout="fit">
      <div className="query-console">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#galaxy' }, { label: 'Query console' }]} />}
          title="Query console"
        />

        <div className="query-grid">
          {queries.map((query) => <ActionTile {...query} key={query.label} />)}
        </div>
      </div>
    </PageFrame>
  )
}
