import type { ReactNode } from 'react'
import { Breadcrumbs, PageHeader } from '@phoenix/ui'

type EngineeringBreadcrumb = {
  href?: string
  label: string
}

export function EngineeringHeader ({ status, title, trail }: {
  status?: ReactNode
  title: string
  trail: EngineeringBreadcrumb[]
}) {
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Engineering', href: '#/engineering/blueprints' }, ...trail]} />}
      status={status}
      title={title}
    />
  )
}
