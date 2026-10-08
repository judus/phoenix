import { Button, DataTableGroup, ItemList, ItemListItem, Stack, Status } from '@phoenix/ui'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { useGalnetBackground, type GalnetBackgroundApi } from '../../components/use-galnet-background.js'

export function GalnetBackgroundPanel({ api }: { api: GalnetBackgroundApi }) {
  const { status, error, pending, change } = useGalnetBackground(api)
  const batch = status?.backlog.slice(0, 20) ?? []
  return <details><summary>Intelligence · {status?.enabled ? 'Automatic' : 'Manual'}{status ? ` · ${status.pending} queued` : ''}</summary>
    <DataTableGroup title="Background analysis" contentGap="sm">
    <Stack gap="sm">
      <Status wrap tone="muted">Automatic analysis: {status ? status.enabled ? 'On' : 'Off' : '…'} · <a href="#/settings/copilot">Settings</a></Status>
      {status && <Status wrap>{status.requestsToday} / {status.dailyLimit} attempts today · {status.pending} queued</Status>}
      <Button size="sm" busy={pending} disabled={!status?.configured || batch.length === 0}
        onClick={() => void change(signal => api.catchUpGalnet(batch.map(article => article.articleId), signal))}>
        Analyse older articles{batch.length > 0 ? ` (${batch.length})` : ''}
      </Button>
      <Status wrap tone="muted">Manual catch-up uses API credit. Checks the latest 100 archived articles, newest uncovered first, up to 20 per batch; the daily queue limit still applies.</Status>
      {(error || status?.sourceError) && <Status tone="warning" wrap>{error ?? status?.sourceError}</Status>}
      {status && !status.configured && <Status tone="muted" wrap>Configure an API key and restart PHOENIX to analyse.</Status>}
      {status && status.jobs.length > 0 && <details><summary>Recent analysis work</summary>
        <ItemList density="compact">{status.jobs.map(job => <ItemListItem key={job.id} title={job.title}
          eyebrow={`${job.state} · ${job.reason}`} description={job.error}
          meta={<PhoenixDateTime value={job.finishedAt ?? job.startedAt ?? job.queuedAt} />} />)}</ItemList>
      </details>}
    </Stack>
    </DataTableGroup>
  </details>
}
