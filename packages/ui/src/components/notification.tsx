import { useEffect, useId, type ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { Toast } from './toast'

/** One shell-level stack; pages declare feedback instead of reserving a layout row. */
export function NotificationHost() {
  return <div className="notification-layer" data-deskplane-no-swipe>
    <Toaster className="notification-toaster" position="top-right" hotkey={[]}
      offset={{ top: 'calc(var(--application-shell-chrome-size) + var(--spacing-sm))', right: 'var(--spacing-sm)' }}
      mobileOffset={{ top: 'calc(var(--application-shell-chrome-size) + var(--spacing-sm))', right: 'var(--spacing-sm)', left: 'var(--spacing-sm)' }}
      expand visibleToasts={3} swipeDirections={['right']}
      toastOptions={{ className: 'notification-item' }}
      containerAriaLabel="Notifications" />
  </div>
}

/** Unchanged feedback is shown once, even after dismissal or background re-renders. */
export function Notification({ message, messages, tone = 'danger', children }: {
  message?: string | null
  messages?: readonly string[]
  tone?: 'danger' | 'warning'
  children?: ReactNode
}) {
  const id = useId()
  const content = JSON.stringify([...new Set(messages ?? (message ? [message] : []))])
  useEffect(() => {
    const values = JSON.parse(content) as string[]
    if (values.length === 0) return
    toast.custom(() => <Toast messages={values} tone={tone} className="notification"
      onDismiss={() => toast.dismiss(id)}>{children}</Toast>, { id, duration: Infinity })
    return () => { toast.dismiss(id) }
    // Details accompany the message; unrelated parent renders must not re-announce it.
  }, [id, content, tone])
  return null
}
