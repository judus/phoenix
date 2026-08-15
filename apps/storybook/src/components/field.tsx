import { cloneElement } from 'react'
import type { InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes } from 'react'

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
    <div className="field" data-invalid={Boolean(error) || undefined}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required">Required</span>}
      </label>
      {control}
      {(error || hint) && (
        <p className="field__message" data-error={Boolean(error) || undefined} id={messageId}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['text-input', className].filter(Boolean).join(' ')} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['select', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </select>
  )
}
