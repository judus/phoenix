import { useEffect, useState } from 'react'
import type { EddnSubmission, EddnSubmissionDetail, EddnSubmissionLog } from '@phoenix/contracts'
import { Breadcrumbs, Button, DataTable, DataTableGroup, PageFrame, PageHeader, Status } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function EddnPage ({ api }: { api: PhoenixApi }) {
  const [log, setLog] = useState<EddnSubmissionLog>()
  const [selectedId, setSelectedId] = useState<number>()
  const [detail, setDetail] = useState<EddnSubmissionDetail>()
  const [error, setError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    setLog(undefined)
    setSelectedId(undefined)
    setError(undefined)
    const refresh = async () => {
      try {
        const next = await api.getEddnSubmissions(abort.signal)
        if (!abort.signal.aborted) {
          setLog(next)
          setError(undefined)
          setSelectedId(current => next.entries.some(entry => entry.id === current) ? current : next.entries[0]?.id)
        }
      } catch (cause) {
        if (!abort.signal.aborted) setError(message(cause))
      }
      if (!abort.signal.aborted) timer = setTimeout(() => void refresh(), 5000)
    }
    void refresh()
    return () => { abort.abort(); clearTimeout(timer) }
  }, [api])

  useEffect(() => {
    const abort = new AbortController()
    setDetail(undefined)
    setDetailError(undefined)
    if (selectedId !== undefined) {
      void api.getEddnSubmission(selectedId, abort.signal).then(next => {
        if (!abort.signal.aborted) setDetail(next)
      }).catch(cause => { if (!abort.signal.aborted) setDetailError(message(cause)) })
    }
    return () => abort.abort()
  }, [api, selectedId])

  const selected = log?.entries.find(entry => entry.id === selectedId)
  return <PageFrame className="developer-page" layout="fit">
    <PageHeader context={<Breadcrumbs items={[{ label: 'Developer' }, { label: 'EDDN' }]} />}
      title="EDDN submissions" variant="cockpit"
      description={log ? `${log.status.enabled ? 'Enabled' : 'Disabled'} · ${log.status.mode === 'test' ? 'Test stream' : 'Uploads gated'} · ${log.status.queued} queued` : undefined} />
    <div className="developer-tools-workspace">
      <DataTableGroup className="developer-tool-list" fill title="Recent attempts" meta="Up to 100 · 7 days · 16 MiB">
        {error && <Status tone="danger">{error}</Status>}
        {log?.status.error && <Status tone="warning">{log.status.error}</Status>}
        {!log ? <Status tone="muted">Loading submissions…</Status>
          : log.entries.length === 0 ? <Status tone="muted">No submission attempts yet. {log.status.detail}</Status>
            : <DataTable density="compact" label="EDDN submission attempts" narrow="priority" scheme="surface" stickyHeader>
                <thead><tr><th>Observation / result</th></tr></thead>
                <tbody>{log.entries.map(entry => <tr key={entry.id} className={entry.id === selectedId ? 'active' : undefined}>
                  <td><Button variant="quiet" alignment="start" aria-pressed={entry.id === selectedId} onClick={() => setSelectedId(entry.id)}>
                    {observation(entry)}{entry.system ? ` · ${entry.system}` : ''}
                  </Button><div className="text-muted text-xs">{new Date(entry.startedAt).toLocaleString()} · Attempt {entry.attempt}</div>
                  <div className={entry.outcome === 'rejected' ? 'text-danger' : entry.outcome === 'accepted' ? 'text-information' : 'text-muted'}>{outcome(entry)}</div></td>
                </tr>)}</tbody>
              </DataTable>}
      </DataTableGroup>
      <DataTableGroup className="developer-tool-payload" fill title="Submitted payload" meta={selected?.station ?? undefined}>
        <div className="developer-tool-projections single">
          <section>
            <header><h3>{selected ? `${observation(selected)} · ${outcome(selected)}` : 'Select an attempt'}</h3>
              <p>Filtered upload only, including commander uploader ID. Success means EDDN accepted it, not that downstream databases processed it.</p>
              {selected?.retryAt && <p>Retry scheduled at {new Date(selected.retryAt).toLocaleString()} (while contribution remains enabled).</p>}
              {selected?.outcome === 'interrupted' && <p>Request interrupted; remote delivery is uncertain.</p>}
            </header>
            {detailError ? <Status tone="danger">{detailError}</Status>
              : <pre>{detail ? JSON.stringify(detail.payload, null, 2) : selected ? 'Loading payload…' : 'No payload selected.'}</pre>}
          </section>
        </div>
      </DataTableGroup>
    </div>
  </PageFrame>
}

function observation (entry: EddnSubmission): string {
  return entry.event ?? entry.schemaRef.split('/schemas/')[1]?.split('/')[0] ?? 'Observation'
}

function outcome (entry: EddnSubmission): string {
  const label = { sending: 'Sending', accepted: 'Accepted', retry: 'Failed · retry scheduled', rejected: 'Rejected', interrupted: 'Interrupted · outcome unknown' }[entry.outcome]
  return entry.httpStatus === null ? label : `${label} · HTTP ${entry.httpStatus}`
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load EDDN submissions.'
}
