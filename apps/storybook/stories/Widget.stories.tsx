import type { Meta, StoryObj } from '@storybook/react-vite'

import { DescriptionItem, DescriptionList } from '../src/components/description-list'
import { AutoGrid, Stack } from '../src/components/layout'
import { Meter } from '../src/components/meter'
import { PageFrame } from '../src/components/page'
import { Widget } from '../src/components/widget'
import { HomeDashboardContent } from '../src/pages/home-dashboard-page'

function WidgetAnatomy() {
  return (
    <PageFrame>
      <AutoGrid minimum="md">
        <Widget title="Widget title" link={<a href="#details">Open details</a>}>
          <span className="text-muted">Widget content</span>
        </Widget>
      </AutoGrid>
    </PageFrame>
  )
}

function WidgetWithDescriptionList() {
  return (
    <PageFrame>
      <AutoGrid minimum="md">
        <Widget title="Vessel">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem label="Name" value="Unnamed vessel" />
            <DescriptionItem label="Identifier" value="EL-06L" />
            <DescriptionItem label="Model" value="Type-11 Prospector" />
            <DescriptionItem label="Manufacturer" value="Lakon Spaceways" />
            <DescriptionItem label="Landing pad" value="Medium" />
            <DescriptionItem label="Hull value" value="67,861,850 CR" />
          </DescriptionList>
        </Widget>
      </AutoGrid>
    </PageFrame>
  )
}

function WidgetWithMetricBar() {
  return (
    <PageFrame>
      <AutoGrid minimum="md">
        <Widget title="Integrity">
          <Stack gap="sm">
            <Meter label="Hull" layout="inline" tone="action" value={100} valueLabel="100%" />
            <Meter label="Shields" layout="inline" tone="action" value={100} valueLabel="100%" />
          </Stack>
        </Widget>
      </AutoGrid>
    </PageFrame>
  )
}

function DashboardWidgetStructures() {
  return (
    <PageFrame>
      <HomeDashboardContent />
    </PageFrame>
  )
}

const meta = {
  title: 'Components/Widget',
  component: WidgetAnatomy,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof WidgetAnatomy>

export default meta
type Story = StoryObj<typeof meta>

export const Anatomy: Story = {}

export const DescriptionListUsage: Story = {
  render: () => <WidgetWithDescriptionList />
}

export const MetricBarUsage: Story = {
  render: () => <WidgetWithMetricBar />
}

export const DashboardStructures: Story = {
  render: () => <DashboardWidgetStructures />
}
