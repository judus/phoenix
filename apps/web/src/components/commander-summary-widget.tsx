import { DescriptionItem, DescriptionList, Meter, Widget } from '@phoenix/ui'
import { PhoenixCredits } from './phoenix-credits.js'

export interface CommanderSummaryWidgetProps {
  className?: string
  credits: number | null
  legalState: string | null
  name: string
  notoriety: {
    label: string
    value: number
  } | null
}

export function CommanderSummaryWidget({ className, credits, legalState, name, notoriety }: CommanderSummaryWidgetProps) {
  const negativeLegalState = legalState !== null && legalState.toLocaleLowerCase() !== 'clean'

  return (
    <Widget
      aria-label="Commander summary"
      className={['commander-summary-widget', className].filter(Boolean).join(' ')}
      density="compact"
    >
      <DescriptionList className="commander-summary-list" columns="two" density="compact">
        <DescriptionItem
          className="commander-identity"
          label="Commander"
          labelTone="action"
          value={<strong>{name.toUpperCase()}</strong>}
        />
        <DescriptionItem
          className={negativeLegalState ? 'commander-legal-state-negative' : undefined}
          label="Legal status"
          labelTone="action"
          value={legalState ?? '—'}
        />
        <DescriptionItem label="Credits" labelTone="action" value={<PhoenixCredits value={credits} />} />
        <DescriptionItem
          label="Notoriety"
          labelTone="action"
          title="Commander-wide criminal notoriety. Zero is normal; higher values indicate escalating criminal attention."
          value={notoriety ? (
            <Meter
              label="Commander notoriety"
              layout="compact"
              max={10}
              showValue={false}
              tone={notoriety.value > 0 ? 'danger' : 'action'}
              value={notoriety.value}
              valueLabel={notoriety.label}
            />
          ) : '—'}
        />
      </DescriptionList>
    </Widget>
  )
}
