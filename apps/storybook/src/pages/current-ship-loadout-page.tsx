import { useState } from 'react'

import { Button } from '../components/button'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './current-ship-loadout-page.css'

type LoadoutView = 'list' | 'grid'

type Slot = {
  condition?: string
  engineering?: string
  module?: string
  moduleClass?: string
  size: string
  slot: string
  state?: string
  status?: 'broken' | 'disabled'
  type: string
}

type SlotGroup = {
  label: string
  slots: Slot[]
}

const loadout: SlotGroup[] = [
  {
    label: 'Core internals',
    slots: [
      { slot: 'Armour', size: '1', type: 'Bulkheads', module: 'Lightweight Alloy', moduleClass: '1I', condition: '100%', state: 'Standard' },
      { slot: 'Power plant', size: '6', type: 'Core internal', module: 'Power Plant', moduleClass: '6A', engineering: 'Overcharged G3', condition: '100%', state: 'Enabled · P1' },
      { slot: 'Thrusters', size: '5', type: 'Core internal', module: 'Thrusters', moduleClass: '5A', engineering: 'Dirty Drive G2', condition: '100%', state: 'Enabled · P0' },
      { slot: 'Frame shift drive', size: '5', type: 'Core internal', module: 'Frame Shift Drive (SCO)', moduleClass: '5A', engineering: 'Increased Range G5', condition: '100%', state: 'Enabled · P2' },
      { slot: 'Life support', size: '3', type: 'Core internal', module: 'Life Support', moduleClass: '3D', condition: '100%', state: 'Enabled · P2' },
      { slot: 'Power distributor', size: '7', type: 'Core internal', module: 'Power Distributor', moduleClass: '7A', engineering: 'Charge Enhanced G4', condition: '100%', state: 'Enabled · P2' },
      { slot: 'Sensors', size: '3', type: 'Core internal', module: 'Sensors', moduleClass: '3D', engineering: 'Lightweight G3', condition: '0%', state: 'Broken', status: 'broken' },
      { slot: 'Fuel tank', size: '5', type: 'Core internal', module: '32 t Fuel Tank', moduleClass: '5C', condition: '100%', state: 'Disabled', status: 'disabled' }
    ]
  },
  {
    label: 'Optional internals',
    slots: [
      { slot: 'Optional 01', size: '8', type: 'Optional internal', module: 'Cargo Rack', moduleClass: '8E', condition: '100%', state: '256 t' },
      { slot: 'Optional 02', size: '7', type: 'Optional internal', module: 'Universal Multi-Limpet Controller', moduleClass: '7A', condition: '100%', state: 'Enabled · P3' },
      { slot: 'Optional 03', size: '6', type: 'Optional internal', module: 'Shield Generator', moduleClass: '6A', engineering: 'Reinforced G4', condition: '100%', state: 'Enabled · P2' },
      { slot: 'Optional 04', size: '5', type: 'Optional internal', module: 'Guardian FSD Booster', moduleClass: '5H', condition: '100%', state: '+10.5 ly' },
      { slot: 'Optional 05', size: '4', type: 'Optional internal', module: 'Fuel Scoop', moduleClass: '4A', condition: '100%', state: 'Enabled · P3' },
      { slot: 'Optional 06', size: '3', type: 'Optional internal', module: 'Collector Limpet Controller', moduleClass: '3D', condition: '100%', state: 'Enabled · P3' },
      { slot: 'Optional 07', size: '2', type: 'Optional internal', module: 'Cargo Rack', moduleClass: '2E', condition: '100%', state: '4 t' },
      { slot: 'Optional 08', size: '1', type: 'Optional internal' }
    ]
  },
  {
    label: 'Hardpoints',
    slots: [
      { slot: 'Hardpoint 01', size: '3', type: 'Large hardpoint', module: 'Seismic Charge Launcher', moduleClass: '3B', condition: '100%', state: 'Turreted · P0' },
      { slot: 'Hardpoint 02', size: '2', type: 'Medium hardpoint', module: 'Sub-Surface Displacement Missile', moduleClass: '2B', condition: '100%', state: 'Fixed · P0' },
      { slot: 'Hardpoint 03', size: '2', type: 'Medium hardpoint', module: 'Mining Laser', moduleClass: '2D', engineering: 'Long Range G2', condition: '100%', state: 'Fixed · P1' },
      { slot: 'Hardpoint 04', size: '1', type: 'Small hardpoint', module: 'Abrasion Blaster', moduleClass: '1D', condition: '100%', state: 'Fixed · P0' },
      { slot: 'Hardpoint 05', size: '1', type: 'Small hardpoint' },
      { slot: 'Hardpoint 06', size: '1', type: 'Small hardpoint' }
    ]
  },
  {
    label: 'Utility mounts',
    slots: [
      { slot: 'Utility 01', size: '0', type: 'Utility mount', module: 'Pulse Wave Analyser', moduleClass: '0A', condition: '100%', state: 'Enabled · P0' },
      { slot: 'Utility 02', size: '0', type: 'Utility mount', module: 'Heat Sink Launcher', moduleClass: '0I', condition: '100%', state: 'Enabled · P0' },
      { slot: 'Utility 03', size: '0', type: 'Utility mount', module: 'Shield Booster', moduleClass: '0A', engineering: 'Heavy Duty G3', condition: '100%', state: 'Enabled · P2' },
      { slot: 'Utility 04', size: '0', type: 'Utility mount' }
    ]
  }
]

function SlotInventory({ view }: { view: LoadoutView }) {
  return (
    <div className={`loadout-inventory ${view}`} tabIndex={0}>
      {loadout.map((group) => {
        const mounted = group.slots.filter((slot) => slot.module).length

        return (
          <section key={group.label}>
            <header>
              <h2>{group.label}</h2>
              <small>{mounted} / {group.slots.length} mounted</small>
            </header>
            <ol>
              {group.slots.map((slot) => (
                <li
                  className={[
                    !slot.module && 'empty',
                    slot.engineering && (slot.engineering.endsWith('G5') ? 'engineered-max' : 'engineered'),
                    slot.status
                  ].filter(Boolean).join(' ') || undefined}
                  data-slot-size={`S${slot.size}`}
                  key={slot.slot}
                >
                  <header>
                    <strong>{slot.slot}</strong>
                    <small>Size {slot.size}</small>
                  </header>
                  <div>
                    <strong>{slot.module ? `${slot.moduleClass} ${slot.module}` : 'Empty slot'}</strong>
                    <small>{slot.type}</small>
                  </div>
                  <div>
                    <span>{slot.engineering ?? 'Standard'}</span>
                    <small>{slot.engineering ? 'Engineered' : 'Configuration'}</small>
                  </div>
                  <footer>
                    <strong>{slot.condition ?? '—'}</strong>
                    <small>{slot.state ?? 'Available'}</small>
                  </footer>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

export function CurrentShipLoadoutPage() {
  const [view, setView] = useState<LoadoutView>('list')

  return (
    <PageFrame layout="fit">
      <div className="current-ship-loadout">
        <PageHeader
          variant="cockpit"
          context={
            <Breadcrumbs
              items={[
                { label: 'Fleet', href: '#fleet' },
                { label: 'Current ship', href: '#current-ship' },
                { label: 'Loadout' }
              ]}
            />
          }
          title="Type-11 Prospector"
          actions={
            <Button
              className="view-switcher"
              variant="quiet"
              role="switch"
              aria-checked={view === 'grid'}
              aria-label="Grid view"
              data-view={view}
              title={`Switch to ${view === 'list' ? 'grid' : 'list'} view`}
              onClick={() => setView(view === 'list' ? 'grid' : 'list')}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="M2 3.5h12M2 8h12M2 12.5h12" />
              </svg>
              <span className="track" aria-hidden="true"><span /></span>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <rect x="2" y="2" width="4" height="4" />
                <rect x="10" y="2" width="4" height="4" />
                <rect x="2" y="10" width="4" height="4" />
                <rect x="10" y="10" width="4" height="4" />
              </svg>
            </Button>
          }
        />
        <SlotInventory view={view} />
      </div>
    </PageFrame>
  )
}
