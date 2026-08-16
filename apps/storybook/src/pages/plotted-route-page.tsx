import { DataTable, DataTableGroup } from '@phoenix/ui'
import { DescriptionItem, DescriptionList } from '@phoenix/ui'
import { Inline, Stack } from '@phoenix/ui'
import { Metric } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'

type RouteStep = {
  distance: string
  jump: string
  leg: string
  star: string
  system: string
}

const routeSteps: RouteStep[] = [
  { jump: 'Origin', system: 'Col 285 Sector OK-C b14-5', star: 'M', leg: '—', distance: '0.0 ly' },
  { jump: '1', system: 'HIP 115894', star: 'G', leg: '20.6 ly', distance: '20.6 ly' },
  { jump: '2', system: 'Col 285 Sector FD-G b12-0', star: 'M', leg: '18.6 ly', distance: '39.2 ly' },
  { jump: '3', system: 'Col 285 Sector BX-H b11-3', star: 'M', leg: '20.0 ly', distance: '59.2 ly' },
  { jump: '4', system: 'HIP 11399', star: 'M', leg: '20.9 ly', distance: '80.2 ly' },
  { jump: '5', system: 'Col 285 Sector HX-S c4-13', star: 'K', leg: '20.6 ly', distance: '100.8 ly' },
  { jump: '6', system: 'CPO 538', star: 'G', leg: '20.8 ly', distance: '121.5 ly' },
  { jump: '7', system: 'Col 285 Sector DR-U c3-1', star: 'K', leg: '21.0 ly', distance: '142.6 ly' },
  { jump: '8', system: 'HIP 23730', star: 'F', leg: '19.6 ly', distance: '162.2 ly' },
  { jump: '9', system: 'Col 285 Sector ZV-S b5-3', star: 'M', leg: '20.7 ly', distance: '182.9 ly' },
  { jump: '10', system: 'Col 285 Sector QY-R b6-2', star: 'K', leg: '19.8 ly', distance: '202.7 ly' },
  { jump: '11', system: 'HIP 11644', star: 'G', leg: '20.4 ly', distance: '223.1 ly' },
  { jump: '12', system: 'Col 285 Sector LR-P b7-4', star: 'M', leg: '18.9 ly', distance: '242.0 ly' },
  { jump: '13', system: 'Col 285 Sector EG-N c7-6', star: 'K', leg: '20.1 ly', distance: '262.1 ly' },
  { jump: '14', system: 'HIP 11958', star: 'F', leg: '19.7 ly', distance: '281.8 ly' },
  { jump: '15', system: 'Col 285 Sector JW-M b8-1', star: 'M', leg: '20.3 ly', distance: '302.1 ly' },
  { jump: '16', system: 'Col 285 Sector YF-K c8-9', star: 'K', leg: '18.8 ly', distance: '320.9 ly' },
  { jump: '17', system: 'HIP 12205', star: 'G', leg: '19.4 ly', distance: '340.3 ly' },
  { jump: '18', system: 'Wredguia UK-V b30-2', star: 'M', leg: '17.2 ly', distance: '357.5 ly' },
  { jump: '19', system: 'Wredguia UK-V b30-1', star: 'K', leg: '18.2 ly', distance: '375.7 ly' }
]

export function PlottedRoutePage() {
  return (
    <PageFrame layout="fit">
      <div className="plotted-route">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#galaxy' }, { label: 'Plotted route' }]} />}
          title="Plotted route"
        />

        <section className="route-overview" aria-label="Route summary">
          <div className="route-path">
            <Metric density="compact" label="Origin" value="COL 285 SECTOR OK-C B14-5" />
            <i aria-hidden="true" />
            <Metric density="compact" label="Destination" value="WREDGUIA UK-V B30-1" />
          </div>
          <Inline className="route-facts" gap="xl" wrap={false}>
            <Metric className="text-end" density="compact" label="Jumps" value="19" />
            <Metric className="text-end" density="compact" label="Distance" value="375.7 ly" />
          </Inline>
        </section>

        <div className="route-body">
          <DataTableGroup title="Next jump">
            <Stack className="route-next-content" gap="lg">
              <Metric className="text-information" value="HIP 115894" />
              <DescriptionList columns="one" density="compact">
                <DescriptionItem label="Star class" value="G" />
                <DescriptionItem label="Leg distance" value="20.6 ly" />
                <DescriptionItem label="Bodies" value="8" />
                <DescriptionItem label="Installations" value="2" />
                <DescriptionItem label="Economy" value="Extraction" />
                <DescriptionItem label="Population" value="34,820" />
                <DescriptionItem label="Allegiance" value="Independent" />
                <DescriptionItem label="Security" value="Low security" />
              </DescriptionList>
            </Stack>
          </DataTableGroup>

          <DataTableGroup className="route-sequence" title="Jump sequence">
            <div className="route-table-scroll" tabIndex={0}>
              <DataTable density="compact" label="Plotted route jump sequence" narrow="priority" scheme="surface" stickyHeader>
                <thead>
                  <tr>
                    <th scope="col">Jump</th>
                    <th scope="col">System</th>
                    <th scope="col">Star</th>
                    <th className="numeric" scope="col">Leg</th>
                    <th className="numeric" scope="col">Route distance</th>
                  </tr>
                </thead>
                <tbody>
                  {routeSteps.map((step, index) => (
                    <tr className={index === 0 ? 'active' : undefined} key={step.jump}>
                      <td>{step.jump}</td>
                      <td className="text-information">{step.system}</td>
                      <td>{step.star}</td>
                      <td className="numeric">{step.leg}</td>
                      <td className="numeric">{step.distance}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </DataTableGroup>
        </div>
      </div>
    </PageFrame>
  )
}
