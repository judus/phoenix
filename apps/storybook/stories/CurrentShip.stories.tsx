import type { Meta, StoryObj } from '@storybook/react-vite'

import { CurrentShipPage } from '../src/pages/current-ship-page'
import { CurrentShipConsolidatedPage } from '../src/pages/current-ship-consolidated-page'
import { CurrentShipFlowPage } from '../src/pages/current-ship-flow-page'
import { CurrentShipMatrixPage } from '../src/pages/current-ship-matrix-page'
import '../src/styles/current-ship-stories.css'

function CockpitControlsPreview() {
  return <div className="current-ship-story"><CurrentShipPage /></div>
}

function CockpitMatrixPreview() {
  return <div className="current-ship-story"><CurrentShipMatrixPage /></div>
}

function CockpitConsolidatedPreview() {
  return <div className="current-ship-story"><CurrentShipConsolidatedPage /></div>
}

function CockpitSystemsLeftPreview() {
  return <div className="current-ship-story"><CurrentShipConsolidatedPage arrangement="systems-left" /></div>
}

function CockpitInlineMetersPreview() {
  return <div className="current-ship-story"><CurrentShipConsolidatedPage meterLayout="inline" /></div>
}

function CockpitTileActionsPreview() {
  return (
    <div className="current-ship-story">
      <CurrentShipConsolidatedPage actionStyle="tile" meterLayout="inline" />
    </div>
  )
}

function FlowExplorationPreview() {
  return <div className="current-ship-story flow"><CurrentShipFlowPage /></div>
}

const meta = {
  title: 'Content/Current ship',
  component: CockpitControlsPreview,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof CockpitControlsPreview>

export default meta
type Story = StoryObj<typeof meta>

export const CockpitControls: Story = {}
export const CockpitConsolidated: Story = { render: () => <CockpitConsolidatedPreview /> }
export const CockpitSystemsLeft: Story = { render: () => <CockpitSystemsLeftPreview /> }
export const CockpitInlineMeters: Story = { render: () => <CockpitInlineMetersPreview /> }
export const CockpitTileActions: Story = { render: () => <CockpitTileActionsPreview /> }
export const CockpitMatrix: Story = { render: () => <CockpitMatrixPreview /> }
export const FlowExploration: Story = { render: () => <FlowExplorationPreview /> }
