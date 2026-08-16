import { cloneElement } from 'react'
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react'

import './controls.css'

type FieldProps = {
  children: ReactElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }>
  htmlFor: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
}

export function Field({ children, htmlFor, label, hint, error, required = false }: FieldProps) {
  const messageId = `${htmlFor}-message`
  const describedBy = [children.props['aria-describedby'], (error || hint) ? messageId : undefined]
    .filter(Boolean)
    .join(' ') || undefined
  const control = cloneElement(children, {
    id: children.props.id ?? htmlFor,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : children.props['aria-invalid']
  })

  return (
    <div className={['field', error && 'invalid'].filter(Boolean).join(' ')}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <small className="text-muted text-xxs">Required</small>}
      </label>
      {control}
      {(error || hint) && (
        <p className={error ? 'text-danger' : undefined} id={messageId}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['form-control', className].filter(Boolean).join(' ')} {...props} />
}

export function NumberInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input className={['form-control', className].filter(Boolean).join(' ')} type="number" {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['form-select', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['form-control', 'form-textarea', className].filter(Boolean).join(' ')} {...props} />
}
