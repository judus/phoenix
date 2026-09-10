import { useId, useMemo, useState, type HTMLAttributes } from 'react'

export interface MultiSelectOption {
  label: string
  value: string
}

type MultiSelectProps = Omit<HTMLAttributes<HTMLDetailsElement>, 'onChange'> & {
  disabled?: boolean
  onChange(value: string[]): void
  options: MultiSelectOption[]
  placeholder?: string
  value: string[]
}

export function MultiSelect({ className, disabled = false, id, onChange, options, placeholder = 'Any', value, ...props }: MultiSelectProps) {
  const filterId = useId()
  const [filter, setFilter] = useState('')
  const selected = useMemo(() => new Set(value), [value])
  const visibleOptions = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase()
    return query ? options.filter(option => option.label.toLocaleLowerCase().includes(query)) : options
  }, [filter, options])
  const summary = value.length === 0
    ? placeholder
    : value.length <= 2
      ? options.filter(option => selected.has(option.value)).map(option => option.label).join(', ')
      : `${value.length} selected`
  const toggle = (option: string) => onChange(selected.has(option)
    ? value.filter(candidate => candidate !== option)
    : [...value, option])

  return (
    <details className={['multi-select', disabled && 'disabled', className].filter(Boolean).join(' ')} {...props}>
      <summary className="form-select" aria-disabled={disabled} id={id} onClick={disabled ? event => event.preventDefault() : undefined}>{summary}</summary>
      {!disabled && <div className="multi-select-menu">
        <div className="multi-select-tools">
          <label className="sr-only" htmlFor={filterId}>Filter options</label>
          <input id={filterId} className="form-control form-mini" placeholder="Filter options" type="search" value={filter} onChange={event => setFilter(event.target.value)} />
          <button className="btn btn-outline" disabled={value.length === 0} type="button" onClick={() => onChange([])}>Clear</button>
        </div>
        <div className="multi-select-options" role="group" aria-label="Options">
          {visibleOptions.map(option => <label key={option.value}>
            <input checked={selected.has(option.value)} type="checkbox" onChange={() => toggle(option.value)} />
            <span>{option.label}</span>
          </label>)}
          {visibleOptions.length === 0 && <p>No matching options.</p>}
        </div>
      </div>}
    </details>
  )
}
