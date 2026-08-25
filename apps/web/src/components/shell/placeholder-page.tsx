import { PageFrame, PageHeader } from '@phoenix/ui'

export function PlaceholderPage({ context, title }: {
  context: string
  title: string
}) {
  return (
    <PageFrame>
      <PageHeader context={context} title={title} variant="cockpit" />
    </PageFrame>
  )
}
