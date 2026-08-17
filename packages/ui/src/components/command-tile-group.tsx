import { useId, type HTMLAttributes, type ReactNode } from 'react'

type CommandTileGroupProps = HTMLAttributes<HTMLElement> & {
  columns?: 1 | 2 | 3 | 4
  meta?: ReactNode
  title: string
}

export function CommandTileGroup({
  children,
  className,
  columns = 2,
  meta,
  title,
  ...props
}: CommandTileGroupProps) {
  const generatedId = useId()
  const headingId = props['aria-labelledby'] ?? generatedId

  return (
    <section
      className={['command-tile-group', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      {...props}
    >
      <header>
        <h3 id={headingId}>{title}</h3>
        {meta && <span>{meta}</span>}
      </header>
      <div className={`command-tile-group-grid columns-${columns}`}>
        {children}
      </div>
    </section>
  )
}

export function DescribedCommandTile({
  children,
  className,
  description,
  ...props
}: HTMLAttributes<HTMLDivElement> & { description: ReactNode }) {
  return (
    <div className={['described-command-tile', className].filter(Boolean).join(' ')} {...props}>
      {children}
      <p>{description}</p>
    </div>
  )
}
