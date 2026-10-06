import { Breadcrumbs, Loading, PageFrame, PageHeader, Status } from '@phoenix/ui'
import type { ReactNode } from 'react'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'

export function EquipmentPageLayout({ busy = false, children, error, loadingMessage, title, trail, updatedAt }: {
  busy?: boolean
  children?: ReactNode
  error?: string
  loadingMessage?: string
  title: string
  trail?: Array<{ label: string, href?: string }>
  updatedAt?: string | null
}) {
  return (
    <PageFrame className="record-page" layout="fit" aria-busy={(busy && !loadingMessage) || undefined}>
      <div className="record-page-layout">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Equipment', href: '#/equipment/gear' }, ...(trail ?? [{ label: title }])]} />}
          title={title}
          status={updatedAt ? <UpdatedDateTime value={updatedAt} /> : undefined}
        />
        {error ? <Status tone="danger">{error}</Status>
          : loadingMessage ? <Loading>{loadingMessage}</Loading> : children}
      </div>
    </PageFrame>
  )
}
