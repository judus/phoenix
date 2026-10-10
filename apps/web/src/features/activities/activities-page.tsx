import { useState, type ReactNode } from 'react'
import { Loading } from '@phoenix/ui'
import {
  Breadcrumbs,
  Button,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  PageFrame,
  PageHeader,
  SortableDataTable,
  Stack,
  Status,
  ThirdsGrid,
  type SortableDataTableColumn
} from '@phoenix/ui'
import type { ActivitiesControllerSnapshot, ActivitiesView } from './use-activities-controller.js'
import { createActivitiesViewModel, type ActivitiesViewModel, type MissionViewModel } from './activities-view-model.js'
import { MissionTitle } from '../../components/mission-title.js'
import { PhoenixCredits } from '../../components/phoenix-credits.js'
import { SystemLocationLink } from '../../components/system-location-link.js'
import { DataSyncNotice } from '../../components/data-sync-notice.js'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { CommunityGoalsPage } from './community-goals-page.js'
import { ColonisationPage } from './colonisation-page.js'

type RetainedActivityView = Exclude<ActivitiesView, 'missions' | 'community-goals' | 'powerplay' | 'colonisation'>

const activityViews: Record<RetainedActivityView, { empty: string, ledger: string, title: string }> = {
  objectives: {
    empty: 'No authoritative commander objective record is currently available.',
    ledger: 'Objective ledger',
    title: 'Objectives'
  },
}

export function ActivitiesPage({ controller, view, onAddNote, selectedMissionId }: {
  controller: ActivitiesControllerSnapshot
  view: Exclude<ActivitiesView, 'powerplay'>
  onAddNote?(missionId: number): void
  selectedMissionId?: number
}) {
  if (view === 'community-goals') return <CommunityGoalsPage controller={controller} />
  if (view === 'colonisation') return <ColonisationPage controller={controller} />
  if (view !== 'missions') return <ActivityLedger view={view} />
  if (controller.status === 'idle' || controller.status === 'loading') return <ActivitiesState title="Missions" />
  if (controller.status === 'error' || !controller.missions) {
    return <ActivitiesState error={controller.error ?? 'Mission records unavailable.'} title="Missions" />
  }

  const model = createActivitiesViewModel(controller.missions)
  return <Missions key={selectedMissionId ?? 'default'} model={model} onAddNote={onAddNote} initialMissionId={selectedMissionId} />
}

function ActivitiesState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame layout="fit">
      <Stack fill gap="xl">
        <ActivitiesHeader title={title} />
        {error ? <Status tone="danger">{error}</Status> : <Loading>Reconstructing journal-backed mission records…</Loading>}
      </Stack>
    </PageFrame>
  )
}

function Missions({ model, onAddNote, initialMissionId }: { model: ActivitiesViewModel, onAddNote?(missionId: number): void, initialMissionId?: number }) {
  const [selectedId, setSelectedId] = useState(initialMissionId)
  const selected = selectedId === undefined ? model.all[0] : model.all.find(mission => mission.id === selectedId)

  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <ActivitiesHeader status={model.updatedAt ? <UpdatedDateTime value={model.updatedAt} /> : undefined} title="Missions" />
        {selectedId !== undefined && !selected ? <Status tone="warning">The linked mission is no longer available in the ledger. Select another mission below.</Status> : null}
        {model.all.length === 0
          ? model.snapshotAt === null
              ? <DataSyncNotice>Awaiting Elite mission manifest. Re-enter the commander session to publish current missions.</DataSyncNotice>
              : <Status tone="muted">No missions were present in the latest Elite manifest.</Status>
          : (
              <ThirdsGrid fill gap="lg">
                <div className="span-two">
                  <DataTableGroup fill meta={`${model.summary.total} retained`} title="Mission ledger">
                    <MissionTable missions={model.all} onSelect={setSelectedId} selectedId={selected?.id} />
                  </DataTableGroup>
                </div>
                {selected ? <MissionDetail mission={selected} onAddNote={onAddNote} /> : null}
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
    <SortableDataTable
      columns={MISSION_COLUMNS}
      density="compact"
      label="Mission records"
      minimum="wide"
      narrow="priority"
      rowKey={mission => mission.id}
      rowProps={mission => ({
        'aria-selected': mission.id === selectedId || undefined,
        className: mission.id === selectedId ? 'active' : undefined,
        onClick: onSelect ? () => onSelect(mission.id) : undefined,
        onKeyDown: onSelect
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(mission.id)
              }
            }
          : undefined,
        tabIndex: onSelect ? 0 : undefined
      })}
      rows={missions}
      scheme="surface"
      stickyHeader
    />
  )
}

const MISSION_COLUMNS: readonly SortableDataTableColumn<MissionViewModel>[] = [
  {
    cell: mission => <>
      <MissionTitle value={mission.title} />
      <small>
        Status: <Status tone={mission.statusTone}>{mission.status}</Status>
        {mission.incomplete ? ' · Incomplete acceptance details' : null}
      </small>
      <small className="table-compact-only">{mission.faction} · <PhoenixCredits value={mission.rewardCredits} /></small>
      <small className="table-compact-only">Expiry: {mission.expiry}</small>
    </>,
    heading: 'Mission',
    id: 'mission',
    sortValue: mission => mission.title
  },
  {
    cell: mission => <SystemLocationLink locationName={mission.destinationLocation} systemName={mission.destinationSystem} />,
    heading: 'Destination',
    id: 'destination',
    sortValue: mission => mission.destination
  },
  {
    cell: mission => mission.faction,
    className: 'table-expanded-only',
    heading: 'Faction',
    id: 'faction',
    sortValue: mission => mission.faction
  },
  {
    cell: mission => <PhoenixCredits value={mission.rewardCredits} />,
    className: 'numeric table-expanded-only',
    heading: 'Reward',
    id: 'reward',
    sortValue: mission => mission.rewardCredits
  },
  {
    cell: mission => mission.expiry,
    className: 'table-expanded-only',
    heading: 'Expiry',
    id: 'expiry',
    sortValue: mission => mission.expiryAt
  },
]

function MissionDetail({ mission, onAddNote }: { mission: MissionViewModel, onAddNote?(missionId: number): void }) {
  return (
    <DataTableGroup contentGap="sm" fill title="Mission details">
      <Stack className="table-region" gap="lg">
        <MissionTitle detail value={mission.title} />
        {onAddNote ? <Button size="sm" variant="outline" onClick={() => onAddNote(mission.id)}>Add note</Button> : null}
        {mission.incomplete
          ? <Status tone="warning">Acceptance detail was not observed. This record is intentionally incomplete.</Status>
          : null}
        <DescriptionList columns="one" density="compact">
          <DescriptionItem label="Faction" value={mission.faction} />
          <DescriptionItem label="Destination" value={<SystemLocationLink locationName={mission.destinationLocation} systemName={mission.destinationSystem} />} />
          {mission.details.map(detail => <DescriptionItem key={detail.label} label={detail.label} value={detail.value} />)}
          <DescriptionItem label="Expected reward" value={<PhoenixCredits value={mission.rewardCredits} />} />
          {mission.receivedCredits !== null ? <DescriptionItem label="Received credits" value={<PhoenixCredits value={mission.receivedCredits} />} /> : null}
          {mission.receivedMaterials !== null ? <DescriptionItem label="Received materials" value={mission.receivedMaterials} /> : null}
          <DescriptionItem label="Accepted" value={mission.accepted} />
          <DescriptionItem label="Expiry" value={mission.expiry} />
          <DescriptionItem label="Status" value={<Status tone={mission.statusTone}>{mission.status}</Status>} />
        </DescriptionList>
        <small>Only observed contract details are shown. Item possession is not objective completion.</small>
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

function ActivitiesHeader({ status, title }: { status?: ReactNode, title: string }) {
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Activities', href: '#/activities/missions' }, { label: title }]} />}
      status={status}
      title={title}
    />
  )
}
