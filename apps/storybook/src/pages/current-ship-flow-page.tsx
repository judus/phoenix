import { Button } from '../components/button'
import { DescriptionItem, DescriptionList } from '../components/description-list'
import { AutoGrid, Stack } from '../components/layout'
import { Meter } from '../components/meter'
import { Metric } from '../components/metric'
import { PageFrame, PageHeader, Panel, Section } from '../components/page'
import { Status } from '../components/status'
import { Tabs, type TabItem } from '../components/tabs'

const shipTabs: TabItem[] = [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'loadout', label: 'Loadout', href: '#loadout' },
  { id: 'cargo', label: 'Cargo', href: '#cargo' }
]

export function CurrentShipFlowPage() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          variant="entity"
          context="Current ship"
          title="Type-11 Prospector"
          description="EL-06L · Lakon Spaceways"
          metadata="Docked at Locke Terminal · Col 285 Sector OK-C B14-5"
          actions={<Button variant="primary">Manage ship</Button>}
        />

        <Tabs label="Ship sections" current="overview" items={shipTabs} />

        <Section title="Readiness">
          <AutoGrid minimum="md" gap="sm">
            <Panel title="Hull integrity"><Metric value="100%" detail="No damage reported" /></Panel>
            <Panel title="Jump range"><Metric value="22.4 ly" detail="Current laden configuration" /></Panel>
            <Panel title="Cargo"><Metric value="3 / 196 t" detail="193 t available" /></Panel>
            <Panel title="Rebuy cost"><Metric value="5.98 M CR" detail="0.97% of current balance" /></Panel>
          </AutoGrid>
        </Section>

        <AutoGrid minimum="lg" gap="xxl">
          <Section divider title="Vessel">
            <DescriptionList>
              <DescriptionItem label="Identifier" value="EL-06L" />
              <DescriptionItem label="Manufacturer" value="Lakon Spaceways" />
              <DescriptionItem label="Landing pad" value="Medium" />
              <DescriptionItem label="Unladen mass" value="599.8 t" />
              <DescriptionItem label="Hull value" value="67,861,850 CR" />
              <DescriptionItem label="Modules value" value="51,746,423 CR" />
              <DescriptionItem label="Installed modules" value="36" />
              <DescriptionItem label="Engineered modules" value="1" />
            </DescriptionList>
          </Section>

          <Section divider title="Stores and integrity">
            <Stack gap="lg">
              <Meter label="Hull integrity" value={100} valueLabel="100 / 100" />
              <Meter label="Cargo hold" max={196} value={3} valueLabel="3 / 196 t" />
              <Meter label="Main fuel" value={78} valueLabel="78%" />
              <Meter label="Reservoir" value={42} valueLabel="42%" tone="warning" />
            </Stack>
          </Section>
        </AutoGrid>

        <Section divider title="Live status" description="Current ship state from the latest telemetry event.">
          <AutoGrid minimum="sm" gap="md">
            <Status tone="positive">Shields online</Status>
            <Status tone="muted">Hardpoints retracted</Status>
            <Status tone="warning">Landing gear deployed</Status>
            <Status tone="muted">Cargo scoop retracted</Status>
            <Status tone="muted">Lights off</Status>
            <Status tone="muted">Night vision off</Status>
            <Status tone="muted">Flight assist off</Status>
            <Status tone="positive">No module damage</Status>
          </AutoGrid>
        </Section>
      </Stack>
    </PageFrame>
  )
}
