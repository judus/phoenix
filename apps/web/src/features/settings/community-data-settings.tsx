import { useEffect, useRef, useState } from 'react'
import { Section, SettingsList, SettingRow, SettingToggle, Status } from '@phoenix/ui'
import type { EddnStatus } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function CommunityDataSettings ({ api }: { api: PhoenixApi }) {
  const [status, setStatus] = useState<EddnStatus>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const lifetime = useRef<{ api: PhoenixApi, abort: AbortController, saving: boolean, revision: number } | undefined>(undefined)

  useEffect(() => {
    const owner = { api, abort: new AbortController(), saving: false, revision: 0 }
    lifetime.current = owner
    setStatus(undefined)
    setError(undefined)
    setPending(false)
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      if (owner.abort.signal.aborted) return
      if (!owner.saving) {
        const revision = owner.revision
        try {
          const next = await api.getEddnStatus(owner.abort.signal)
          if (!owner.abort.signal.aborted && revision === owner.revision) { setStatus(next); setError(undefined) }
        } catch (cause) {
          if (!owner.abort.signal.aborted && revision === owner.revision) setError(message(cause))
        }
      }
      if (!owner.abort.signal.aborted) timer = setTimeout(() => void refresh(), 5000)
    }
    void refresh()
    return () => { owner.abort.abort(); clearTimeout(timer) }
  }, [api])

  const save = async () => {
    const owner = lifetime.current
    if (!status || !owner || owner.api !== api || owner.abort.signal.aborted || owner.saving) return
    owner.saving = true
    owner.revision++
    setPending(true)
    setError(undefined)
    try {
      const next = await api.saveEddnSettings({ enabled: !status.enabled })
      if (!owner.abort.signal.aborted) setStatus(next)
    } catch (cause) {
      if (!owner.abort.signal.aborted) setError(message(cause))
    } finally {
      owner.saving = false
      if (!owner.abort.signal.aborted) setPending(false)
    }
  }

  return <Section title="Community data" description="Shared by every paired device. Enabled by default.">
    <SettingsList>
      <SettingRow title="Contribute observations to EDDN" scope="Installation"
        description="Share observed systems, scans and station stock with community databases, including location, observation time, commander uploader ID and game/app versions. Personal journal fields are filtered out. Turning this off clears pending uploads; transmitted data cannot be recalled.">
        <SettingToggle checked={status?.enabled ?? true} disabled={!status || pending} label={status?.enabled === false ? 'Off' : 'On'} onChange={() => void save()} />
      </SettingRow>
      {status && <SettingRow title="Contribution status" description={status.detail}>
        <span>{status.queued} queued · {status.lastSuccessAt ? `Last sent ${new Date(status.lastSuccessAt).toLocaleString()}` : 'Nothing sent yet'}</span>
      </SettingRow>}
    </SettingsList>
    {(error || status?.error) && <Status tone="warning">{error ?? status?.error}</Status>}
  </Section>
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update contribution settings.'
}
