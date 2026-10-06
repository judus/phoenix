import type { EddnLoss } from '@phoenix/contracts'
import { Status } from '@phoenix/ui'

const labels: Record<EddnLoss['reason'], string> = {
  expired: 'expired', invalid: 'invalid', rejected: 'rejected', capacity: 'skipped (capacity limit)',
  cleared: 'cleared by preference/build policy'
}

export function EddnLossSummary({ losses }: { losses: EddnLoss[] }) {
  if (losses.length === 0) return null
  return <Status wrap tone={losses.some(loss => loss.reason !== 'cleared') ? 'warning' : 'muted'}>
    Delivery totals since tracking began: {losses.map(loss => `${loss.count} ${labels[loss.reason]}`).join(' · ')}.
    {' '}These totals survive successful uploads and restarts. Pre-queue filtering and failed checkpoint writes are not counted.
  </Status>
}
