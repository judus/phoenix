import { PhoenixControlDeckConfigurationSchema } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

test('PHOENIX accepts only its canonical Control Deck configuration and rejects stale writers', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  const baseUrl = `http://${address.host}:${address.port}`

  try {
    const initial = PhoenixControlDeckConfigurationSchema.parse(await getJson(
      `${baseUrl}/api/control-deck/configuration`
    ))
    const initialShip = initial.decks.find(deck => deck.id === 'ship')
    expect(initialShip).toMatchObject({
      context: 'phoenix:ship',
      layout: { kind: 'grid', columns: 8, rows: 5 }
    })
    expect(initialShip?.groupId).toBeTruthy()
    const shipGroupId = initialShip?.groupId as string

    const updated = PhoenixControlDeckConfigurationSchema.parse({
      ...initial,
      groups: initial.groups?.map(group => group.id === shipGroupId
        ? { ...group, name: 'Ship', appearance: { colorScheme: 'orange' } }
        : group),
      decks: initial.decks.map(deck => deck.id === 'ship' ? { ...deck, name: 'S1', elements: [] } : deck)
    })
    const withUtilityDeck = {
      ...updated,
      decks: [...updated.decks, {
        id: 'utility',
        name: 'Utility',
        description: 'Standalone controls',
        context: null,
        layout: { kind: 'grid', columns: 2, rows: 2 },
        elements: []
      }]
    }
    expect((await putJson(`${baseUrl}/api/control-deck/configuration`, withUtilityDeck)).status).toBe(400)
    expect((await putJson(`${baseUrl}/api/control-deck/configuration`, updated)).status).toBe(200)
    expect((await putJson(`${baseUrl}/api/control-deck/configuration`, updated)).status).toBe(409)

    const saved = PhoenixControlDeckConfigurationSchema.parse(await getJson(
      `${baseUrl}/api/control-deck/configuration`
    ))
    expect(saved.groups).toContainEqual(expect.objectContaining({ id: shipGroupId, appearance: { colorScheme: 'orange' } }))
    expect(saved.decks.find(deck => deck.id === 'ship')).toMatchObject({ groupId: shipGroupId, name: 'S1', elements: [] })
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
