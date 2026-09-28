import { useEffect, useId, useRef, useState } from 'react'
import type { CatalogueSuggestion, CatalogueSuggestionKind } from '@phoenix/contracts'
import { Field, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function CatalogueSuggestionInput({ api, kind, label, value, onChange }: {
  api: PhoenixApi, kind: CatalogueSuggestionKind, label: string, value: string, onChange(value: string): void
}) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(-1)
  const activeOption = useRef<HTMLLIElement>(null)
  const [result, setResult] = useState<{ query: string, items: CatalogueSuggestion[], status: string } | null>(null)
  const eligible = value.replace(/[^a-z0-9]/gi, '').length >= 2
  const visible = focused && !dismissed && eligible
  const items = result?.query === value ? result.items : []
  const status = result?.query === value ? result.status : 'Loading suggestions…'
  useEffect(() => { activeOption.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void api.getCatalogueSuggestions(kind, value, controller.signal).then(items => {
        if (!controller.signal.aborted) setResult({ query: value, items, status: items.length ? '' : 'No matching names. Try a shorter name, or enter an exact name.' })
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ query: value, items: [], status: 'Suggestions unavailable. You can still enter an exact name.' })
      })
    }, 150)
    return () => { clearTimeout(timer); controller.abort() }
  }, [api, kind, value, visible])
  const choose = (item: CatalogueSuggestion) => {
    onChange(item.value)
    setDismissed(true)
    setActive(-1)
  }
  return <Field htmlFor={id} label={label} required hint={kind === 'module'
    ? 'Type part of a name. Optional class/rating, e.g. 5H Guardian FSD Booster.'
    : 'Type part of a name, then select a match.'}>
    <div className="suggestion-input" onFocus={() => setFocused(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setDismissed(false); setActive(-1) }
    }}>
      <TextInput id={id} autoComplete="off" required value={value} role="combobox" aria-autocomplete="list"
        aria-expanded={visible && items.length > 0} aria-controls={visible && items.length ? `${id}-options` : undefined}
        aria-activedescendant={visible && items[active] ? `${id}-option-${active}` : undefined}
        onChange={event => { onChange(event.target.value); setDismissed(false); setActive(-1) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setDismissed(true); setActive(-1) }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setDismissed(false)
            setActive(items.length ? active < 0 ? event.key === 'ArrowDown' ? 0 : items.length - 1
              : (active + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length : -1)
          }
          if (event.key === 'Enter' && visible && items[active]) { event.preventDefault(); choose(items[active]) }
        }} />
      {visible && items.length > 0 && <ul id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`}>
        {items.map((item, index) => <li key={item.value} ref={index === active ? activeOption : undefined} id={`${id}-option-${index}`} role="option" aria-selected={index === active}>
          <button type="button" tabIndex={-1} className={`btn btn-outline${index === active ? ' active' : ''}`}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>{item.label}</button>
        </li>)}
      </ul>}
      {visible && status && <p role="status">{status}</p>}
    </div>
  </Field>
}
