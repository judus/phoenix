import { useEffect, useState } from 'react'
import {
  Breadcrumbs,
  Button,
  IconButton,
  PageFrame,
  PageHeader,
  Section,
  SettingRow,
  SettingsList,
  Status,
  TrashIcon
} from '@phoenix/ui'
import type { PairingDeviceList, PairingInfo, PairingStatus } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { PairingAccess } from '../../components/pairing-access.js'

export function PairingSettingsPage ({ api }: { api: PhoenixApi }) {
  const [status, setStatus] = useState<PairingStatus>()
  const [info, setInfo] = useState<PairingInfo>()
  const [devices, setDevices] = useState<PairingDeviceList>()
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void api.getPairingStatus(abort.signal)
      .then(async nextStatus => {
        setStatus(nextStatus)
        if (!nextStatus.serverDevice) return
        const [nextInfo, nextDevices] = await Promise.all([
          api.getPairingInfo(abort.signal),
          api.getPairingDevices(abort.signal)
        ])
        setInfo(nextInfo)
        setDevices(nextDevices)
      })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  const rotateCode = async (): Promise<void> => {
    setPending('code')
    setError(undefined)
    try {
      setInfo(await api.rotatePairingCode())
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const revokeDevice = async (deviceId: string): Promise<void> => {
    setPending(deviceId)
    setError(undefined)
    try {
      setDevices(await api.revokePairingDevice(deviceId))
    } catch (cause) {
      setError(message(cause))
    } finally {
      setPending(undefined)
    }
  }

  const revokeAll = async (): Promise<void> => {
    setPending('all')
    setError(undefined)
    try {
      await api.revokeAllPairingDevices()
      globalThis.location?.reload()
    } catch (cause) {
      setError(message(cause))
      setPending(undefined)
    }
  }

  return (
    <PageFrame className="settings-page" layout="fit">
      <PageHeader
        context={<Breadcrumbs items={[{ label: 'Settings' }, { label: 'Pairing' }]} />}
        description="Connect browsers and manage access to this PHOENIX installation."
        title="Device pairing"
      />
      <div className="settings-sections">
        {!status
          ? <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading pairing status…'}</Status>
          : <Section description="The installation identity is shared by every paired device." title="Connection">
              <SettingsList>
                <SettingRow description="Unique identity of this PHOENIX installation." scope="Installation" title="Installation ID">
                  <code>{status.installationId}</code>
                </SettingRow>
                <SettingRow description="Access state for this browser." scope="This device" title="Current browser">
                  <Status tone={status.authenticated ? 'positive' : 'warning'}>{status.authenticated ? 'Paired' : 'Not paired'}</Status>
                </SettingRow>
              </SettingsList>
            </Section>}

        {status?.serverDevice && info && <Section actions={<Button busy={pending === 'code'} size="sm" variant="outline" onClick={() => void rotateCode()}>Rotate code</Button>} description="Available only on the PHOENIX computer." title="Pair another device">
          <PairingAccess info={info} />
        </Section>}

        {status?.serverDevice && devices && <Section
          actions={devices.devices.length > 0 ? <Button busy={pending === 'all'} size="sm" variant="danger" onClick={() => void revokeAll()}>Revoke all</Button> : undefined}
          description="Revoked browsers must enter the current pairing code again."
          title="Paired devices"
        >
          {devices.devices.length === 0
            ? <Status tone="muted">No browser sessions are currently paired.</Status>
            : <SettingsList>
                {devices.devices.map(device => <SettingRow
                  description={`Paired ${formatTimestamp(device.pairedAt)} · Last seen ${formatTimestamp(device.lastSeenAt)}`}
                  scope={device.id === devices.currentDeviceId ? 'This browser' : 'Paired browser'}
                  title={device.label}
                  key={device.id}
                >
                  <IconButton
                    busy={pending === device.id}
                    disabled={device.id === devices.currentDeviceId || pending !== undefined}
                    label={device.id === devices.currentDeviceId ? 'Current browser cannot be revoked individually here' : `Revoke ${device.label}`}
                    size="sm"
                    variant="danger"
                    onClick={() => void revokeDevice(device.id)}
                  ><TrashIcon /></IconButton>
                </SettingRow>)}
              </SettingsList>}
        </Section>}

        {status && !status.serverDevice && <Section description="Pairing administration is restricted to the PHOENIX computer." title="This browser">
          <SettingsList>
            <SettingRow description="Remove this browser's access to PHOENIX." scope="This device" title="Unpair browser">
              <Button
                busy={pending === 'release'}
                disabled={!status.pairingRequired || !status.authenticated}
                size="sm"
                variant="danger"
                onClick={() => {
                  setPending('release')
                  void api.releasePairing().then(() => globalThis.location?.reload()).catch(cause => {
                    setError(message(cause))
                    setPending(undefined)
                  })
                }}
              >Unpair</Button>
            </SettingRow>
          </SettingsList>
        </Section>}
        {error && status && <Status tone="danger">{error}</Status>}
      </div>
    </PageFrame>
  )
}

function formatTimestamp (value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.valueOf()) ? value : timestamp.toLocaleString()
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update pairing settings.'
}
