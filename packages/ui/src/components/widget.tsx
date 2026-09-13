import { useId, type HTMLAttributes, type ReactNode } from 'react'

type WidgetProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  aside?: ReactNode
  detail?: ReactNode
  density?: 'standard' | 'compact'
  eyebrow?: ReactNode
  heading?: ReactNode
  link?: ReactNode
  meta?: ReactNode
  scrollable?: boolean
}

export function Widget({ aside, children, className, detail, density = 'standard', eyebrow, heading, link, meta, scrollable = false, ...props }: WidgetProps) {
  const generatedId = useId()
  const headingId = heading ? (props['aria-labelledby'] ?? generatedId) : undefined
  const hasBody = children !== undefined && children !== null

  return (
    <article
      className={['widget', density === 'compact' && 'compact', scrollable && 'scrollable', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      {...props}
    >
      {(eyebrow || heading || detail || link || meta || aside) && <header>
        {(eyebrow || heading || detail) && (
          <div className={['widget-heading', eyebrow && heading && 'prominent'].filter(Boolean).join(' ')}>
            {eyebrow && <span>{eyebrow}</span>}
            {heading && <h3 id={headingId}>{heading}</h3>}
            {detail && <small>{detail}</small>}
          </div>
        )}
        {link ?? (aside ? <div className="widget-aside">{aside}</div> : (meta && <span>{meta}</span>))}
      </header>}
      {hasBody && <div className="widget-body">{children}</div>}
    </article>
  )
}
