import type { HTMLAttributes, ReactNode } from 'react'

type InputGroupProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode
  htmlFor: string
  action?: ReactNode
}

/** Attached label/control/action. Labels are outlined by default; className="filled" opts into action fill. */
export function InputGroup({ action, children, className, htmlFor, label, ...props }: InputGroupProps) {
  return <div className={['input-group', className].filter(Boolean).join(' ')} {...props}>
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {action}
  </div>
}
