import { DataTable, DataTableGroup } from '@phoenix/ui'
import { PageFrame, PageHeader } from '@phoenix/ui'
import './fleet-page.css'

type Vessel = {
  location: string
  name: string
  observed: string
  state: string
  type: string
  value: string
}

const vessels: Vessel[] = [
  {
    name: 'Type-11 Prospector',
    type: 'Type-11 Prospector · EL-06L',
    state: 'Active',
    location: 'Locke Terminal · Col 285 Sector OK-C B14-5',
    value: '119,608,273 CR',
    observed: '15 Aug · 18:28'
  },
  {
    name: 'Alliance Chieftain',
    type: 'Alliance Chieftain',
    state: 'Stored remote',
    location: 'Capricorni Sector DG-X b1-1',
    value: '98,508,667 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Eagle',
    type: 'Eagle',
    state: 'Stored remote',
    location: 'Atata',
    value: '38,970 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Imperial Eagle',
    type: 'Imperial Eagle',
    state: 'Stored remote',
    location: 'Atata',
    value: '98,392 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Krait Mk II',
    type: 'Krait Mk II',
    state: 'Stored remote',
    location: 'Suhte',
    value: '152,991,505 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Mandalay',
    type: 'Mandalay',
    state: 'Stored remote',
    location: 'Suhte',
    value: '48,587,246 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Python',
    type: 'Python',
    state: 'Stored remote',
    location: 'Atata',
    value: '126,311,549 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Sidewinder',
    type: 'Sidewinder',
    state: 'Stored remote',
    location: 'Atata',
    value: '27,450 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'Type-6 Transporter',
    type: 'Type-6 Transporter',
    state: 'Stored remote',
    location: 'Atata',
    value: '4,696,963 CR',
    observed: '15 Aug · 09:39'
  },
  {
    name: 'MURDOCK',
    type: 'Viper Mk IV',
    state: 'Stored remote',
    location: 'Atata',
    value: '5,091,762 CR',
    observed: '15 Aug · 09:39'
  }
]

const fleetSummary = [
  ['Active', '1'],
  ['Owned', '10'],
  ['Stored', '9'],
  ['Transferring', '0'],
  ['Unknown', '0']
]

export function FleetPage() {
  return (
    <PageFrame layout="fit">
      <div className="fleet-overview">
        <PageHeader
          variant="cockpit"
          title="Fleet"
        />

        <dl className="fleet-summary">
          {fleetSummary.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <DataTableGroup className="vessels" title="Owned vessels">
          <DataTable density="compact" label="Owned vessels" minimum="wide" narrow="priority" scheme="surface">
            <thead>
              <tr>
                <th scope="col">Vessel</th>
                <th scope="col">State</th>
                <th className="priority-secondary" scope="col">Location</th>
                <th className="numeric" scope="col">Value</th>
                <th className="priority-tertiary" scope="col">Transfer</th>
                <th className="priority-tertiary" scope="col">Observed</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel, index) => (
                <tr className={index === 0 ? 'active' : undefined} key={vessel.name}>
                  <td>
                    <strong>{vessel.name}</strong>
                    <small>{vessel.type}</small>
                  </td>
                  <td>{vessel.state}</td>
                  <td className="priority-secondary">{vessel.location}</td>
                  <td className="numeric">{vessel.value}</td>
                  <td className="priority-tertiary">—</td>
                  <td className="priority-tertiary">{vessel.observed}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableGroup>

        <dl className="asset-summary">
          <div>
            <dt>Stored equipment</dt>
            <dd>89</dd>
            <small>Authoritative snapshot</small>
          </div>
          <div>
            <dt>Fleet carriers</dt>
            <dd>0</dd>
            <small>No authoritative record observed</small>
          </div>
        </dl>
      </div>
    </PageFrame>
  )
}
