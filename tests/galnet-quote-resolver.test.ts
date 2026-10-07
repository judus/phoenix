import { expect, test } from 'vitest'
import { createGalnetQuoteResolver } from '../apps/server/src/application/galnet-quote-resolver.js'

test('restores whitespace and typographic quotes from the source without changing the archive', () => {
  const body = 'Before. “Pilots’ reports”\r\n\tconfirm\u00a0\u00a0the beacon. After.'
  const resolve = createGalnetQuoteResolver('Beacon\tnews', body)
  expect(resolve('"Pilots\' reports" confirm the beacon.')).toBe('“Pilots’ reports”\r\n\tconfirm\u00a0\u00a0the beacon.')
  expect(resolve('  Beacon news  ')).toBe('Beacon\tnews')
  expect(resolve('“Pilots’ reports”')).toBe('“Pilots’ reports”')
})

test('offset mapping preserves astral characters and whitespace around a matched passage', () => {
  const resolve = createGalnetQuoteResolver('Title', '🚀 Before. 🛰 “Beacon”\r\nfound. After.')
  expect(resolve('🛰 "Beacon" found.')).toBe('🛰 “Beacon”\r\nfound.')
})

test.each(['pilots report 12 finds.', 'Pilots report 21 finds.', 'Pilots report 12 discoveries.',
  'Pilots ... 12 finds.', 'Pilots report 12 finds!', 'Pilotsreport 12 finds.', 'Invented evidence', ' \t\n'])
('rejects wording, case, number or non-quote punctuation changes: %j', quote => {
  expect(createGalnetQuoteResolver('Title', 'Pilots report 12 finds.')(quote)).toBeUndefined()
})

test('never joins title and body or noncontiguous passages into a source quote', () => {
  const resolve = createGalnetQuoteResolver('Beacon news', 'Pilots report activity. Details are unknown.')
  expect(resolve('news Pilots')).toBeUndefined()
  expect(resolve('Pilots report Details are unknown.')).toBeUndefined()
})
