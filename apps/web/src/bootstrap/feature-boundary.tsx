import { Component, Suspense, type ReactNode } from 'react'
import { Button, Loading, PageFrame, PageHeader } from '@phoenix/ui'

interface FeatureBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface FeatureBoundaryState {
  failed: boolean
  resetKey: string
}

/** A failed page must not remove the navigation needed to leave or reload it. */
export class FeatureBoundary extends Component<FeatureBoundaryProps, FeatureBoundaryState> {
  override state: FeatureBoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<FeatureBoundaryState> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: FeatureBoundaryProps, state: FeatureBoundaryState): Partial<FeatureBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  override render() {
    if (this.state.failed) return (
      <PageFrame>
        <PageHeader title="Page unavailable" description="This page could not load. You can use navigation to open another page, or reload PHOENIX."
          actions={<Button onClick={() => globalThis.location.reload()}>Reload PHOENIX</Button>} />
      </PageFrame>
    )
    // React.lazy retains a rejected import. Reload deliberately starts a new
    // document/module graph rather than claiming a remount retries that import.
    return <Suspense fallback={<PageFrame layout="fit"><Loading /></PageFrame>}>{this.props.children}</Suspense>
  }
}
