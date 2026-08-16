import type { Meta, StoryObj } from '@storybook/react-vite'

import { FleetPage } from '../src/pages/fleet-page'

const meta = {
  title: 'Content/Fleet',
  component: FleetPage,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FleetPage>

export default meta
type Story = StoryObj<typeof meta>

export const Registry: Story = {}
