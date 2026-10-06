import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { PERSONAL_EQUIPMENT_SOURCE } from '../scripts/catalogue/build-personal-equipment-catalogue.mjs'
import { CreditsPage } from '../apps/web/src/features/journal/credits-page.js'

test('credits the local, bundled, live and optional data sources', () => {
  const markup = renderToStaticMarkup(<CreditsPage />)

  expect(markup).toContain('Journal files')
  expect(markup).toContain('EDCD · FDevIDs')
  expect(markup).toContain('EDCD · Coriolis Data')
  expect(markup).toContain('EDSM')
  expect(markup).toContain('Spansh')
  expect(markup).toContain('Ardent Insight')
  expect(markup).toContain('OpenAI')
})

test('credits catalogue lineage, Atlas geometry, references and fonts with distinct roles', () => {
  const markup = renderToStaticMarkup(<CreditsPage />)
  for (const source of ['Elite Dangerous Almanac', 'Odyssey Materials Helper', 'Ben Peddell', 'EDDN',
    'Elite Dangerous Market Connector', 'Inara', 'PMC Elite Dangerous', 'Control Deck', 'Deskplane',
    'IBM Plex Sans', 'Tom Oetken', 'Julien Duseyau']) expect(markup).toContain(source)
  expect(markup).toContain('Upstream personal-equipment and recipe source used through the Almanac')
  expect(markup).toContain('No EDMC implementation is bundled')
  expect(markup).toContain('not a live data connection')
  expect(markup).toContain('not endorsed by or affiliated with Frontier')
  expect(markup).toContain('third-party notices')
  expect(markup).not.toContain('station commodity stock')
  expect(markup).not.toContain('AGPL')
})

test('credit links use HTTPS with external-link isolation', () => {
  const markup = renderToStaticMarkup(<CreditsPage />)
  const anchors = [...markup.matchAll(/<a ([^>]+)>/g)]
  expect(anchors.length).toBeGreaterThan(10)
  for (const [, attributes] of anchors) {
    expect(attributes).toContain('href="https://')
    expect(attributes).toContain('rel="noreferrer"')
    expect(attributes).toContain('target="_blank"')
  }
})

test('personal-equipment attribution agrees between the importer and shipped starter snapshot', () => {
  const bundled = JSON.parse(readFileSync('resources/catalogue/personal-equipment.json', 'utf8'))
  expect(bundled.sources[0]).toMatchObject({
    repository: PERSONAL_EQUIPMENT_SOURCE.repository,
    revision: PERSONAL_EQUIPMENT_SOURCE.revision,
    license: 'MIT (code); source-specific game-data terms'
  })
  expect(PERSONAL_EQUIPMENT_SOURCE.license).toBe(bundled.sources[0].license)
  for (const path of ['licenses/EliteDangerousAlmanac.txt', 'licenses/OdysseyMaterialsHelper-MIT.txt', 'licenses/Deskplane-MIT.txt']) {
    expect(readFileSync(path, 'utf8')).toContain('Permission is hereby granted, free of charge')
  }
})
