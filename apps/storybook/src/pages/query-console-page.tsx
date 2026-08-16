import { ActionTile } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'

const queries = [
  {
    eyebrow: 'Cartography',
    label: 'Nearby systems',
    description: 'Inspect known systems around a reference system.',
  },
  {
    eyebrow: 'Facilities',
    label: 'Shipyards selling a hull',
    description: 'Locate shipyards reporting a particular hull in stock.',
  },
  {
    eyebrow: 'Facilities',
    label: 'Nearest facility',
    description: 'Find the nearest station providing an operational service.',
  },
  {
    eyebrow: 'Markets',
    label: 'Commodity markets',
    description: 'Find markets buying or selling a specific commodity.',
  },
  {
    eyebrow: 'Facilities',
    label: 'Outfitting stock',
    description: 'Locate stations reporting a named module in stock.',
  },
  {
    eyebrow: 'Facilities',
    label: 'Station lookup',
    description: 'Locate a known or partially remembered station.',
  },
  {
    eyebrow: 'Cartography',
    label: 'Filtered system search',
    description: 'Find systems matching operational, political, and economic criteria.',
  },
  {
    eyebrow: 'Politics',
    label: 'Faction and BGS presence',
    description: 'Locate faction presence and matching BGS conditions.',
  },
  {
    eyebrow: 'Markets',
    label: 'Trade opportunities',
    description: 'Compare reported buy and sell markets for profitable cargo movement.',
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
