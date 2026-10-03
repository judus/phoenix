import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApplicationShell, Button, Content, Navigation, Rail, TopBar, Workspace } from '@phoenix/ui'
import { ControlDeckCommandCatalogueSchema } from 'control-deck/core'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../../server/src/infrastructure/default-control-deck-configuration'
import { ControlsPage } from '../../web/src/features/controls/controls-page'
import { controlsNavigationItems } from '../../web/src/features/controls/controls-navigation'
import type { MacroRuntime } from '../../web/src/application/macros/macro-runtime'

const noOp = async () => {}
const macros: MacroRuntime = {
  library: { version: 1, macros: [] }, abort: noOp, cancelRecording: noOp, deleteMacro: noOp,
  play: noOp, recordAction: noOp, save: noOp, startRecording: noOp, stopRecording: noOp
}
const commands = ControlDeckCommandCatalogueSchema.parse({ adapters: [{
  id: 'phoenix.commands', version: '1', label: 'PHOENIX', available: true, simulated: false,
  detail: 'Story fixture', platformRequirements: [], holdOwner: 'adapter',
  commands: DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(deck => deck.context === 'phoenix:quick')!.elements
    .filter(element => element.kind === 'command').map(element => ({
      id: element.target.commandId, label: element.appearance.label, description: 'Open internal page', category: 'Pages',
      available: true, unavailableReason: null, risk: 'safe', simulated: false, operations: ['tap'], configurationSchema: {}
    }))
}] })

function QuickAccess({ elite = false }: { elite?: boolean }) {
  const [configuration, setConfiguration] = useState(DEFAULT_CONTROL_DECK_CONFIGURATION)
  const [editing, setEditing] = useState(false)
  const [destination, setDestination] = useState('Quick access')
  return <div className={`tablet-shell-story${elite ? ' theme-elite' : ''}`}>
    <ApplicationShell>
      <TopBar brand={<strong>{destination}</strong>} utilities={<Button onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit deck'}</Button>} />
      <Workspace>
        <Rail label="Controls"><Navigation variant="compact" current="quick" label="Controls" items={controlsNavigationItems} /></Rail>
        <Content><ControlsPage category="quick" controller={{ status: 'ready', configuration, commands }} editing={editing}
          macros={macros} variableFontSizes onEditingChange={setEditing} onExecuteAction={noOp}
          onExecuteNavigation={async target => setDestination(target.destinationId)}
          onSaveConfiguration={async saved => { setConfiguration(saved); return saved }} /></Content>
      </Workspace>
    </ApplicationShell>
  </div>
}

export default { title: 'Content/Quick access', component: QuickAccess, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof QuickAccess>
type Story = StoryObj<typeof QuickAccess>
export const Phoenix: Story = {}
export const Elite: Story = { args: { elite: true } }
