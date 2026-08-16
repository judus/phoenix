import type { HTMLAttributes, ReactNode } from 'react'

import './data-display.css'

type AvatarProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Avatar({ className, ...props }: AvatarProps) {
  return <span className={['avatar', className].filter(Boolean).join(' ')} {...props} />
}
