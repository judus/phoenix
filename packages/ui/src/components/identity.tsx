import type { HTMLAttributes, ReactNode } from 'react'

type IdentityProps = HTMLAttributes<HTMLDivElement> & {
  detail?: ReactNode
  leading?: ReactNode
  title: ReactNode
}

export function Identity({ className, detail, leading, title, ...props }: IdentityProps) {
  return (
    <div className={['identity', className].filter(Boolean).join(' ')} {...props}>
      {leading && <figure>{leading}</figure>}
      <div>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  )
}
