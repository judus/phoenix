import { DescriptionItem, DescriptionList, EqualGrid, Meter, Metric, ThirdsGrid, Widget } from '@phoenix/ui'

export interface CommanderSummaryWidgetProps {
  className?: string
  credits: string | null
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
        <Widget className="span-two" density="compact">
          <EqualGrid columns={2} gap="xs">
            <Metric label="Commander" labelTone="action" value={name.toUpperCase()} />
            <Metric className="text-end" label="Total credits" value={credits ?? '—'} />
          </EqualGrid>
        </Widget>
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
