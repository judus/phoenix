import { isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { toast, type ToastT } from 'sonner'

export function activeNotifications(): ToastT[] {
  return toast.getToasts().filter((item): item is ToastT => !('dismiss' in item))
}

/** Inspect the real shared queue, not an error span that no longer belongs to the page. */
export function notificationText(): string {
  return activeNotifications().flatMap(item => isValidElement<{ messages: string[] }>(item.jsx)
    ? item.jsx.props.messages : []).join('\n')
}

export function notificationMarkup(): string {
  return activeNotifications().map(item => isValidElement(item.jsx) ? renderToStaticMarkup(item.jsx) : '').join('')
}

export function dismissNotification(message: string): void {
  const notice = activeNotifications().find(item => isValidElement<{ messages: string[] }>(item.jsx) && item.jsx.props.messages.includes(message))
  if (!notice || !isValidElement<{ onDismiss(): void }>(notice.jsx)) throw new Error(`Notification not found: ${message}`)
  notice.jsx.props.onDismiss()
}
