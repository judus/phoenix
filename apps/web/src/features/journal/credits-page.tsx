import { PageFrame, PageHeader, Status } from '@phoenix/ui'

export function CreditsPage() {
  return <PageFrame layout="fit">
    <PageHeader context="Log · Credits" title="Credits" description="Services, projects, and people who helped make PHOENIX possible." />
    <Status tone="muted">Acknowledgements will be recorded here.</Status>
  </PageFrame>
}
