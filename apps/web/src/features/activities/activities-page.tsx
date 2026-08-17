import { useState } from 'react'
import {
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ThirdsGrid
} from '@phoenix/ui'
import type { ActivitiesControllerSnapshot, ActivitiesView } from './use-activities-controller.js'
import { createActivitiesViewModel, type ActivitiesViewModel, type MissionViewModel } from './activities-view-model.js'
import { MissionTitle } from './mission-title.js'
import { SystemLocationLink } from '../../components/system-location-link.js'

type RetainedActivityView = Exclude<ActivitiesView, 'missions'>

const activityViews: Record<RetainedActivityView, { empty: string, ledger: string, title: string }> = {
  objectives: {
    empty: 'No authoritative commander objective record is currently available.',
    ledger: 'Objective ledger',
    title: 'Objectives'
  },
  'community-goals': {
    empty: 'No authoritative Community Goal participation record is currently available.',
    ledger: 'Community Goal ledger',
    title: 'Community goals'
  },
  powerplay: {
    empty: 'No authoritative commander Powerplay record is currently available.',
    ledger: 'Powerplay ledger',
    title: 'Powerplay'
  },
  colonisation: {
    empty: 'No authoritative colonisation construction record is currently available.',
    ledger: 'Colonisation ledger',
    title: 'Colonisation'
  }
}

export function ActivitiesPage({ controller, view }: {
  controller: ActivitiesControllerSnapshot
  view: ActivitiesView
}) {
  if (view !== 'missions') return <ActivityLedger view={view} />
  if (controller.status === 'idle' || controller.status === 'loading') return <ActivitiesState title="Missions" />
  if (controller.status === 'error' || !controller.missions) {
    return <ActivitiesState error={controller.error ?? 'Mission records unavailable.'} title="Missions" />
  }

  const model = createActivitiesViewModel(controller.missions)
  return <Missions model={model} />
}

function ActivitiesState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame aria-busy={!error}>
      <Stack gap="xl">
        <ActivitiesHeader title={title} />
        <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Reconstructing journal-backed mission records…'}</Status>
      </Stack>
    </PageFrame>
  )
}

function Missions({ model }: { model: ActivitiesViewModel }) {
  const [selectedId, setSelectedId] = useState<number>()
  const selected = model.all.find(mission => mission.id === selectedId) ?? model.all[0]

  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <ActivitiesHeader title="Missions" />
        {model.all.length === 0
          ? <Status tone="muted">No missions retained.</Status>
          : (
              <ThirdsGrid fill gap="lg">
                <div className="span-two">
                  <DataTableGroup fill meta={`${model.summary.total} retained`} title="Mission ledger">
                    <MissionTable missions={model.all} onSelect={setSelectedId} selectedId={selected?.id} />
                  </DataTableGroup>
                </div>
                {selected ? <MissionDetail mission={selected} /> : null}
              </ThirdsGrid>
            )}
      </Stack>
    </PageFrame>
  )
}

function MissionTable({ missions, onSelect, selectedId }: {
  missions: MissionViewModel[]
  onSelect?(id: number): void
  selectedId?: number
}) {
  if (missions.length === 0) return <Status tone="muted">No active missions retained.</Status>
  return (
    <DataTable density="compact" label="Mission records" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
      <thead><tr><th>Mission</th><th>Destination</th><th>Status</th></tr></thead>
      <tbody>
        {missions.map(mission => (
          <tr
            aria-selected={mission.id === selectedId || undefined}
            className={mission.id === selectedId ? 'active' : undefined}
            key={mission.id}
            onClick={onSelect ? () => onSelect(mission.id) : undefined}
            onKeyDown={onSelect
              ? event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(mission.id)
                  }
                }
              : undefined}
            tabIndex={onSelect ? 0 : undefined}
          >
            <td>
              <strong>{mission.title}</strong>
              <small>{mission.faction} · {mission.reward}</small>
              <small>Expiry: {mission.expiry}</small>
            </td>
            <td><SystemLocationLink locationName={mission.destinationLocation} systemName={mission.destinationSystem} /></td>
            <td><Status tone={mission.statusTone}>{mission.status}</Status>{mission.incomplete ? <small>Incomplete acceptance details</small> : null}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

function MissionDetail({ mission }: { mission: MissionViewModel }) {
  return (
    <DataTableGroup contentGap="sm" title="Mission details">
      <Stack gap="lg">
        <MissionTitle detail value={mission.title} />
        {mission.incomplete
          ? <Status tone="warning">Acceptance detail was not observed. This record is intentionally incomplete.</Status>
          : null}
        <DescriptionList columns="one" density="compact">
          <DescriptionItem label="Faction" value={mission.faction} />
          <DescriptionItem label="Destination" value={<SystemLocationLink locationName={mission.destinationLocation} systemName={mission.destinationSystem} />} />
          <DescriptionItem label="Target" value={mission.target} />
          <DescriptionItem label="Cargo" value={mission.cargo} />
          <DescriptionItem label="Delivery progress" value={mission.progress} />
          <DescriptionItem label="Reward" value={mission.reward} />
          <DescriptionItem label="Accepted" value={mission.accepted} />
          <DescriptionItem label="Expiry" value={mission.expiry} />
          <DescriptionItem label="Evidence" value={mission.provenance} />
          <DescriptionItem label="Status" value={<Status tone={mission.statusTone}>{mission.status}</Status>} />
        </DescriptionList>
      </Stack>
    </DataTableGroup>
  )
}

function ActivityLedger({ view }: { view: RetainedActivityView }) {
  const content = activityViews[view]

  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <ActivitiesHeader title={content.title} />
        <ThirdsGrid fill gap="lg">
          <div className="span-two">
            <DataTableGroup contentGap="sm" fill meta="0 retained" title={content.ledger}>
              <div><Status tone="muted">{content.empty}</Status></div>
            </DataTableGroup>
          </div>
          <DataTableGroup contentGap="sm" title={`${content.title} details`}>
            <Status tone="muted">Select a retained record to inspect its details.</Status>
          </DataTableGroup>
        </ThirdsGrid>
      </Stack>
    </PageFrame>
  )
}

function ActivitiesHeader({ title }: { title: string }) {
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Activities', href: '#/activities/missions' }, { label: title }]} />}
      title={title}
    />
  )
}
