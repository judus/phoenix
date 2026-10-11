import type { HTMLAttributes, ReactNode } from 'react'

type InputGroupProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode
  label: ReactNode
  htmlFor: string
}

/** Attached label/input/action. Labels can opt into className="filled". */
export function InputGroup({ action, children, className, htmlFor, label, ...props }: InputGroupProps) {
  return <div className={['input-group', className].filter(Boolean).join(' ')} {...props}>
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {action}
  </div>
}
