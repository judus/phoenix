import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import {
  formatPhoenixDate,
  formatPhoenixDateTime,
  formatPhoenixTime,
  PhoenixDateTime,
  UpdatedDateTime
} from '../apps/web/src/components/phoenix-date-time.js'

const localTimestamp = '2026-09-12T22:57:03'

test('PHOENIX dates use the Elite calendar and a consistent 24-hour clock', () => {
  expect(formatPhoenixDate(localTimestamp)).toBe('12 Sept 3312')
  expect(formatPhoenixTime(localTimestamp)).toBe('22:57')
  expect(formatPhoenixTime(localTimestamp, true)).toBe('22:57:03')
  expect(formatPhoenixDateTime(localTimestamp)).toBe('12 Sept 3312, 22:57')
})

test('PHOENIX date-time components preserve the machine-readable timestamp', () => {
  expect(renderToStaticMarkup(<PhoenixDateTime value={localTimestamp} />)).toBe(
    '<time dateTime="2026-09-12T22:57:03">12 Sept 3312, 22:57</time>'
  )
  expect(renderToStaticMarkup(<UpdatedDateTime value={localTimestamp} />)).toContain(
    'Updated <time dateTime="2026-09-12T22:57:03">12 Sept 3312, 22:57</time>'
  )
})

test('invalid timestamps remain honest', () => {
  expect(formatPhoenixDateTime('not-a-date')).toBe('Unknown')
})
