import { Breadcrumbs, PageFrame, PageHeader, Status } from '@phoenix/ui'
import type { ReactNode } from 'react'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'

export function EquipmentPageLayout({ busy = false, children, error, loadingMessage, title, updatedAt }: {
  busy?: boolean
  children?: ReactNode
  error?: string
  loadingMessage?: string
  title: string
  updatedAt?: string | null
}) {
  return (
    <PageFrame className="record-page" layout="fit" aria-busy={busy || undefined}>
      <div className="record-page-layout">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Equipment', href: '#/equipment/gear' }, { label: title }]} />}
          title={title}
          status={updatedAt ? <UpdatedDateTime value={updatedAt} /> : undefined}
        />
        {error || loadingMessage
          ? <Status tone={error ? 'danger' : 'muted'}>{error ?? loadingMessage}</Status>
          : children}
      </div>
    </PageFrame>
  )
}
