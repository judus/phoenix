import { DataTableGroup } from '../components/data-table'
import { ItemList, ItemListItem } from '../components/item-list'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './galnet-page.css'

const articles = [
  ['06 Aug 2026', 'Colonia Tenth Anniversary Celebrations Get Underway'],
  ['30 Jul 2026', 'Colonia Plans to Distribute Celebration Commodities'],
  ['27 Jul 2026', 'Pilots’ Federation Directs Members to Colonia'],
  ['23 Jul 2026', 'Colonia Supply Initiative Deemed a Partial Success'],
  ['16 Jul 2026', 'Colonia Calls for Assistance as Celebrations Get Underway'],
  ['13 Jul 2026', 'Major Corporations Promote Colonia Celebrations'],
  ['09 Jul 2026', 'Terri Tora Released by October Consortium'],
  ['02 Jul 2026', 'Explorers Gather for Colonia Anniversary Survey']
]

export function GalnetPage() {
  return (
    <PageFrame layout="fit">
      <div className="galnet-page">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Comms', href: '#comms' }, { label: 'Galaxy news' }]} />}
          status="Fresh feed · received 16 Aug 2026 · 04:25"
          title="GalNet"
        />

        <div className="galnet-layout">
          <DataTableGroup className="galnet-index" meta="8 articles" title="Latest news">
            <div className="galnet-index-scroll" tabIndex={0}>
              <ItemList density="compact" aria-label="GalNet articles">
                {articles.map(([date, title], index) => (
                  <ItemListItem
                    eyebrow={<time className="text-information">{date}</time>}
                    href={`#article-${index + 1}`}
                    key={title}
                    selected={index === 0}
                    title={title}
                  />
                ))}
              </ItemList>
            </div>
          </DataTableGroup>

          <DataTableGroup className="galnet-reader-group" meta="06 Aug 2026" title="GalNet article">
            <article className="galnet-reader">
              <header>
                <small>GalNet</small>
                <h2>Colonia Tenth Anniversary Celebrations Get Underway</h2>
              </header>

              <div className="article-body" tabIndex={0}>
                <p>The tenth anniversary of Colonia’s founding has opened with celebrations across the enclave.</p>
                <p>Local authorities are welcoming visiting commanders while starports prepare events, markets, and commemorative displays throughout the region.</p>
                <p>Organisers credited independent pilots and partner corporations for delivering supplies needed by the anniversary programme.</p>
                <p>New tourist beacons will mark notable locations and achievements from Colonia’s first decade, creating a permanent record for future visitors.</p>
                <p>Further community activities are expected to continue throughout the month.</p>
              </div>

            </article>
          </DataTableGroup>
        </div>
      </div>
    </PageFrame>
  )
}
