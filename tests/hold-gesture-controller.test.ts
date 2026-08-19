import { afterEach, expect, test, vi } from 'vitest'
import { HoldGestureController } from '../apps/web/src/features/controls/hold-gesture-controller.js'

afterEach(() => vi.useRealTimers())

test('hold gestures serialize press, renewal, and release with one lease', async () => {
  vi.useFakeTimers()
  const calls: Array<{ leaseId: string, operation: string }> = []
  const controller = new HoldGestureController(10, () => 'gesture-1')
  const execute = vi.fn(async (operation: 'press' | 'release', leaseId: string) => {
    calls.push({ leaseId, operation })
  })

  controller.begin('elite.PrimaryFire', execute)
  await vi.advanceTimersByTimeAsync(25)
  controller.end('elite.PrimaryFire')
  await vi.runAllTimersAsync()

  expect(calls).toEqual([
    { leaseId: 'gesture-1', operation: 'press' },
    { leaseId: 'gesture-1', operation: 'press' },
    { leaseId: 'gesture-1', operation: 'press' },
    { leaseId: 'gesture-1', operation: 'release' }
  ])
})

test('release waits for an unfinished press request', async () => {
  const finishPress = deferred<void>()
  const calls: string[] = []
  const controller = new HoldGestureController(10_000, () => 'gesture-2')
  const execute = vi.fn(async (operation: 'press' | 'release') => {
    calls.push(operation)
    if (operation === 'press') await finishPress.promise
  })

  controller.begin('elite.PrimaryFire', execute, false)
  const released = controller.end('elite.PrimaryFire')
  await Promise.resolve()
  expect(calls).toEqual(['press'])

  finishPress.resolve()
  await released
  expect(calls).toEqual(['press', 'release'])
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}
