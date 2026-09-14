import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react'

type WidgetProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  aside?: ReactNode
  autoHideScrollbar?: boolean
  bodyRef?: Ref<HTMLDivElement>
  detail?: ReactNode
  density?: 'standard' | 'compact'
  eyebrow?: ReactNode
  heading?: ReactNode
  link?: ReactNode
  meta?: ReactNode
  scrollable?: boolean
}

export function Widget({ aside, autoHideScrollbar = false, bodyRef, children, className, detail, density = 'standard', eyebrow, heading, link, meta, scrollable = false, ...props }: WidgetProps) {
  const generatedId = useId()
  const headingId = heading ? (props['aria-labelledby'] ?? generatedId) : undefined
  const hasBody = children !== undefined && children !== null
  const bodyElement = useRef<HTMLDivElement | null>(null)
  const [bodyOverflowing, setBodyOverflowing] = useState(false)
  const [scrollbarVisible, setScrollbarVisible] = useState(false)
  const scrollbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observeScrolling = useRef(false)

  const assignBodyRef = useCallback((element: HTMLDivElement | null) => {
    bodyElement.current = element
    if (typeof bodyRef === 'function') bodyRef(element)
    else if (bodyRef) bodyRef.current = element
  }, [bodyRef])

  useLayoutEffect(() => {
    const body = bodyElement.current
    if (!scrollable || !body) {
      setBodyOverflowing(false)
      return
    }

    const measure = () => {
      const overflowing = body.scrollHeight - body.clientHeight > 1
      setBodyOverflowing(current => current === overflowing ? current : overflowing)
    }
    measure()

    if (typeof ResizeObserver === 'undefined') return
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(body)
    for (const child of body.children) resizeObserver.observe(child)
    return () => resizeObserver.disconnect()
  }, [children, scrollable])

  useEffect(() => {
    observeScrolling.current = true
    return () => {
      observeScrolling.current = false
      if (scrollbarTimer.current) clearTimeout(scrollbarTimer.current)
    }
  }, [])

  function handleScroll (): void {
    if (!autoHideScrollbar || !observeScrolling.current) return
    setScrollbarVisible(true)
    if (scrollbarTimer.current) clearTimeout(scrollbarTimer.current)
    scrollbarTimer.current = setTimeout(() => setScrollbarVisible(false), 600)
  }

  return (
    <article
      className={[
        'widget',
        density === 'compact' && 'compact',
        scrollable && 'scrollable',
        scrollable && bodyOverflowing && 'has-overflow',
        scrollable && autoHideScrollbar && 'auto-hide-scrollbar',
        className
      ].filter(Boolean).join(' ')}
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
      {hasBody && (
        <div
          className="widget-body"
          data-scroll-state={autoHideScrollbar ? (scrollbarVisible ? 'active' : 'idle') : undefined}
          onScroll={autoHideScrollbar ? handleScroll : undefined}
          ref={assignBodyRef}
        >
          {children}
        </div>
      )}
    </article>
  )
}
