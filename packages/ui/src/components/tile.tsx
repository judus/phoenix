import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface TileContentProps {
  body?: ReactNode
  eyebrow?: ReactNode
  footerCorner?: ReactNode
  headerCorner?: ReactNode
  label: ReactNode
  meta?: ReactNode
  metaTitle?: string
  note?: ReactNode
}

export function TileContent({ body, eyebrow, footerCorner, headerCorner, label, meta, metaTitle, note }: TileContentProps) {
  return <span className="content">
    <span className="header">
      {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
      <span className="corner">{headerCorner}</span>
      <strong className="label" data-text-length={responsiveTextLength(label)}>{label}</strong>
    </span>
    {body !== undefined && <span className="body">{body}</span>}
    <span className="footer">
      {meta !== undefined && <span className="meta" title={metaTitle ?? (typeof meta === 'string' ? meta : undefined)}>{meta}</span>}
      {note !== undefined && <small className="note">{note}</small>}
      {footerCorner !== undefined && <span className="corner">{footerCorner}</span>}
    </span>
  </span>
}

export interface TileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, TileContentProps {
  centered?: boolean
  cornered?: boolean
  hideMeta?: boolean
  numbered?: boolean
  variableFontSizes?: boolean
  watermarked?: boolean
}

export function TileButton({
  body,
  centered = false,
  className,
  cornered = false,
  eyebrow,
  footerCorner,
  headerCorner,
  hideMeta = false,
  label,
  meta,
  metaTitle,
  note,
  numbered = false,
  variableFontSizes = false,
  watermarked = false,
  ...buttonProps
}: TileButtonProps) {
  const classes = [
    'tile',
    'btn',
    numbered ? 'numbered' : undefined,
    cornered ? 'cornered' : undefined,
    watermarked ? 'watermarked' : undefined,
    centered ? 'centered' : undefined,
    hideMeta ? 'hide-meta' : undefined,
    variableFontSizes ? 'variable-font-sizes' : undefined,
    className
  ].filter(Boolean).join(' ')

  return <button
    {...buttonProps}
    className={classes}
    data-watermark={watermarked ? headerCorner : undefined}
  ><TileContent
      body={body}
      eyebrow={eyebrow}
      footerCorner={footerCorner}
      headerCorner={headerCorner}
      label={label}
      meta={meta}
      metaTitle={metaTitle}
      note={note}
    /></button>
}

function responsiveTextLength(text: ReactNode) {
  if (typeof text !== 'string') return undefined
  const length = [...text.trim()].length
  if (length <= 10) return 'short'
  if (length <= 18) return 'medium'
  if (length <= 28) return 'long'
  return 'extra-long'
}
