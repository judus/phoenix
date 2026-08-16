import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@phoenix/ui'
import { CommandTile } from '@phoenix/ui'
import { ControlContext } from '@phoenix/ui'
import { Field, Select, TextInput } from '@phoenix/ui'
import { AutoGrid, Inline, Stack } from '@phoenix/ui'
import '../src/styles/control-stories.css'

const commands = [
  { label: 'Toggle galaxy map', binding: 'G' },
  { label: 'Panic button', kind: 'macro' as const, meta: 'Safe' },
  { label: 'Supercruise', binding: 'J' },
  { label: 'Hyperspace', binding: 'LeftShift+J' },
  { label: 'Use boost juice', unavailable: true },
  { label: 'Ship lights', binding: 'L' },
  { label: 'Landing gear', binding: 'Numpad_1', selected: true },
  { label: 'Night vision', binding: 'Numpad_9' },
  { label: 'Eject all cargo', binding: 'LeftShift+Numpad_0', tone: 'danger' as const }
]

function ButtonSection() {
  return (
    <Stack gap="sm">
      <h2>Buttons and context</h2>
      <ControlContext context="toolbar" density="compact">
        <Inline gap="xs">
          <strong>Toolbar context</strong>
          <Button variant="quiet">Cancel</Button>
          <Button variant="primary">Save layout</Button>
        </Inline>
      </ControlContext>
      <ControlContext context="panel">
        <Stack gap="sm">
          <p className="text-muted">
            Variants keep their meaning while presentation and density are inherited explicitly.
          </p>
          <Inline>
            <Button variant="primary">Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="quiet">Quiet action</Button>
            <Button variant="danger">Dangerous</Button>
            <Button disabled>Unavailable</Button>
            <Button busy>Busy</Button>
          </Inline>
          <Inline align="end">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Inline>
        </Stack>
      </ControlContext>
    </Stack>
  )
}

function FormSection() {
  return (
    <Stack gap="sm">
      <h2>Form controls</h2>
      <ControlContext context="panel">
        <Stack>
          <AutoGrid minimum="md">
            <Field htmlFor="reference-system" label="Reference system" hint="Current location is used by default.">
              <TextInput defaultValue="Col 285 Sector OK-C B14-5" />
            </Field>
            <Field htmlFor="minimum-pad" label="Minimum pad">
              <Select defaultValue="medium">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </Select>
            </Field>
            <Field htmlFor="commodity" label="Commodity" error="Choose a known commodity." required>
              <TextInput placeholder="Search commodities" />
            </Field>
          </AutoGrid>
          <Inline className="actions" justify="end">
            <Button variant="quiet">Reset</Button>
            <Button variant="primary">Search</Button>
          </Inline>
        </Stack>
      </ControlContext>
    </Stack>
  )
}

function CommandSection() {
  return (
    <Stack gap="sm">
      <h2>Adaptive command grid</h2>
      <p className="text-muted">
        Resize the canvas and switch PHOENIX/ELITE in the Storybook toolbar. The same semantic tiles
        become restrained terminal controls or bold cockpit blocks.
      </p>
      <ControlContext className="command-story-region" context="command" density="comfortable">
        <AutoGrid gap="sm" minimum="sm">
          {commands.map((command) => <CommandTile key={command.label} {...command} />)}
        </AutoGrid>
      </ControlContext>
    </Stack>
  )
}

function ControlsOverview() {
  return (
    <main className="control-story">
      <Stack gap="xxl">
        <Stack gap="xs">
          <h1>Controls</h1>
          <p className="text-muted">
            Atomic controls composed through explicit context, density, and responsive primitives.
          </p>
        </Stack>
        <ButtonSection />
        <FormSection />
        <CommandSection />
      </Stack>
    </main>
  )
}

const meta = {
  title: 'Components/Controls',
  component: ControlsOverview,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof ControlsOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}

export const CommandGrid: Story = {
  render: () => (
    <main className="control-story">
      <CommandSection />
    </main>
  )
}

export const FormControls: Story = {
  render: () => (
    <main className="control-story">
      <FormSection />
    </main>
  )
}
