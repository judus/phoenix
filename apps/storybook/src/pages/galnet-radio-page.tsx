import { IconButton } from '@phoenix/ui'
import { PageFrame } from '@phoenix/ui'
import { Widget } from '@phoenix/ui'

function PreviousIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 5v14M19 5 8 12l11 7V5Z" /></svg>
}

function PlayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 5 12 7-12 7V5Z" /></svg>
}

function NextIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 5v14M5 5l11 7-11 7V5Z" /></svg>
}

function StopIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
}

export function GalnetRadioPage() {
  return (
    <PageFrame className="galnet-radio-page" layout="fit">
      <Widget className="galnet-radio-display" title="GalNet Radio" />

      <div className="galnet-radio-controls" role="group" aria-label="GalNet Radio controls">
        <IconButton label="Previous"><PreviousIcon /></IconButton>
        <IconButton label="Stop"><StopIcon /></IconButton>
        <IconButton label="Play"><PlayIcon /></IconButton>
        <IconButton label="Next"><NextIcon /></IconButton>
      </div>
    </PageFrame>
  )
}
