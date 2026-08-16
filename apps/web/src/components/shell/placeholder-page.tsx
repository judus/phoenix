import { PageFrame, PageHeader } from '@phoenix/ui'

export function PlaceholderPage({ context, description, title }: {
  context: string
  description: string
  title: string
}) {
  return (
    <PageFrame>
      <PageHeader context={context} title={title} description={description} />
    </PageFrame>
  )
}
