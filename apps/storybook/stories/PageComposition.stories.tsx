import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@phoenix/ui'
import { ControlContext } from '@phoenix/ui'
import { Field, Select, TextInput } from '@phoenix/ui'
import { AutoGrid, Inline, Stack } from '@phoenix/ui'
import { DescriptionItem, DescriptionList } from '@phoenix/ui'
import { Metric } from '@phoenix/ui'
import { PageFrame, PageHeader, Panel, Section } from '@phoenix/ui'
import '../src/styles/page-stories.css'

function RouteForm() {
  return (
    <ControlContext className="route-form" context="panel">
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
      <Inline justify="end">
        <Button variant="quiet">Clear</Button>
        <Button variant="primary">Calculate route</Button>
      </Inline>
    </ControlContext>
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
          <DescriptionList className="route-summary">
            <DescriptionItem label="First waypoint" value="HIP 97950" />
            <DescriptionItem label="Refuel strategy" value="Scoop when projected reserve falls below 45%" />
            <DescriptionItem label="Warnings" value="Two systems have incomplete service data" />
          </DescriptionList>
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
          <div className="boundary-example open">
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
