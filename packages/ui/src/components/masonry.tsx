import type { HTMLAttributes } from 'react'

/** Natural-height cards, read top-to-bottom within each responsive column. */
export function Masonry({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['masonry', className].filter(Boolean).join(' ')} {...props} />
}
