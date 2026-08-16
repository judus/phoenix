import { ActionTile } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'

const queries = [
  {
    eyebrow: 'Cartography · P0',
    label: 'Nearby systems',
    description: 'Inspect known systems around a reference system.',
    status: 'Available'
  },
  {
    eyebrow: 'Facilities · P0',
    label: 'Shipyards selling a hull',
    description: 'Locate shipyards reporting a particular hull in stock.',
    status: 'Available'
  },
  {
    eyebrow: 'Facilities · P0',
    label: 'Nearest facility',
    description: 'Find the nearest station providing an operational service.',
    status: 'Available'
  },
  {
    eyebrow: 'Markets · P0',
    label: 'Commodity markets',
    description: 'Find markets buying or selling a specific commodity.',
    status: 'Available'
  },
  {
    eyebrow: 'Facilities · P1',
    label: 'Outfitting stock',
    description: 'Locate stations reporting a named module in stock.',
    status: 'Available'
  },
  {
    eyebrow: 'Facilities · P1',
    label: 'Station lookup',
    description: 'Locate a known or partially remembered station.',
    status: 'Available'
  },
  {
    eyebrow: 'Cartography · P1',
    label: 'Filtered system search',
    description: 'Find systems matching operational, political, and economic criteria.',
    status: 'Available'
  },
  {
    eyebrow: 'Politics · P2',
    label: 'Faction and BGS presence',
    description: 'Locate faction presence and matching BGS conditions.',
    status: 'Planned',
    disabled: true
  },
  {
    eyebrow: 'Markets · P2',
    label: 'Trade opportunities',
    description: 'Compare reported buy and sell markets for profitable cargo movement.',
    status: 'Planned',
    disabled: true
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
