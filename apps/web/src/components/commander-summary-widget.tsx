import { DescriptionItem, DescriptionList, Meter, Metric, ThirdsGrid, Widget } from '@phoenix/ui'
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
  return (
    <div className={className}>
      <ThirdsGrid gap="sm">
        <Widget
          className="span-two"
          density="compact"
          eyebrow="Commander"
          heading={name.toUpperCase()}
          aside={<Metric className="commander-total-credits text-end" label="Total credits" value={<PhoenixCredits value={credits} />} />}
        />
        <Widget density="compact">
        <DescriptionList className="commander-legal-status-list" columns="one" density="compact">
          <DescriptionItem label="Legal status" labelTone="action" value={legalState ?? '—'} />
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
                tone="action"
                value={notoriety.value}
                valueLabel={notoriety.label}
              />
            ) : '—'}
          />
        </DescriptionList>
        </Widget>
      </ThirdsGrid>
    </div>
  )
}
