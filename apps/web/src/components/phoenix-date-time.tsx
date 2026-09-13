import type { ComponentPropsWithoutRef } from 'react'

const ELITE_YEAR_OFFSET = 1286
const PHOENIX_LOCALE = 'en-GB'

type PhoenixDateTimePrecision = 'date' | 'date-time' | 'time' | 'time-seconds'

type PhoenixDateTimeProps = Omit<ComponentPropsWithoutRef<'time'>, 'children' | 'dateTime'> & {
  precision?: PhoenixDateTimePrecision
  value: string
}

export function PhoenixDateTime({ precision = 'date-time', value, ...props }: PhoenixDateTimeProps) {
  return <time dateTime={value} {...props}>{formatPhoenixDateTime(value, precision)}</time>
}

export function UpdatedDateTime({ value }: { value: string }) {
  return <>Updated <PhoenixDateTime value={value} /></>
}

export function formatPhoenixDate(value: string): string {
  return formatPhoenixDateTime(value, 'date')
}

export function formatPhoenixTime(value: string, includeSeconds = false): string {
  return formatPhoenixDateTime(value, includeSeconds ? 'time-seconds' : 'time')
}

export function formatPhoenixDateTime(
  value: string,
  precision: PhoenixDateTimePrecision = 'date-time'
): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const formatter = new Intl.DateTimeFormat(PHOENIX_LOCALE, optionsFor(precision))
  return formatter.formatToParts(date).map(part => (
    part.type === 'year' ? String(Number(part.value) + ELITE_YEAR_OFFSET) : part.value
  )).join('')
}

function optionsFor(precision: PhoenixDateTimePrecision): Intl.DateTimeFormatOptions {
  if (precision === 'date') return { day: 'numeric', month: 'short', year: 'numeric' }
  if (precision === 'time') return { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }
  if (precision === 'time-seconds') {
    return { hour: '2-digit', hourCycle: 'h23', minute: '2-digit', second: '2-digit' }
  }
  return {
    day: 'numeric',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  }
}
