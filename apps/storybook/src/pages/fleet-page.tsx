import { Button } from '../components/button'
import { DataTable } from '../components/data-table'
import { AutoGrid, Stack } from '../components/layout'
import { Metric } from '../components/metric'
import { PageFrame, PageHeader, Panel, Section } from '../components/page'
import { Status, type StatusTone } from '../components/status'

type Ship = {
  location: string
  name: string
  role: string
  status: string
  statusTone: StatusTone
  type: string
}

const ships: Ship[] = [
  {
    name: 'Type-11 Prospector',
    type: 'Type-11 Prospector',
    role: 'Mining and heavy cargo',
    location: 'Col 285 Sector OK-C B14-5',
    status: 'Current ship',
    statusTone: 'positive'
  },
  {
    name: 'Nightjar',
    type: 'Krait Mk II',
    role: 'Multipurpose combat',
    location: 'Jameson Memorial',
    status: 'Stored',
    statusTone: 'muted'
  },
  {
    name: 'Wayfarer',
    type: 'Diamondback Explorer',
    role: 'Long-range exploration',
    location: 'Ray Gateway',
    status: 'Transfer available',
    statusTone: 'information'
  },
  {
    name: 'Iron Kestrel',
    type: 'Vulture',
    role: 'Bounty hunting',
    location: 'Lave Station',
    status: 'Stored',
    statusTone: 'muted'
  }
]

export function FleetPage() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          context="Fleet"
          title="Ship registry"
          description="Review registered vessels, current assignments, and transfer availability."
          metadata="4 registered vessels · 1 active · Last synchronized 2 minutes ago"
          actions={<Button variant="primary">Open shipyard</Button>}
        />

        <Section title="Fleet overview">
          <AutoGrid minimum="sm" gap="sm">
            <Panel title="Current ship">
              <Metric value="Type-11 Prospector" detail="Docked locally · Hull 100%" />
            </Panel>
            <Panel title="Stored vessels">
              <Metric value="3" detail="Across three stations" />
            </Panel>
            <Panel title="Insurance exposure">
              <Metric value="41.8 M CR" detail="Combined rebuy value" />
            </Panel>
          </AutoGrid>
        </Section>

        <Section
          divider
          title="Registered ships"
          description="Locations and availability reflect the last successful game sync."
        >
          <DataTable label="Registered ships" narrow="priority">
            <thead>
              <tr>
                <th scope="col">Ship</th>
                <th className="priority-secondary" scope="col">Type</th>
                <th className="priority-tertiary" scope="col">Assignment</th>
                <th className="priority-secondary" scope="col">Location</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {ships.map((ship, index) => (
                <tr className={index === 0 ? 'active' : undefined} key={ship.name}>
                  <th scope="row">{ship.name}</th>
                  <td className="priority-secondary">{ship.type}</td>
                  <td className="priority-tertiary">{ship.role}</td>
                  <td className="priority-secondary">{ship.location}</td>
                  <td><Status tone={ship.statusTone}>{ship.status}</Status></td>
                  <td><Button size="sm" variant="quiet">View</Button></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Section>
      </Stack>
    </PageFrame>
  )
}
