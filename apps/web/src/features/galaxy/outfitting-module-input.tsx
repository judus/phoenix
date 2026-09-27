import { useEffect, useState } from 'react'
import { Field, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

function normalize(value: string): string {
  return value.toLowerCase().replace(/defense/g, 'defence').replace(/optimized/g, 'optimised')
    .replace(/frame shift drive/g, 'fsd').replace(/mk\s*ii/g, 'mk ii')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export function moduleSuggestions(names: string[], query: string): string[] {
  const prefix = query.match(/^\s*(\d\s*[a-i])\s+/i)
  const search = normalize(prefix ? query.slice(prefix[0].length) : query)
  const tokens = search.split(' ').filter(word => word && word !== 'turret')
  if (tokens.join('').length < 2) return []
  const matches = names.filter(name => tokens.every(token => normalize(name).includes(token)))
  return matches.sort((a, b) => Number(normalize(b) === search) - Number(normalize(a) === search) || a.localeCompare(b))
    .slice(0, 12).map(name => prefix ? prefix[1]!.replace(/\s/g, '').toUpperCase() + ' ' + name : name)
}

export function OutfittingModuleInput({ api, value, onChange }: {
  api: PhoenixApi, value: string, onChange(value: string): void
}) {
  const [names, setNames] = useState<string[]>([])
  const [status, setStatus] = useState('Loading module names…')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void api.getOutfittingModuleNames(controller.signal).then(names => {
      if (!controller.signal.aborted) { setNames(names); setStatus('') }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Suggestions unavailable. You can still enter an exact module name.')
    })
    return () => controller.abort()
  }, [api])
  const suggestions = moduleSuggestions(names, value)
  return <Field htmlFor="query-module" label="Module" required hint={status || 'Type part of a name, then select a match. Optional class/rating, e.g. 5H Guardian FSD Booster.'}>
    <div onFocus={() => setFocused(true)} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
    }}>
      <TextInput id="query-module" autoComplete="off" placeholder="Module name or 6A Power Plant" required value={value} onChange={event => onChange(event.target.value)} />
      {focused && suggestions.length > 0 && <ul className="module-suggestions" aria-label="Module suggestions">
        {suggestions.map(name => <li key={name}><button type="button" className="btn btn-outline" onClick={() => { onChange(name); setFocused(false) }}>{name}</button></li>)}
      </ul>}
      {focused && !status && value.trim().length >= 2 && suggestions.length === 0 && <p role="status">No matching module names. Try a shorter name.</p>}
    </div>
  </Field>
}
