import { expect, test, vi } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'

// Inject failures into the actual composed resources, not a parallel lifecycle implementation.
interface LifecycleResources {
  database: { initialize(): boolean, close(): void }
  initializeShortcuts(newProfile: boolean): void
  eddn: { start(): void, stop(): Promise<void> }
  journalSource: Source
  statusSource: Source
  inventorySource: Source
  navigationRouteSource: Source
  journalBackfill: { start(): Promise<void>, stop(): Promise<void> }
  server: { start(): Promise<{ host: string, port: number }>, stop(): Promise<void> }
  controlDeck: Source
  eliteControls: Source
  gameActions: { stop(): Promise<void> }
}
interface Source { start(): Promise<unknown>, stop(): void | Promise<void> }

const order = ['journalSource', 'eddn', 'statusSource', 'inventorySource', 'navigationRouteSource',
  'journalBackfill', 'server', 'controlDeck', 'gameActions', 'eliteControls', 'database'] as const

function fixture(failures: Partial<Record<typeof order[number], unknown>> = {}) {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    eliteBindingsDirectory: null, host: '127.0.0.1', port: 0, openAiEnvironmentKey: null })
  const resources = application as unknown as LifecycleResources
  const calls: string[] = []
  for (const name of order) {
    const cleanup = () => {
      calls.push(name)
      if (name in failures) throw failures[name]
    }
    if (name === 'database') {
      const close = resources.database.close.bind(resources.database)
      vi.spyOn(resources.database, 'close').mockImplementation(() => { close(); cleanup() })
    } else if (name === 'journalSource' || name === 'statusSource' || name === 'inventorySource' || name === 'navigationRouteSource') {
      vi.spyOn(resources[name], 'stop').mockImplementation(cleanup)
    } else {
      vi.spyOn(resources[name], 'stop').mockImplementation(async () => { cleanup() })
    }
  }
  // No real watchers, sockets, provider calls or game input in failure-injection tests.
  vi.spyOn(resources.eddn, 'start').mockImplementation(() => {})
  for (const name of ['controlDeck', 'eliteControls', 'journalSource', 'statusSource', 'inventorySource', 'navigationRouteSource'] as const) {
    vi.spyOn(resources[name], 'start').mockResolvedValue(undefined)
  }
  vi.spyOn(resources.server, 'start').mockResolvedValue({ host: '127.0.0.1', port: 1234 })
  vi.spyOn(resources.journalBackfill, 'start').mockResolvedValue(undefined)
  return { application, resources, calls }
}

test('successful teardown keeps dependency order and permits stop before startup or repeated stop', async () => {
  const { application, calls } = fixture()
  await application.stop()
  await application.stop()
  expect(calls).toEqual([...order, ...order])
})

test.each(order)('a cleanup failure in %s does not skip later resources', async name => {
  const failure = new Error(`${name} failed`)
  const { application, calls } = fixture({ [name]: failure })
  const result = application.stop()
  await expect(result).rejects.toBeInstanceOf(AggregateError)
  await expect(result).rejects.toMatchObject({ errors: [failure] })
  expect(calls).toEqual(order)
})

test('teardown collects synchronous and asynchronous errors in execution order', async () => {
  const journal = new Error('journal stop'), eddn = new Error('EDDN stop'), input = new Error('input stop')
  const { application, calls } = fixture({ journalSource: journal, eddn, gameActions: input })
  await expect(application.stop()).rejects.toMatchObject({ errors: [journal, eddn, input] })
  expect(calls).toEqual(order)
})

test.each(['initialize', 'initializeShortcuts', 'eddn', 'controlDeck', 'eliteControls', 'journalSource',
  'statusSource', 'inventorySource', 'navigationRouteSource', 'server'] as const)(
  'startup failure at %s rolls back every resource and preserves the original failure', async stage => {
    const { application, resources, calls } = fixture()
    const failure = new Error(`startup ${stage}`)
    const fail = () => { throw failure }
    if (stage === 'initialize') vi.spyOn(resources.database, 'initialize').mockImplementation(fail)
    else if (stage === 'initializeShortcuts') vi.spyOn(resources, 'initializeShortcuts').mockImplementation(fail)
    else vi.spyOn(resources[stage], 'start').mockImplementation(fail)
    await expect(application.start()).rejects.toBe(failure)
    expect(calls).toEqual(order)
    expect(resources.journalBackfill.start).not.toHaveBeenCalled()
  }
)

test('startup keeps its initiating failure when rollback also fails', async () => {
  const original = new Error('HTTP startup'), eddn = new Error('EDDN shutdown'), controls = new Error('control shutdown')
  const { application, resources, calls } = fixture({ eddn, eliteControls: controls })
  vi.spyOn(resources.server, 'start').mockRejectedValue(original)
  const result = application.start()
  await expect(result).rejects.toMatchObject({ cause: original, errors: [original, { errors: [eddn, controls] }] })
  expect(calls).toEqual(order)
})

test('successful startup does not tear down resources until explicitly stopped', async () => {
  const { application, resources, calls } = fixture()
  await expect(application.start()).resolves.toEqual({ host: '127.0.0.1', port: 1234 })
  expect(calls).toEqual([])
  expect(resources.journalBackfill.start).toHaveBeenCalledOnce()
  await application.stop()
  expect(calls).toEqual(order)
})
