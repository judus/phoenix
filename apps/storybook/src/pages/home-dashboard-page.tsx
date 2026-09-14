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
          <Widget aria-label="Commander log" className="span-two" eyebrow="Commander log" link={<a href="#journal">Open journal</a>} scrollable>
            <ItemList density="compact">
              <ItemListItem eyebrow="Mission" title="Mission completed" description="Deliver medicines · Galileo, Sol" leading={<time>18:28</time>} trailing="+125,000 CR" />
              <ItemListItem eyebrow="Trade" title="Commodity sold" description="32 units · Advanced Catalysers" leading={<time>18:11</time>} trailing="+186,000 CR" />
              <ItemListItem eyebrow="Career" title="Exploration rank advanced" description="Ranger" leading={<time>17:42</time>} />
            </ItemList>
          </Widget>

          <Widget aria-label="Local traffic" eyebrow="Local traffic" link={<a href="#traffic">Traffic log</a>} scrollable>
            <ItemList density="compact">
              <ItemListItem eyebrow="Commander · Star system" title="CMDR LAKONMINER" description="o7" trailing={<time>2 min ago</time>} />
              <ItemListItem eyebrow="NPC · Local" title="LOCKE TERMINAL" description="Docking request granted." trailing={<time>6 min ago</time>} />
            </ItemList>
          </Widget>
        </>
      }
    >
      <Widget aria-label="Commander summary" className="span-two" density="compact">
        <DescriptionList className="commander-summary-list" columns="two" density="compact">
          <DescriptionItem className="commander-identity" label="Commander" labelTone="action" value={<strong>ELLAN MURDOCK</strong>} />
          <DescriptionItem label="Legal status" labelTone="action" value="Clean" />
          <DescriptionItem label="Balance" labelTone="action" value={<span className="currency">2,438,917,604 CR</span>} />
          <DescriptionItem label="Notoriety" labelTone="action" value="0" />
        </DescriptionList>
      </Widget>

      <Widget
        className="span-two"
        detail="Locke Terminal"
        eyebrow="Situation"
        heading="COL 285 SECTOR OK-C B14-5"
        link={<a href="#galaxy">System schematic</a>}
      >
        <Stack gap="sm">
          <DescriptionList columns="two" density="compact">
            <DescriptionItem label="Security" value="Low security" />
            <DescriptionItem label="Economy" value="High tech" />
            <DescriptionItem label="Allegiance" value="Independent" />
            <DescriptionItem label="Population" value="92,095,611" />
          </DescriptionList>
        </Stack>
      </Widget>

      <Widget aria-label="Copilot" eyebrow="Copilot" link={<a href="#channel">Open channel</a>}>
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

      <Widget detail="EL-06L" eyebrow="Current ship" heading="TYPE-11 PROSPECTOR" link={<a href="#ship">View ship</a>}>
        <Stack gap="sm">
          <EqualGrid columns={3} gap="xs">
            <Metric density="compact" label="Hull" value="100%" />
            <Metric density="compact" label="Cargo" value="3/196" />
            <Metric density="compact" label="Jump" value="22.4 ly" />
          </EqualGrid>
        </Stack>
      </Widget>

      <Widget detail="19 jumps remaining" eyebrow="Route" heading="WREDGUIA UK-V B30-1" link={<a href="#route">View route</a>}>
        <Stack gap="sm">
          <DescriptionList columns="one" density="compact">
            <DescriptionItem label="Current" value="Col 285 Sector OK-C b14-5" />
            <DescriptionItem label="Destination" value="HIP 115894" />
          </DescriptionList>
        </Stack>
      </Widget>

      <Widget eyebrow="Galnet radio" heading="GALNET AUDIO" link={<a href="#remote">Open remote</a>}>
        <Stack gap="sm" fill justify="end">
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
