import type { ReactNode } from 'react'
import { Breadcrumbs, PageHeader } from '@phoenix/ui'

type EngineeringBreadcrumb = {
  href?: string
  label: string
}

export function EngineeringHeader ({ actions, status, title, trail }: {
  actions?: ReactNode
  status?: ReactNode
  title: string
  trail: EngineeringBreadcrumb[]
}) {
  return (
    <PageHeader
      actions={actions}
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Engineering', href: '#/engineering/blueprints' }, ...trail]} />}
      status={status}
      title={title}
    />
  )
}
