import { ControlDeckConfigurationSchema } from '@jdu/control-deck-core'
import { ControlGridLayoutSchema } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('legacy PHOENIX layout edits preserve generic Control Deck decks', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const initial = ControlDeckConfigurationSchema.parse(await getJson(
      `${baseUrl}/api/control-deck/configuration`
    ))
    expect(initial.decks.find(deck => deck.id === 'ship')).toMatchObject({
      context: 'phoenix:ship',
      layout: { kind: 'grid', columns: 8, rows: 5 }
    })

    const groupedInitial = ControlDeckConfigurationSchema.parse({
      ...initial,
      groups: [{ id: 'ship_group', name: 'Ship', description: '', appearance: { colorScheme: 'orange' } }],
      decks: initial.decks.map(deck => deck.id === 'ship' ? { ...deck, groupId: 'ship_group', name: '01' } : deck)
    })
    const withUtilityDeck = ControlDeckConfigurationSchema.parse({
      ...groupedInitial,
      decks: [...groupedInitial.decks, {
        id: 'utility',
        name: 'Utility',
        description: 'Standalone controls',
        context: null,
        layout: { kind: 'grid', columns: 2, rows: 2 },
        elements: []
      }],
      displays: [{ id: 'tablet', name: 'Tablet', deckId: 'utility', order: 0 }]
    })
    expect((await putJson(`${baseUrl}/api/control-deck/configuration`, withUtilityDeck)).status).toBe(200)

    const legacy = ControlGridLayoutSchema.parse(await getJson(`${baseUrl}/api/control-layout`))
    expect(legacy.pages.some(page => page.id === 'utility')).toBe(false)
    const editedLegacy = {
      ...legacy,
      pages: legacy.pages.map(page => page.id === 'ship'
        ? {
            ...page,
            cells: [{
              position: 1,
              span: 1,
              target: { type: 'game-action' as const, actionId: 'elite.NightVisionToggle' }
            }]
          }
        : page)
    }
    expect((await putJson(`${baseUrl}/api/control-layout`, editedLegacy)).status).toBe(200)

    const saved = ControlDeckConfigurationSchema.parse(await getJson(
      `${baseUrl}/api/control-deck/configuration`
    ))
    expect(saved.decks.find(deck => deck.id === 'utility')).toEqual(withUtilityDeck.decks.at(-1))
    expect(saved.displays).toEqual(withUtilityDeck.displays)
    expect(saved.groups).toContainEqual(expect.objectContaining({ id: 'ship_group', appearance: { colorScheme: 'orange' } }))
    expect(saved.decks.find(deck => deck.id === 'ship')).toMatchObject({ groupId: 'ship_group', name: '01' })
    expect(saved.decks.find(deck => deck.id === 'ship')?.elements).toContainEqual(expect.objectContaining({
      target: {
        adapterId: 'phoenix.commands',
        commandId: 'command.elite.NightVisionToggle',
        configuration: {}
      }
    }))
  } finally {
    await application.stop()
  }
})

async function getJson (url: string): Promise<unknown> {
  const response = await fetch(url)
  expect(response.status).toBe(200)
  return response.json()
}

async function putJson (url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PUT'
  })
}
