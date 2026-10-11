import { ItemList, ItemListItem } from './item-list'
import { Panel } from './page'

/** The floating, dismissible attention panel used by PHOENIX pages. */
export function Toast({ messages, tone = 'danger', onDismiss, dismissLabel = 'Dismiss message', className }: {
  messages: string[]
  tone?: 'warning' | 'danger'
  onDismiss(): void
  dismissLabel?: string
  className?: string
}) {
  return <Panel className={['toast', tone, className].filter(Boolean).join(' ')}
    title="Attention" variant={tone === 'danger' ? 'danger' : 'standard'}
    role={tone === 'danger' ? 'alert' : 'status'}
    actions={<button type="button" aria-label={dismissLabel} onClick={onDismiss}>Dismiss</button>}>
    <ItemList density="compact">
      {messages.map(message => <ItemListItem key={message} title={message} />)}
    </ItemList>
  </Panel>
}
