import { useState, type ReactNode } from 'react'
import {
  Breadcrumbs,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  ItemList,
  ItemListItem,
  PageFrame,
  PageHeader,
  Status
} from '@phoenix/ui'

const topics = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'pairing', label: 'Pairing a device' },
  { id: 'data', label: 'How PHOENIX gets its data' },
  { id: 'missing-data', label: 'Missing or incomplete data' },
  { id: 'control-deck', label: 'Control Deck and focus' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'troubleshooting', label: 'Troubleshooting' }
] as const

export function HelpPage() {
  const [selectedId, setSelectedId] = useState<string>(topics[0].id)

  const select = (id: string) => {
    setSelectedId(id)
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PageFrame className="help-page" layout="fit">
      <PageHeader
        variant="cockpit"
        context={<Breadcrumbs items={[{ label: 'Settings', href: '#/settings' }, { label: 'Help' }]} />}
        title="Help"
      />
      <div className="help-layout">
        <DataTableGroup className="help-index" meta={`${topics.length} sections`} title="Contents">
          <nav className="help-topic-index" aria-label="Help topics">
            <div className="help-index-scroll" tabIndex={0}>
              <ItemList className="surface" density="compact">
                {topics.map((topic, index) => (
                  <ItemListItem
                    aria-current={topic.id === selectedId ? 'location' : undefined}
                    eyebrow={String(index + 1).padStart(2, '0')}
                    key={topic.id}
                    onClick={() => select(topic.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        select(topic.id)
                      }
                    }}
                    role="link"
                    selected={topic.id === selectedId}
                    tabIndex={0}
                    title={topic.label}
                  />
                ))}
              </ItemList>
            </div>
          </nav>
        </DataTableGroup>

        <DataTableGroup className="help-reader-group" title="Manual">
          <article className="help-reader" tabIndex={0}>
          <ManualSection id="getting-started" title="Getting started">
            <h3>Run PHOENIX on the Elite computer</h3>
            <p>PHOENIX reads Elite Dangerous files and executes Control Deck actions on the computer where Elite is installed. Keep the PHOENIX server running while you play.</p>
            <h3>Enter the game once</h3>
            <p>PHOENIX reconstructs commander state from local journal history and live state files. Some pages remain empty until Elite creates the relevant file or publishes the relevant event.</p>
            <h3>Read unknowns literally</h3>
            <p><em>Not reported</em> means PHOENIX has no authoritative evidence yet. It does not mean zero, none, clean, or empty.</p>
          </ManualSection>

          <ManualSection id="pairing" title="Pairing a device">
            <h3>Pair from the host</h3>
            <p>Choose <strong>Pair device</strong> from the PHOENIX launcher or system tray, then open the shown address or scan its QR code on the remote device. Enter the pairing code when requested.</p>
            <h3>Use a trusted local network</h3>
            <p>The host and remote must be reachable on the same LAN or WLAN. Do not use <code>127.0.0.1</code> or <code>localhost</code> on the remote; those addresses point back to the remote itself.</p>
            <h3>The host does the work</h3>
            <p>The paired browser is a remote interface. Elite files, Control Deck actions, catalogues and PHOENIX storage remain on the host computer.</p>
          </ManualSection>

          <ManualSection id="data" title="How PHOENIX gets its data">
            <h3>Local journal history</h3>
            <p>PHOENIX reads retained Elite journal files at startup and follows the active journal while the game runs. Deleted journals and journals created on another computer are not available locally.</p>
            <h3>Live state and snapshot files</h3>
            <p>Status, route, cargo, backpack and ship-locker files describe current state. Other records appear only when Elite publishes a journal snapshot after a particular in-game screen or event.</p>
            <h3>External data</h3>
            <p>Galaxy, station and market tools also use community services. Those reports may be incomplete or stale. PHOENIX labels source and cache information where it matters.</p>
            <p>The complete source inventory is listed under <a href="#/records/credits">Credits</a>.</p>
          </ManualSection>

          <ManualSection id="missing-data" title="Missing or incomplete data">
            <h3>Trigger a fresh snapshot in Elite</h3>
            <DescriptionList columns="one" density="compact">
              <DescriptionItem label="Missions" value="Enter the commander session. Elite publishes the current mission manifest at startup." />
              <DescriptionItem label="Stored ships" value="Open Starport Services → Shipyard." />
              <DescriptionItem label="Stored modules" value="Open Starport Services → Outfitting." />
              <DescriptionItem label="Current ship" value="Enter the commander session or change the outfitting loadout." />
            </DescriptionList>
            <h3>Journals do not synchronize between computers</h3>
            <p>Frontier synchronizes commander state, not the complete local journal archive. Playing on another computer can leave gaps in the history available to PHOENIX.</p>
            <h3>Empty and unknown are different</h3>
            <p>Once an authoritative snapshot has been observed, an empty result means Elite reported no records. Until then, PHOENIX preserves the source as unsynchronized instead of inventing an answer.</p>
          </ManualSection>

          <ManualSection id="control-deck" title="Control Deck and application focus">
            <Status marker={false} tone="warning" wrap>PHOENIX cannot know which application currently has keyboard focus. A Control Deck button intended for Elite can affect another focused application, including triggering destructive shortcuts.</Status>
            <h3>Bindings define availability</h3>
            <p>PHOENIX reads the active Elite Dangerous keyboard bindings. A control is unavailable when no compatible keyboard binding can be resolved.</p>
            <h3>Keep Elite focused</h3>
            <p>Use Control Deck from a paired device so Elite can retain focus on the host. Check the focused application before using actions with meaningful consequences.</p>
            <h3>Tap, hold and safety actions differ</h3>
            <p>Tap actions execute once. Hold actions remain active while held. Safety actions require the additional confirmation shown by the interface.</p>
          </ManualSection>

          <ManualSection id="copilot" title="Copilot">
            <h3>Copilot is optional</h3>
            <p>Core PHOENIX features do not require OpenAI. Copilot becomes available only after an API key is configured in <a href="#/settings">Settings</a> and requires internet access.</p>
            <h3>Text and audio leave the host</h3>
            <p>When Copilot is used, prompts and any enabled voice input are sent to OpenAI to produce responses. Review the active profile and permissions before using it.</p>
            <h3>Permissions are deliberate</h3>
            <p>Copilot can only use the PHOENIX tools and actions allowed by its configuration. Keep command execution disabled unless you want the selected profile to operate controls.</p>
          </ManualSection>

          <ManualSection id="troubleshooting" title="Troubleshooting">
            <h3>A remote cannot connect</h3>
            <p>Confirm that PHOENIX is running, both devices are on the same network, the remote uses the host computer’s LAN address, and the host firewall permits the PHOENIX port.</p>
            <h3>A page is empty or stale</h3>
            <p>Read its source status first. If it awaits an Elite snapshot, perform the listed in-game trigger and return to the page. Restarting PHOENIX does not make Elite publish missing data.</p>
            <h3>A Control Deck button is unavailable</h3>
            <p>Check the active Elite bindings and ensure the action has a keyboard binding. Controller-only bindings cannot be reproduced as keyboard input.</p>
            <h3>An action went to the wrong application</h3>
            <p>Return focus to Elite on the host before trying again. PHOENIX sends the configured input; it does not change or verify the focused application.</p>
          </ManualSection>
          </article>
        </DataTableGroup>
      </div>
    </PageFrame>
  )
}

function ManualSection({ children, id, title }: { children: ReactNode, id: string, title: string }) {
  return <section id={`help-${id}`}><header><h2>{title}</h2></header><div>{children}</div></section>
}
