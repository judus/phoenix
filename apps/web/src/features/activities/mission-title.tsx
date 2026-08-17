export interface MissionTitleParts {
  eyebrow?: string
  title: string
}

export function splitMissionTitle(value: string): MissionTitleParts {
  const separator = value.indexOf(':')
  if (separator < 0) return { title: value }

  const eyebrow = value.slice(0, separator).trim()
  const title = value.slice(separator + 1).trim()
  return eyebrow && title ? { eyebrow, title } : { title: value }
}

export function MissionTitle({ detail = false, value }: { detail?: boolean, value: string }) {
  const title = splitMissionTitle(value)
  return (
    <span className={['mission-title', detail && 'detail'].filter(Boolean).join(' ')}>
      {title.eyebrow ? <small>{title.eyebrow}</small> : null}
      <strong>{title.title}</strong>
    </span>
  )
}
