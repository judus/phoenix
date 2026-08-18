import {
  Breadcrumbs,
  DashboardColumns,
  DescriptionItem,
  DescriptionList,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  Widget
} from '@phoenix/ui'

export function HelpPage() {
  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Settings', href: '#/settings' }, { label: 'Help & Q&A' }]} />}
          title="Help & Q&A"
        />
        <DashboardColumns
          primary={<SynchronizationQuestions />}
          secondary={<SnapshotTriggers />}
        />
      </Stack>
    </PageFrame>
  )
}

function SynchronizationQuestions() {
  return (
    <Widget title="Elite data synchronization" meta="Local journal evidence">
      <Stack gap="lg">
        <section>
          <h3>Why is a page empty when Elite has the data?</h3>
          <p>Elite exposes some commander data only through local journal events. PHOENIX shows an explicit waiting state until the required event has been observed.</p>
        </section>
        <section>
          <h3>Do journals synchronize between computers?</h3>
          <p>No. Each computer retains the events generated while Elite was running there. Frontier synchronizes commander state, not the complete local journal archive.</p>
        </section>
        <section>
          <h3>Why not assume that an empty response means none?</h3>
          <p>Missing evidence and an authoritative empty snapshot are different states. PHOENIX preserves that distinction rather than inventing commander state.</p>
        </section>
        <section>
          <h3>Will PHOENIX update after Elite publishes a snapshot?</h3>
          <p>Yes. Keep PHOENIX running, open the relevant Elite screen, then return to the PHOENIX page. Live journal events update the durable local record.</p>
        </section>
      </Stack>
    </Widget>
  )
}

function SnapshotTriggers() {
  return (
    <>
      <Widget title="Snapshot triggers" meta="In Elite">
        <DescriptionList columns="one" density="compact">
          <DescriptionItem label="Missions" value="Enter the commander session. Elite publishes the current mission manifest at startup." />
          <DescriptionItem label="Stored ships" value="Open Starport Services → Shipyard." />
          <DescriptionItem label="Stored modules" value="Open Starport Services → Outfitting." />
          <DescriptionItem label="Current ship" value="Enter the commander session or change the outfitting loadout." />
        </DescriptionList>
      </Widget>
      <Widget title="Source status" meta="Operational rule">
        <Status marker={false} tone="information" wrap>PHOENIX labels unsynchronized sources. Once a snapshot is observed, an empty result means Elite reported no records.</Status>
      </Widget>
    </>
  )
}
