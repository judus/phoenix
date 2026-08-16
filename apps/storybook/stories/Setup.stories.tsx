import type { Meta, StoryObj } from '@storybook/react-vite'

function Setup() {
  return <p>Storybook is ready.</p>
}

const meta = {
  title: 'Setup',
  component: Setup
} satisfies Meta<typeof Setup>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}
