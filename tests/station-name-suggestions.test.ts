import { expect, test } from 'vitest'
import { stationNameSuggestions } from '../apps/server/src/application/station-name-suggestions.js'

test('suggests canonical names for abbreviations, punctuation differences and minor typos', () => {
  expect(stationNameSuggestions('Vonarburg Co-op', ['Black Hide', 'Vonarburg Co-operative'])).toEqual(['Vonarburg Co-operative'])
  expect(stationNameSuggestions('Galilleo', ['Galileo', 'Black Hide'])).toEqual(['Galileo'])
  expect(stationNameSuggestions('vonarburg cooperative', ['Vonarburg Co-operative'])).toEqual(['Vonarburg Co-operative'])
})

test('preserves ambiguity, caps suggestions and does not invent unrelated matches', () => {
  const names = ['Sweet Terminal', 'Sweet Hub', 'Sweet Port', 'Sweet Landing', 'Sweet Depot', 'Sweet Base']
  expect(stationNameSuggestions('Sweet', names)).toHaveLength(5)
  expect(stationNameSuggestions('Sweet', names).every(name => names.includes(name))).toBe(true)
  expect(stationNameSuggestions('Completely unrelated', names)).toEqual([])
  expect(stationNameSuggestions('a', names)).toEqual([])
})
