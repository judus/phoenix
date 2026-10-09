import { useState } from 'react'
import type { CommunityGoal } from '@phoenix/contracts'
import {
  Breadcrumbs, DataTableGroup, DescriptionItem, DescriptionList, ItemList, ItemListItem,
  Loading, Meter, PageFrame, PageHeader, Stack, Status, ThirdsGrid
} from '@phoenix/ui'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { SystemLocationLink } from '../../components/system-location-link.js'
import type { ActivitiesControllerSnapshot } from './use-activities-controller.js'
import { formatCommunityGoalExpiry } from '../../application/community-goals/community-goal-expiry.js'

export function CommunityGoalsPage({ controller }: { controller: ActivitiesControllerSnapshot }) {
  const [selectedId, setSelectedId] = useState<string>()
  const response = controller.communityGoals
  const selected = response?.goals.find(goal => goal.id === selectedId) ?? response?.goals[0]
  return <PageFrame layout="fit">
    <Stack fill gap="sm">
      <PageHeader
        context={<Breadcrumbs items={[{ label: 'Activities', href: '#/activities/missions' }, { label: 'Community goals' }]} />}
        status={response ? <UpdatedDateTime value={response.fetchedAt} /> : undefined}
        title="Community goals"
        variant="cockpit"
      />
      {controller.error ? <Status tone="danger" wrap>{controller.error}</Status> : null}
      {response?.cache === 'stale'
        ? <Status tone="warning" wrap>Frontier refresh failed. Showing the last saved goals; availability and progress may have changed.</Status>
        : null}
      {!response
        ? controller.status !== 'error' ? <Loading>Loading Community Goals…</Loading> : null
        : response.goals.length === 0
          ? <Status tone="muted" wrap>{response.cache === 'stale'
            ? 'No goals were listed in the last saved Frontier response.'
            : 'Frontier currently lists no Community Goals.'}</Status>
          : <ThirdsGrid className="community-goals" fill gap="lg">
              <DataTableGroup fill meta={`${response.goals.length} listed`} title="Community Goals">
                <ItemList className="surface" density="compact" aria-label="Community Goals">
                  {response.goals.map(goal => <ItemListItem
                    key={goal.id}
                    onActivate={() => setSelectedId(goal.id)}
                    selected={goal.id === selected?.id}
                    title={goal.title}
                    meta={`${goal.systemName} · ${goal.stationName}`}
                  />)}
                </ItemList>
              </DataTableGroup>
              <div className="span-two" key={selected?.id}>
                {selected ? <GoalDetails goal={selected} /> : null}
              </div>
            </ThirdsGrid>}
    </Stack>
  </PageFrame>
}

function GoalDetails({ goal }: { goal: CommunityGoal }) {
  const progress = goal.contributed / goal.target * 100
  return <DataTableGroup contentGap="sm" title={goal.title}>
    <Stack gap="lg">
      <DescriptionList columns="one" density="compact">
        <DescriptionItem label="Destination" value={<SystemLocationLink systemName={goal.systemName} locationName={goal.stationName} />} />
        <DescriptionItem label="Objective" value={goal.objective} />
        {goal.targetCommodities && goal.targetCommodities !== goal.objective
          ? <DescriptionItem label="Requested" value={goal.targetCommodities} /> : null}
        <DescriptionItem label="Expiry (Frontier time)" value={<time dateTime={goal.expiry.replace(' ', 'T')} title="Frontier does not supply a timezone for this time.">{formatCommunityGoalExpiry(goal.expiry)}</time>} />
      </DescriptionList>
      <Meter
        label="Global progress"
        tone="action"
        value={Math.min(100, progress)}
        valueLabel={`${progress.toFixed(1)}% · ${goal.contributed.toLocaleString('en-GB')} / ${goal.target.toLocaleString('en-GB')}`}
      />
      <article aria-label="Official briefing">
        {goal.briefing.split(/\r?\n/u).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </article>
      <a href="https://www.elitedangerous.com/community/goals/" target="_blank" rel="noreferrer">Frontier Community Goals</a>
    </Stack>
  </DataTableGroup>
}
