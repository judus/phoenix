import { useMemo, useState } from 'react'
import {
  Button,
  ChevronRightIcon,
  Meter,
  SettingRow,
  SettingsList,
  SettingToggle,
  Status
} from '@phoenix/ui'
import type {
  CopilotCapability,
  CopilotCapabilityCatalogue,
  CopilotCapabilityGroup,
  CopilotCapabilitySubgroup,
  CopilotPermissionPolicy
} from '@phoenix/contracts'

export function CopilotPermissionEditor ({
  capabilities,
  disabled = false,
  onChange,
  permissions,
  visibleCapabilityIds
}: {
  capabilities: CopilotCapabilityCatalogue
  disabled?: boolean
  onChange(permissions: CopilotPermissionPolicy): void
  permissions: CopilotPermissionPolicy
  visibleCapabilityIds?: readonly string[]
}) {
  const groups = useMemo(() => filterGroups(capabilities.groups, visibleCapabilityIds), [capabilities.groups, visibleCapabilityIds])

  const toggleCapability = (id: string): void => {
    const enabled = new Set(permissions.enabledCapabilityIds)
    if (enabled.has(id)) enabled.delete(id)
    else enabled.add(id)
    onChange({ version: 2, enabledCapabilityIds: [...enabled].sort() })
  }

  const setCapabilities = (items: readonly CopilotCapability[], enabled: boolean): void => {
    const ids = new Set(permissions.enabledCapabilityIds)
    for (const capability of items) {
      if (enabled) ids.add(capability.id)
      else ids.delete(capability.id)
    }
    onChange({ version: 2, enabledCapabilityIds: [...ids].sort() })
  }

  return <>
    <div className="copilot-load">
      <Meter
        label="AI load"
        layout="inline"
        tone={loadTone(capabilities.load.level)}
        value={capabilities.load.percentage}
        valueLabel={`${capabilities.load.percentage}%`}
      />
      <Status tone={loadStatusTone(capabilities.load.level)} wrap>
        {loadMessage(capabilities.load.level)}
      </Status>
      <small>
        {capabilities.load.enabled.fixedTools} fixed tools / {capabilities.load.enabled.gameActions} controls / {capabilities.load.enabled.macros} macros
      </small>
    </div>
    <div className="capability-groups">
      {groups.map(group => <CapabilityGroup
        group={group}
        key={group.id}
        pending={disabled}
        onSetCapabilities={setCapabilities}
        onToggleCapability={toggleCapability}
      />)}
    </div>
  </>
}

function CapabilityGroup ({ group, onSetCapabilities, onToggleCapability, pending }: {
  group: CopilotCapabilityGroup
  onSetCapabilities(capabilities: readonly CopilotCapability[], enabled: boolean): void
  onToggleCapability(id: string): void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const capabilities = groupCapabilities(group)
  const enabled = capabilities.filter(capability => capability.enabled).length
  return <details className="capability-group" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <CapabilitySummary enabled={enabled} label={group.label} total={capabilities.length} />
    {open && <>
      <CapabilityActions capabilities={capabilities} enabled={enabled} pending={pending} onSet={onSetCapabilities} />
      {group.capabilities.length > 0 && <CapabilityRows capabilities={group.capabilities} pending={pending} onToggle={onToggleCapability} />}
      {group.subgroups.length > 0 && <div className="capability-subgroups">
        {group.subgroups.map(subgroup => <CapabilitySubgroup
          key={subgroup.id}
          subgroup={subgroup}
          pending={pending}
          onSetCapabilities={onSetCapabilities}
          onToggleCapability={onToggleCapability}
        />)}
      </div>}
    </>}
  </details>
}

function CapabilitySubgroup ({ onSetCapabilities, onToggleCapability, pending, subgroup }: {
  subgroup: CopilotCapabilitySubgroup
  onSetCapabilities(capabilities: readonly CopilotCapability[], enabled: boolean): void
  onToggleCapability(id: string): void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const enabled = subgroup.capabilities.filter(capability => capability.enabled).length
  return <details className="capability-subgroup" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <CapabilitySummary enabled={enabled} label={subgroup.label} total={subgroup.capabilities.length} />
    {open && <>
      <CapabilityActions capabilities={subgroup.capabilities} enabled={enabled} pending={pending} onSet={onSetCapabilities} />
      <CapabilityRows capabilities={subgroup.capabilities} pending={pending} onToggle={onToggleCapability} />
    </>}
  </details>
}

function CapabilitySummary ({ enabled, label, total }: { enabled: number, label: string, total: number }) {
  return <summary><span className="capability-summary-label"><ChevronRightIcon /><strong>{label}</strong></span><small>{enabled} / {total} enabled</small></summary>
}

function CapabilityActions ({ capabilities, enabled, onSet, pending }: {
  capabilities: readonly CopilotCapability[]
  enabled: number
  onSet(capabilities: readonly CopilotCapability[], enabled: boolean): void
  pending: boolean
}) {
  return <div className="actions">
    <Button disabled={pending || enabled === capabilities.length} size="sm" type="button" variant="quiet" onClick={() => onSet(capabilities, true)}>Enable all</Button>
    <Button disabled={pending || enabled === 0} size="sm" type="button" variant="quiet" onClick={() => onSet(capabilities, false)}>Disable all</Button>
  </div>
}

function CapabilityRows ({ capabilities, onToggle, pending }: {
  capabilities: readonly CopilotCapability[]
  onToggle(id: string): void
  pending: boolean
}) {
  return <SettingsList>{capabilities.map(capability => <SettingRow
    description={capability.description}
    key={capability.id}
    scope={<>
      {`${capabilityScope(capability.kind, capability.access)}${capability.risk && capability.risk !== 'safe' ? ` — ${capability.risk}` : ''}${capability.available ? '' : ' — unavailable'}`}
      <code className="capability-id">{capability.id}</code>
    </>}
    title={capability.label}
  >
    <SettingToggle
      aria-label={`${capability.label} capability`}
      checked={capability.enabled}
      disabled={pending}
      label={capability.enabled ? 'On' : 'Off'}
      onChange={() => onToggle(capability.id)}
    />
  </SettingRow>)}</SettingsList>
}

function filterGroups (groups: readonly CopilotCapabilityGroup[], visibleCapabilityIds?: readonly string[]): CopilotCapabilityGroup[] {
  if (visibleCapabilityIds === undefined) return [...groups]
  const visible = new Set(visibleCapabilityIds)
  return groups.flatMap(group => {
    const capabilities = group.capabilities.filter(capability => visible.has(capability.id))
    const subgroups = group.subgroups.flatMap(subgroup => {
      const items = subgroup.capabilities.filter(capability => visible.has(capability.id))
      return items.length === 0 ? [] : [{ ...subgroup, capabilities: items }]
    })
    return capabilities.length === 0 && subgroups.length === 0 ? [] : [{ ...group, capabilities, subgroups }]
  })
}

function groupCapabilities (group: CopilotCapabilityGroup): CopilotCapability[] {
  return [...group.capabilities, ...group.subgroups.flatMap(subgroup => subgroup.capabilities)]
}

function loadTone (level: CopilotCapabilityCatalogue['load']['level']): 'success' | 'warning' | 'danger' {
  return level === 'focused' ? 'success' : level === 'broad' ? 'warning' : 'danger'
}

function loadStatusTone (level: CopilotCapabilityCatalogue['load']['level']): 'positive' | 'warning' | 'danger' {
  return level === 'focused' ? 'positive' : level === 'broad' ? 'warning' : 'danger'
}

function loadMessage (level: CopilotCapabilityCatalogue['load']['level']): string {
  if (level === 'focused') return 'Focused — Copilot has a concise capability set.'
  if (level === 'broad') return 'Broad — Copilot may require more clarification.'
  return 'AI overloaded — expect misunderstandings and incorrect tool selection.'
}

function capabilityScope (kind: CopilotCapability['kind'], access: CopilotCapability['access']): string {
  if (kind === 'game-action') return 'Control Deck command'
  if (kind === 'macro') return 'Macro'
  if (access === 'display') return 'Display navigation'
  if (access === 'external') return 'External data'
  return 'Read only'
}
