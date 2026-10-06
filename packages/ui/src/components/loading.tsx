/** A quiet content-area indicator; mounting it never delays the underlying request. */
export function Loading({ children = 'Loading…' }: { children?: string }) {
  return <div className="loading" role="status" aria-live="polite">
    <span aria-hidden="true" />
    <small>{children}</small>
  </div>
}
