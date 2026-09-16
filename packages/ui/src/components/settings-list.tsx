import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function SettingsList ({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['settings-list', className].filter(Boolean).join(' ')} {...props} />
}

export function SettingRow ({
  children,
  className,
  description,
  scope,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  description?: ReactNode
  scope?: ReactNode
  title: ReactNode
}) {
  return (
    <article className={['setting-row', className].filter(Boolean).join(' ')} {...props}>
      <div className="setting-copy">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        {scope && <small>{scope}</small>}
      </div>
      <div className="setting-control">{children}</div>
    </article>
  )
}

export function SettingToggle ({ label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label className="setting-toggle">
      <input type="checkbox" {...props} />
      <span aria-hidden="true" />
      <b>{label}</b>
    </label>
  )
}
