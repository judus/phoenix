import { useId, type HTMLAttributes, type ReactNode } from 'react'

import './widget.css'

type WidgetProps = HTMLAttributes<HTMLElement> & {
  link?: ReactNode
  meta?: ReactNode
  title: string
}

export function Widget({ children, className, link, meta, title, ...props }: WidgetProps) {
  const generatedId = useId()
  const headingId = props['aria-labelledby'] ?? generatedId

  return (
    <article
      className={['widget', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      {...props}
    >
      <header>
        <h3 id={headingId}>{title}</h3>
        {link ?? (meta && <span>{meta}</span>)}
      </header>
      <div>{children}</div>
    </article>
  )
}
