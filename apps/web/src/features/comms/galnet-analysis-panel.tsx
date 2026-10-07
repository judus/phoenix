import { useEffect, useRef, useState } from 'react'
import type { GalnetAnalysis, GalnetAnalysisResponse } from '@phoenix/contracts'
import { Button, DataTableGroup, DescriptionItem, DescriptionList, Inline, ItemList, ItemListItem, Stack, Status } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'

export type GalnetAnalysisApi = Pick<PhoenixApi, 'getGalnetAnalysis' | 'analyseGalnetArticle'>

export function GalnetAnalysisPanel({ api, articleId }: { api: GalnetAnalysisApi, articleId: string }) {
  const [snapshot, setSnapshot] = useState<GalnetAnalysisResponse>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    void api.getGalnetAnalysis(articleId, controller.signal).then(value => {
      if (!controller.signal.aborted) setSnapshot(value)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Analysis unavailable.')
    })
    return () => controller.abort()
  }, [api, articleId])

  const analyse = async () => {
    const signal = request.current!.signal
    setBusy(true)
    setError(undefined)
    try {
      const result = await api.analyseGalnetArticle(articleId, signal)
      if (!signal.aborted) setSnapshot(result)
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Analysis failed.')
    } finally {
      if (!signal.aborted) setBusy(false)
    }
  }

  return <DataTableGroup title="AI analysis" contentGap="sm" actions={<Button size="sm" busy={busy}
    disabled={!snapshot?.configured || !snapshot.articleAvailable} onClick={() => { void analyse() }}>
    {snapshot?.analysis ? 'Update analysis' : 'Analyse article'}
  </Button>}>
    <Stack gap="md">
      <Status wrap tone="muted">Optional · uses your configured OpenAI model and API credit. Nothing runs automatically; unchanged evidence reuses the saved report.</Status>
      {!snapshot && !error && <Status tone="muted">Reading saved analysis…</Status>}
      {snapshot && !snapshot.configured && <Status wrap tone="warning">Configure an OpenAI API key in Settings to analyse articles. Saved reports remain readable.</Status>}
      {snapshot && !snapshot.articleAvailable && <Status wrap tone="warning">This article has not been archived yet. Refresh the news after its cache expires.</Status>}
      {snapshot?.articleChanged && <Status wrap tone="warning">The article has changed since this report. Update analysis to use the latest archived revision.</Status>}
      {snapshot?.analysis?.schemaVersion === 1 && <Status wrap tone="muted">This saved report predates investigation destinations. Update analysis explicitly to extract them for the Atlas; this may use API credit.</Status>}
      {error && <Status wrap tone="danger" role="alert">{error}</Status>}
      {snapshot?.analysis && <GalnetAnalysisReport analysis={snapshot.analysis} />}
    </Stack>
  </DataTableGroup>
}

export function GalnetAnalysisReport({ analysis }: { analysis: GalnetAnalysis }) {
  const { content } = analysis
  const activities = analysis.schemaVersion === 2 ? analysis.content.activities
    : analysis.content.activities.map(activity => ({ ...activity, destination: null }))
  const linked = activities.filter(activity => activity.communityGoalId !== null)
  const leads = activities.filter(activity => activity.communityGoalId === null)
  return <Stack gap="lg">
    <Status wrap>{content.summary}</Status>
    <DescriptionList density="compact">
      <DescriptionItem label="Analysed" value={<><PhoenixDateTime value={analysis.analysedAt} /> · {analysis.model}</>} />
      <DescriptionItem label="Community Goals snapshot" value={<><PhoenixDateTime value={analysis.communityGoals.fetchedAt} /> · {analysis.communityGoals.cache}</>} />
      <DescriptionItem label="Token usage" value={<>{analysis.usage.inputTokens ?? 'Unknown'} input · {analysis.usage.outputTokens ?? 'Unknown'} output</>} />
    </DescriptionList>
    {analysis.communityGoals.cache === 'stale' && <Status wrap tone="warning">Community Goals were stale when analysed; campaign availability may have changed.</Status>}
    <Status wrap tone="muted">AI interpretation of dated evidence, not live gameplay status. Goal progress and destinations below are from the saved Frontier snapshot.</Status>
    <Inline><a href={analysis.sourceUrl} target="_blank" rel="noreferrer">Article source</a><a href="#/activities/community-goals">Current Community Goals</a></Inline>
    {content.facts.length > 0 && <Claims title="Reported facts" claims={content.facts} />}
    {content.interpretations.length > 0 && <Claims title="Interpretation" claims={content.interpretations} />}
    {linked.length > 0 && <DataTableGroup title="Related Community Goals">
      <ItemList density="compact">{linked.map(activity => {
        const goal = analysis.communityGoals.goals.find(candidate => candidate.id === activity.communityGoalId)!
        return <ItemListItem key={goal.id} title={goal.title} eyebrow={`${activity.relationship} link · AI assessment`}
          description={activity.action} meta={<>{goal.stationName} · {goal.systemName} · {goal.contributed.toLocaleString()} / {goal.target.toLocaleString()} · “{activity.evidence}”</>} />
      })}</ItemList>
    </DataTableGroup>}
    {leads.length > 0 && <DataTableGroup title="Separate investigation leads">
      <ItemList density="compact">{leads.map((activity, index) => <ItemListItem key={index} title={activity.title}
        eyebrow={`Reported status: ${activity.status}`} description={activity.action}
        meta={`“${activity.evidence}”${activity.destination ? ` · Destination: ${activity.destination.systemName}` : ''}`} />)}</ItemList>
    </DataTableGroup>}
    {content.entities.length > 0 && <DataTableGroup title="Mentioned entities">
      <ItemList density="compact">{content.entities.map((entity, index) => <ItemListItem key={index} title={entity.name}
        eyebrow={entity.kind} description={entity.role} meta={`“${entity.evidence}”`} />)}</ItemList>
    </DataTableGroup>}
    {content.activities.length === 0 && <Status tone="muted">No actionable activity identified in this article.</Status>}
  </Stack>
}

function Claims({ title, claims }: { title: string, claims: GalnetAnalysis['content']['facts'] }) {
  return <DataTableGroup title={title}><ItemList density="compact">{claims.map((claim, index) =>
    <ItemListItem key={index} title={claim.text} meta={`“${claim.evidence}”`} />)}</ItemList></DataTableGroup>
}
