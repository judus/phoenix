import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ApplicationShell, Content, Navigation, Rail, TopBar, Workspace } from '@phoenix/ui'
import { GalacticAtlas } from '../../web/src/features/galaxy/galactic-atlas-page'
import { galaxyNavigationItems } from '../../web/src/features/galaxy/galaxy-navigation'
import type { AtlasMarker } from '../../web/src/features/galaxy/galactic-atlas-model'

const bookmarks: AtlasMarker[] = [
  { id: 'expedition', kind: 'bookmark', label: 'Expedition stop', systemName: 'Fixture system', position: [-7000, 620, 10000] },
  { id: 'station', kind: 'bookmark', label: 'Jaques Station', systemName: 'Colonia', selectedName: 'Jaques Station', position: [-9530.5, -910.28125, 19808.125] }
]

function AtlasStory({ elite = false, unknown = false }: { elite?: boolean, unknown?: boolean }) {
  const [visible, setVisible] = useState(true)
  const [destination, setDestination] = useState('PHOENIX')
  return <div className={`tablet-shell-story${elite ? ' theme-elite' : ''}`}>
    <ApplicationShell>
      <TopBar brand={<strong>{destination}</strong>} />
      <Workspace>
        <Rail label="Galaxy"><Navigation variant="compact" label="Galaxy" current="atlas" items={galaxyNavigationItems} /></Rail>
        <Content><GalacticAtlas bookmarks={visible ? bookmarks : []} onNavigate={route => setDestination(JSON.stringify(route))}
          onToggleBookmarks={() => setVisible(value => !value)} position={unknown ? null : [-3500, 245, 15500]}
          showBookmarks={visible} systemName={unknown ? null : 'Expedition location'} /></Content>
      </Workspace>
    </ApplicationShell>
  </div>
}

export default { title: 'Content/Galactic atlas', component: AtlasStory, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof AtlasStory>
type Story = StoryObj<typeof AtlasStory>
export const Phoenix: Story = {}
export const Elite: Story = { args: { elite: true } }
export const NoPosition: Story = { args: { unknown: true } }
