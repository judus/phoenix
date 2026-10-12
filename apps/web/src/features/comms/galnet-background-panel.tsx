import { Button, DataTable, DataTableGroup, ItemList, ItemListItem, MetricStrip, MetricStripItem, Notification, Stack, Status } from '@phoenix/ui'
import { Fragment } from 'react'
import type { GalnetBackgroundJob } from '@phoenix/contracts'
import type { GalnetRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { useGalnetBackground, type GalnetBackgroundApi } from '../../components/use-galnet-background.js'

export function GalnetBackgroundPanel({ api, readingRoute = { kind: 'information', section: 'comms', view: 'galnet' } }: { api: GalnetBackgroundApi, readingRoute?: GalnetRoute }) {
  const { status, error, pending, change } = useGalnetBackground(api)
  const batch = status?.backlog.slice(0, 20) ?? []
  const active = status?.jobs.filter(job => job.state === 'pending' || job.state === 'running') ?? []
  const recent = status?.jobs.filter(job => job.state !== 'pending' && job.state !== 'running') ?? []
  return <div className="galnet-background-page"><Stack gap="lg">
    <Notification message={error} />
    <Notification message={status?.sourceError} tone="warning" />
    {!status ? <Status tone="muted">Reading analysis queue…</Status> : <>
      <MetricStrip columns={4}>
        <MetricStripItem label="Automatic analysis" value={status.enabled ? 'On' : 'Off'} detail={<a href="#/settings/copilot">Settings</a>} />
        <MetricStripItem label="Waiting" value={status.pending} />
        <MetricStripItem label="Running" value={active.filter(job => job.state === 'running').length} />
        <MetricStripItem label="Attempts today" value={`${status.requestsToday} / ${status.dailyLimit}`} />
      </MetricStrip>
      {!status.configured ? <Status tone="warning" wrap>Configure an API key and restart PHOENIX to analyse.</Status>
        : status.requestsToday >= status.dailyLimit && <Status tone="warning" wrap>Daily limit reached. Waiting work resumes when the next day's allowance is available.</Status>}
      <div className="galnet-background-layout">
        <Stack gap="lg">
          <DataTableGroup title="Analysis queue" meta={`${active.length} active`}>
            {active.length ? <JobTable jobs={active} label="Analysis queue" readingRoute={readingRoute} /> : <Status tone="muted">No analysis queued.</Status>}
          </DataTableGroup>
          <DataTableGroup title="Recent results" meta={`${recent.length} jobs`}>
            {recent.length ? <JobTable jobs={recent} label="Recent analysis results" readingRoute={readingRoute} /> : <Status tone="muted">No recent analysis work.</Status>}
          </DataTableGroup>
        </Stack>
        <DataTableGroup title="Older articles" meta={`${status.backlog.length} eligible`} contentGap="sm">
          <Status wrap tone="muted">Automatic analysis handles newly received articles. Older coverage is queued manually, newest uncovered first.</Status>
          <Button variant="primary" busy={pending} disabled={!status.configured || batch.length === 0}
        onClick={() => void change(signal => api.catchUpGalnet(batch.map(article => article.articleId), signal))}>
        Analyse older articles{batch.length > 0 ? ` (${batch.length})` : ''}
      </Button>
          <Status wrap tone="muted">Manual catch-up uses API credit. Up to 20 per batch, from the latest 100 archived articles; the daily limit applies.</Status>
          {status.backlog.length ? <ItemList density="compact" aria-label="Articles eligible for catch-up">{status.backlog.map(article =>
            <ItemListItem key={article.articleId} title={article.title} href={phoenixRouteHash({ ...readingRoute, selectedArticleId: article.articleId })}
              eyebrow={<PhoenixDateTime value={article.publishedAt} precision="date" />} />)}</ItemList> : <Status tone="muted">No older articles need analysis in the latest archive window.</Status>}
        </DataTableGroup>
      </div>
    </>}
  </Stack></div>
}

function JobTable({ jobs, label, readingRoute }: { jobs: GalnetBackgroundJob[], label: string, readingRoute: GalnetRoute }) {
  const reasons = { article: 'New article', 'community-goal': 'Community Goal update', 'catch-up': 'Manual catch-up', 'story-context': 'Story update' }
  const states = { pending: 'Waiting', running: 'Running', succeeded: 'Completed', failed: 'Failed', skipped: 'Skipped' }
  return <DataTable label={label} density="compact" scheme="surface" narrow="scroll">
    <thead><tr><th className="col-fill">Article</th><th className="col-fit">Status</th><th className="col-fit">Updated</th></tr></thead>
    <tbody>{jobs.map(job => <Fragment key={job.id}><tr>
      <th scope="row" className="col-fill"><a href={phoenixRouteHash({ ...readingRoute, selectedArticleId: job.articleId })}>{job.title}</a><small>{reasons[job.reason]}</small></th>
      <td className="col-fit"><Status tone={job.state === 'failed' ? 'danger' : job.state === 'running' ? 'information' : job.state === 'succeeded' ? 'positive' : 'muted'}>{states[job.state]}</Status></td>
      <td className="col-fit"><PhoenixDateTime value={job.finishedAt ?? job.startedAt ?? job.queuedAt} /></td>
    </tr>{job.error && <tr><td className="wrap" colSpan={3}><details><summary>{job.state === 'failed' ? 'Failure details' : 'Details'}</summary><p>{job.error}</p></details></td></tr>}</Fragment>)}</tbody>
  </DataTable>
}
