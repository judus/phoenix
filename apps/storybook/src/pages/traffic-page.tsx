import { DataTable, DataTableGroup } from '../components/data-table'
import { DescriptionItem, DescriptionList } from '../components/description-list'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './traffic-page.css'

const trafficSummary = [
  ['Traffic', '1,623'],
  ['Inbound', '1,623'],
  ['Outbound', '0']
]

const messages = [
  ['npc-', 'Entered Channel: Col 285 Sector OK-C b14-5', 'Aug 15 · 18:28'],
  ['Locke Terminal', 'Docking request granted.', 'Aug 15 · 09:49'],
  ['Locke Terminal', 'Ensure to observe starport protocol during your visit.', 'Aug 15 · 09:49'],
  ['Locke Terminal', 'No fire zone entered.', 'Aug 15 · 09:49'],
  ['Phil Mann', "We don't have to do this!", 'Aug 15 · 09:46'],
  ['Locke Terminal', 'No fire zone exited.', 'Aug 15 · 09:46'],
  ['System Authority Vessel', 'Your scan is clear. Carry on with your journey, Commander.', 'Aug 15 · 09:43'],
  ['npc-', 'Entered Channel: Col 285 Sector OK-C b14-5', 'Aug 15 · 09:38'],
  ['System Authority Vessel', 'Please submit to a routine security scan.', 'Aug 15 · 09:37']
]

export function TrafficPage() {
  return (
    <PageFrame layout="fit">
      <div className="traffic-page">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Comms', href: '#comms' }, { label: 'Local communications' }]} />}
          title="Traffic"
        />

        <dl className="traffic-summary">
          {trafficSummary.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="traffic-layout">
          <DataTableGroup className="traffic-messages" meta="1,623 retained" title="Local traffic">
            <div className="traffic-list" tabIndex={0}>
              <DataTable
                className="traffic-table"
                density="compact"
                label="Local traffic"
                narrow="priority"
                scheme="surface"
                stickyHeader
              >
                <colgroup>
                  <col className="correspondent-column" />
                  <col />
                  <col className="received-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Correspondent</th>
                    <th scope="col">Message</th>
                    <th className="priority-secondary" scope="col">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map(([correspondent, message, received], index) => (
                    <tr className={index === 0 ? 'active' : undefined} key={`${correspondent}-${received}-${index}`} tabIndex={0}>
                      <th scope="row">
                        <strong>{correspondent}</strong>
                        <small>NPC · inbound</small>
                      </th>
                      <td title={message}>{message}</td>
                      <td className="priority-secondary"><time>{received}</time></td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </DataTableGroup>

          <DataTableGroup className="traffic-inspector" title="Selected message">
            <article className="traffic-detail">
              <header>
                <small>NPC · inbound</small>
                <h2>npc-</h2>
                <time dateTime="2026-08-15T18:28:11+02:00">15 Aug 2026 · 18:28:11</time>
              </header>

              <p>Entered Channel: Col 285 Sector OK-C b14-5</p>

              <DescriptionList columns="one" density="compact">
                <DescriptionItem label="Source" value="ReceiveText" />
                <DescriptionItem label="Kind" value="NPC" />
                <DescriptionItem label="Channel" value="npc" />
              </DescriptionList>

              <details>
                <summary>Raw Frontier message</summary>
                <pre>{`{
  "event": "ReceiveText",
  "From": "npc-",
  "Channel": "npc"
}`}</pre>
              </details>
            </article>
          </DataTableGroup>
        </div>
      </div>
    </PageFrame>
  )
}
