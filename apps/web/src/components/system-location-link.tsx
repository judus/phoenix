import { useState } from 'react'
import { IconButton, Inline, Stack } from '@phoenix/ui'
import { phoenixRouteHash } from '../application/navigation/phoenix-router.js'

export function SystemLocationLink({ locationName, systemName }: {
  locationName?: string | null
  systemName?: string | null
}) {
  const [copied, setCopied] = useState<'system' | 'location'>()
  if (!systemName) return <>—</>

  const copy = async (value: string, target: 'system' | 'location'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(target)
    } catch {
      setCopied(undefined)
    }
  }

  return (
    <Stack className="system-location" gap="xxs">
      <LocationRow
        copied={copied === 'system'}
        href={phoenixRouteHash({ kind: 'information', section: 'galaxy', view: 'system', systemName })}
        label={systemName}
        onCopy={() => copy(systemName, 'system')}
      />
      {locationName
        ? <LocationRow
            child
            copied={copied === 'location'}
            href={phoenixRouteHash({ kind: 'information', section: 'galaxy', view: 'system', systemName, selectedName: locationName })}
            label={locationName}
            onCopy={() => copy(locationName, 'location')}
          />
        : null}
    </Stack>
  )
}

export function SystemSchematicLink({ label, selectedName, systemName }: {
  label?: string | null
  selectedName?: string | null
  systemName?: string | null
}) {
  const [copied, setCopied] = useState(false)
  if (!label || !systemName) return <>—</>

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(label)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Stack className="system-location" gap="xxs">
      <LocationRow
        copied={copied}
        href={phoenixRouteHash({
          kind: 'information',
          section: 'galaxy',
          view: 'system',
          systemName,
          ...(selectedName ? { selectedName } : {})
        })}
        label={label}
        onCopy={copy}
      />
    </Stack>
  )
}

function LocationRow({ child = false, copied, href, label, onCopy }: {
  child?: boolean
  copied: boolean
  href: string
  label: string
  onCopy(): Promise<void>
}) {
  return (
    <Inline className="system-location-row" gap="xxs" wrap={false}>
      {child ? <span aria-hidden="true">└─</span> : null}
      <a href={href}>{label}</a>
      <IconButton
        label={copied ? `Copied ${label}` : `Copy ${label}`}
        onClick={event => {
          event.stopPropagation()
          void onCopy()
        }}
        size="sm"
        variant="quiet"
      >
        <CopyIcon />
      </IconButton>
    </Inline>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="8" y="8" width="11" height="11" />
      <path d="M16 8V5H5v11h3" />
    </svg>
  )
}
