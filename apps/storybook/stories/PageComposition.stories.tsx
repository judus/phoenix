import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '../src/components/button'
import { ControlContext } from '../src/components/control-context'
import { Field, Select, TextInput } from '../src/components/field'
import { AutoGrid, Stack } from '../src/components/layout'
import { PageFrame, PageHeader, Panel, Section } from '../src/components/page'
import '../src/styles/page-stories.css'

function RouteForm() {
  return (
    <ControlContext className="page-story__form" context="panel">
      <AutoGrid gap="md" minimum="md">
        <Field htmlFor="route-origin" label="Origin" hint="Uses the current system when empty.">
          <TextInput defaultValue="Col 285 Sector OK-C B14-5" />
        </Field>
        <Field htmlFor="route-destination" label="Destination">
          <TextInput defaultValue="Shinrarta Dezhra" />
        </Field>
        <Field htmlFor="route-priority" label="Route priority">
          <Select defaultValue="balanced">
            <option value="fastest">Fastest</option>
            <option value="balanced">Balanced</option>
            <option value="economic">Economic</option>
          </Select>
        </Field>
      </AutoGrid>
      <div className="page-story__form-actions">
        <Button variant="quiet">Clear</Button>
        <Button variant="primary">Calculate route</Button>
      </div>
    </ControlContext>
  )
}

function Metric({ detail, value }: { detail: string; value: string }) {
  return (
    <div className="metric">
      <strong className="metric__value">{value}</strong>
      <span className="metric__detail">{detail}</span>
    </div>
  )
}

function OperationsPage() {
  return (
    <PageFrame>
      <Stack gap="xxl">
        <PageHeader
          context="Operations"
          title="Route planner"
          description="Plan a route using the current ship, cargo load, and known service constraints."
          metadata="Krait Mk II · 31.4 ly laden range"
          actions={
            <>
              <Button variant="quiet">Reset</Button>
              <Button variant="primary">Save route</Button>
            </>
          }
        />

        <Section
          title="Route parameters"
          description="Open composition keeps the form legible without another surrounding frame."
        >
          <RouteForm />
        </Section>

        <Section
          divider
          title="Live estimate"
          description="These are independent dashboard widgets, so a panel boundary is meaningful."
        >
          <AutoGrid gap="sm" minimum="sm">
            <Panel title="Distance"><Metric value="412.8 ly" detail="Across 18 calculated jumps" /></Panel>
            <Panel title="Fuel reserve"><Metric value="38%" detail="At arrival, excluding synthesis" /></Panel>
            <Panel title="Travel time"><Metric value="24 min" detail="Based on recent jump cadence" /></Panel>
          </AutoGrid>
        </Section>

        <Section divider title="Route summary">
          <dl className="route-summary">
            <div className="route-summary__row"><dt>First waypoint</dt><dd>HIP 97950</dd></div>
            <div className="route-summary__row"><dt>Refuel strategy</dt><dd>Scoop when projected reserve falls below 45%</dd></div>
            <div className="route-summary__row"><dt>Warnings</dt><dd>Two systems have incomplete service data</dd></div>
          </dl>
        </Section>
      </Stack>
    </PageFrame>
  )
}

function EntityPageHeader() {
  return (
    <PageFrame>
      <PageHeader
        variant="entity"
        context="Commander profile"
        title="Muirn"
        description="Independent pilot · Last synchronized 2 minutes ago"
        metadata="Federation: Friendly · Empire: Cordial"
        actions={<Button variant="primary">Edit profile</Button>}
      />
    </PageFrame>
  )
}

function BoundaryDiscipline() {
  return (
    <PageFrame>
      <Stack gap="xl">
        <PageHeader
          variant="compact"
          context="Design rule"
          title="Boundaries must carry meaning"
          description="Spacing creates ordinary groups. Panels identify independent widgets."
        />
        <AutoGrid gap="xl" minimum="md">
          <div className="boundary-example boundary-example__open">
            <h3>Open content group</h3>
            <p>Use for forms, lists, tables, and related page content.</p>
          </div>
          <Panel className="boundary-example" title="Independent widget">
            <p>Use a framed panel when this region behaves as a dashboard card or standalone unit.</p>
          </Panel>
        </AutoGrid>
      </Stack>
    </PageFrame>
  )
}

const meta = {
  title: 'Composition/Pages',
  component: OperationsPage,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof OperationsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Operations: Story = {}
export const EntityHeader: Story = { render: () => <EntityPageHeader /> }
export const Boundaries: Story = { render: () => <BoundaryDiscipline /> }
