import { Status } from '@phoenix/ui'

export function DataSyncNotice({ children }: { children: string }) {
  return (
    <Status tone="warning" wrap>
      {children} <a href="#/settings/help">Data synchronization help</a>
    </Status>
  )
}
