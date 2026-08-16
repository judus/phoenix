import { useId } from 'react'
import type { FieldsetHTMLAttributes, FormHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={['form', className].filter(Boolean).join(' ')} {...props} />
}

type FormGridProps = HTMLAttributes<HTMLDivElement> & {
  minimum?: 'md' | 'lg'
}

export function FormGrid({ className, minimum = 'md', ...props }: FormGridProps) {
  return <div className={['form-grid', `form-grid-${minimum}`, className].filter(Boolean).join(' ')} {...props} />
}

type FormSectionProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  description?: ReactNode
  title: ReactNode
}

export function FormSection({ children, className, description, title, ...props }: FormSectionProps) {
  const descriptionId = useId()

  return (
    <fieldset
      className={['form-section', className].filter(Boolean).join(' ')}
      aria-describedby={description ? descriptionId : undefined}
      {...props}
    >
      <legend>
        <span>{title}</span>
        {description && <small id={descriptionId}>{description}</small>}
      </legend>
      <div>{children}</div>
    </fieldset>
  )
}

type FormActionsProps = HTMLAttributes<HTMLElement> & {
  layout?: 'standard' | 'columns'
  message?: ReactNode
  navigation?: ReactNode
}

export function FormActions({
  children,
  className,
  layout = 'standard',
  message,
  navigation,
  ...props
}: FormActionsProps) {
  return (
    <footer
      className={['form-actions', `form-actions-${layout}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {navigation && <div className="navigation">{navigation}</div>}
      {message && <p>{message}</p>}
      <div className="actions">{children}</div>
    </footer>
  )
}

type FormActionGroupProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 'one' | 'two'
}

export function FormActionGroup({ className, columns = 'one', ...props }: FormActionGroupProps) {
  return (
    <div
      className={['form-action-group', `form-action-group-${columns}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
