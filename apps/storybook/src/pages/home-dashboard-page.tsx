import { Avatar } from '@phoenix/ui'
import { IconButton } from '@phoenix/ui'
import { DescriptionItem, DescriptionList } from '@phoenix/ui'
import { Identity } from '@phoenix/ui'
import { ItemList, ItemListItem } from '@phoenix/ui'
import { DashboardGrid, EqualGrid, Inline, Stack } from '@phoenix/ui'
import { Metric } from '@phoenix/ui'
import { PageFrame } from '@phoenix/ui'
import { Status } from '@phoenix/ui'
import { Widget } from '@phoenix/ui'

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6" />
    </svg>
  )
}

function PreviousIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 5v14M19 5 8 12l11 7V5Z" /></svg>
}

function PlayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z" /></svg>
}

function NextIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 5v14M5 5l11 7-11 7V5Z" /></svg>
}

function StopIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" /></svg>
}

export function HomeDashboardContent() {
  return (
    <DashboardGrid
      lastRow={
        <>
          <Widget className="span-two" title="Recent activity" link={<a href="#journal">Open journal</a>}>
            <ItemList density="compact">
              <ItemListItem title="Inventory cargo changed" leading={<time>18:28</time>} trailing="Runtime" />
              <ItemListItem title="Ship loadout changed" leading={<time>18:28</time>} trailing="Runtime" />
              <ItemListItem title="Location changed" leading={<time>18:28</time>} trailing="Runtime" />
            </ItemList>
          </Widget>

          <Widget title="Attention">
            <Status tone="muted">No immediate telemetry warnings.</Status>
          </Widget>
        </>
      }
    >
      <Widget className="span-full" title="Commander" meta="Total credits">
        <EqualGrid columns={2}>
          <Metric value="ELLAN MURDOCK" />
          <Metric className="text-end" value="2,438,917,604 CR" />
        </EqualGrid>
      </Widget>

      <Widget className="span-two" title="Situation" link={<a href="#galaxy">Open galaxy</a>}>
        <Stack gap="sm">
          <Metric value="COL 285 SECTOR OK-C B14-5" detail="Locke Terminal" />
          <DescriptionList columns="two" density="compact">
            <DescriptionItem label="Security" value="Low security" />
            <DescriptionItem label="Economy" value="High tech" />
            <DescriptionItem label="Allegiance" value="Independent" />
            <DescriptionItem label="Population" value="92,095,611" />
          </DescriptionList>
        </Stack>
      </Widget>

      <Widget title="Copilot" link={<a href="#channel">Open channel</a>}>
        <Stack fill justify="center">
          <Inline align="center" justify="space-between">
            <Identity
              title="Marin"
              detail={<Status tone="muted">Offline</Status>}
              leading={<Avatar aria-hidden="true">M</Avatar>}
            />
            <IconButton label="Connect voice" size="lg"><MicrophoneIcon /></IconButton>
          </Inline>
        </Stack>
      </Widget>

      <Widget title="Current ship" link={<a href="#controls">Ship controls</a>}>
        <Stack gap="sm">
          <Metric value="TYPE-11 PROSPECTOR" detail="EL-06L" />
          <EqualGrid columns={3} gap="xs">
            <Metric density="compact" label="Hull" value="100%" />
            <Metric density="compact" label="Cargo" value="3 / 196" />
            <Metric density="compact" label="Jump" value="22.4 ly" />
          </EqualGrid>
        </Stack>
      </Widget>

      <Widget title="Route" link={<a href="#route">Open route</a>}>
        <Stack gap="sm">
          <Metric value="WREDGUIA UK-V B30-1" detail="19 jumps remaining" />
          <DescriptionList columns="one" density="compact">
            <DescriptionItem label="Current" value="Col 285 Sector OK-C b14-5" />
            <DescriptionItem label="Destination" value="HIP 115894" />
          </DescriptionList>
        </Stack>
      </Widget>

      <Widget title="Galnet radio" link={<a href="#remote">Open remote</a>}>
        <Stack gap="sm" fill justify="space-between">
          <Metric value="GALNET AUDIO" />
          <EqualGrid columns={4} gap="xs">
            <IconButton label="Previous" shape="landscape" size="md"><PreviousIcon /></IconButton>
            <IconButton label="Stop" shape="landscape" size="md"><StopIcon /></IconButton>
            <IconButton label="Play" shape="landscape" size="md"><PlayIcon /></IconButton>
            <IconButton label="Next" shape="landscape" size="md"><NextIcon /></IconButton>
          </EqualGrid>
        </Stack>
      </Widget>
    </DashboardGrid>
  )
}

export function HomeDashboardPage() {
  return (
    <PageFrame layout="fit">
      <HomeDashboardContent />
    </PageFrame>
  )
}
