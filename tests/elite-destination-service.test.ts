import { describe, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type NavigationRoute } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { EliteDestinationService, type EliteDestinationTiming } from '../apps/server/src/application/elite-destination-service.js'
import type {
  EliteDestinationBinding,
  EliteDestinationInput
} from '../apps/server/src/domain/elite-destination.js'
import type { NavigationRouteReader } from '../apps/server/src/domain/navigation.js'

describe('Elite destination automation', () => {
  test('accepts unchanged old status and confirms the destination only after fresh map feedback and a new route', async () => {
    const route = mutableRoute({ timestamp: null, route: [] })
    const runtime = cockpitRuntime('2026-09-10T12:00:00.000Z')
    const input = new RecordingDestinationInput(() => {
      route.value = {
        timestamp: '2026-09-11T12:00:00.000Z',
        route: [{ system: 'Shinrarta Dezhra', address: 3932277478106, position: [55.71875, 17.59375, 27.15625], starClass: 'A' }]
      }
    }, binding => {
      if (binding === 'GalaxyMapOpen') runtime.toggleMap('2026-09-11T12:00:00.000Z')
    })
    const service = new EliteDestinationService(input, runtime, route, immediateTiming())

    await expect(service.plot('  Shinrarta Dezhra  ')).resolves.toEqual({
      requestedSystem: 'Shinrarta Dezhra',
      confirmedSystem: 'Shinrarta Dezhra',
      status: 'confirmed',
      phase: 'confirm_route',
      message: 'Route to Shinrarta Dezhra was confirmed.'
    })
    expect(input.events).toEqual([
      'tap:GalaxyMapOpen',
      'hold:CamZoomOut:4000',
      'tap:UI_Up',
      'tap:UI_Select',
      'type:Shinrarta Dezhra',
      'key:Enter',
      'tap:UI_Right',
      'tap:UI_Select',
      'hold:CamZoomIn:6000',
      'hold:UI_Select:5000',
      'tap:GalaxyMapOpen'
    ])
  })

  test('does not accept a stale route that already ends at the requested system', async () => {
    const existing = {
      timestamp: '2026-09-11T11:00:00.000Z',
      route: [{ system: 'Sol', address: 10477373803, position: [0, 0, 0] as [number, number, number], starClass: 'G' }]
    }
    const route = mutableRoute(existing)
    const runtime = cockpitRuntime()
    const input = new RecordingDestinationInput(undefined, binding => {
      if (binding === 'GalaxyMapOpen') runtime.toggleMap()
    })
    const service = new EliteDestinationService(input, runtime, route, immediateTiming(200))

    input.diagnoseBindings = vi.fn().mockResolvedValue(['UI_Up (W) conflicts with Galaxy Map movement.'])
    const result = await service.plot('Sol')

    expect(result.bindingWarnings).toEqual(['UI_Up (W) conflicts with Galaxy Map movement.'])
    expect(result).toMatchObject({ status: 'timed_out', phase: 'confirm_route', confirmedSystem: null })
    expect(result.message).toContain('newly plotted route')
    expect(input.events.at(-1)).toBe('tap:GalaxyMapOpen')
  })

  test('finishes zooming out before focusing search or typing a destination', async () => {
    const runtime = cockpitRuntime()
    const input = new RecordingDestinationInput(undefined, binding => {
      if (binding === 'GalaxyMapOpen') runtime.toggleMap()
    })
    const zoomStarted = Promise.withResolvers<void>()
    const zoomFinished = Promise.withResolvers<void>()
    const hold = input.hold.bind(input)
    input.hold = async (binding, durationMs) => {
      await hold(binding, durationMs)
      if (binding === 'CamZoomOut') {
        zoomStarted.resolve()
        await zoomFinished.promise
      }
    }
    const service = new EliteDestinationService(input, runtime, mutableRoute({ timestamp: null, route: [] }), immediateTiming())
    const plotting = service.plot('Sol')
    await zoomStarted.promise

    expect(input.events).toEqual(['tap:GalaxyMapOpen', 'hold:CamZoomOut:4000'])
    zoomFinished.resolve()
    await plotting
    expect(input.events).toContain('type:Sol')
  })

  test('finishes zooming in before holding select to plot the route', async () => {
    const runtime = cockpitRuntime()
    const input = new RecordingDestinationInput(undefined, binding => {
      if (binding === 'GalaxyMapOpen') runtime.toggleMap()
    })
    const zoomStarted = Promise.withResolvers<void>()
    const zoomFinished = Promise.withResolvers<void>()
    const hold = input.hold.bind(input)
    input.hold = async (binding, durationMs) => {
      await hold(binding, durationMs)
      if (binding === 'CamZoomIn') {
        zoomStarted.resolve()
        await zoomFinished.promise
      }
    }
    const service = new EliteDestinationService(input, runtime, mutableRoute({ timestamp: null, route: [] }), immediateTiming())
    const plotting = service.plot('Sol')
    await zoomStarted.promise

    expect(input.events.at(-1)).toBe('hold:CamZoomIn:6000')
    expect(input.events).not.toContain('hold:UI_Select:5000')
    zoomFinished.resolve()
    await plotting
    expect(input.events).toContain('hold:UI_Select:5000')
  })

  test('reports zoom failure and closes the map without starting search', async () => {
    const runtime = cockpitRuntime()
    const input = new RecordingDestinationInput(undefined, binding => {
      if (binding === 'GalaxyMapOpen') runtime.toggleMap()
    })
    input.hold = async () => { throw new Error('Zoom input failed.') }
    const service = new EliteDestinationService(input, runtime, mutableRoute({ timestamp: null, route: [] }), immediateTiming())

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'failed',
      phase: 'zoom_out',
      message: 'Zoom input failed.'
    })
    expect(input.events).toEqual(['tap:GalaxyMapOpen', 'tap:GalaxyMapOpen'])
  })

  test('rejects the operation before sending input when the backend or required bindings are unavailable', async () => {
    const input = new RecordingDestinationInput()
    input.available = false
    const service = new EliteDestinationService(input, cockpitRuntime(), mutableRoute({ timestamp: null, route: [] }), immediateTiming())

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected',
      phase: 'preflight',
      message: 'Galaxy Map input unavailable.'
    })
    expect(input.events).toEqual([])
  })

  test('attaches binding diagnostics to failures without hiding the original reason if diagnostics fail', async () => {
    const input = new RecordingDestinationInput()
    input.available = false
    input.diagnoseBindings = vi.fn().mockResolvedValue(['Missing keyboard binding: UI_Right.'])
    const service = new EliteDestinationService(input, cockpitRuntime(), mutableRoute({ timestamp: null, route: [] }), immediateTiming())

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected', message: 'Galaxy Map input unavailable.',
      bindingWarnings: ['Missing keyboard binding: UI_Right.']
    })
    input.diagnoseBindings = vi.fn().mockRejectedValue(new Error('Unreadable file'))
    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected', message: 'Galaxy Map input unavailable.',
      bindingWarnings: ['PHOENIX could not check the active bindings. Check them manually in Elite.']
    })
    expect(input.events).toEqual([])
  })

  test('does not send input when Elite status is missing', async () => {
    const input = new RecordingDestinationInput()
    const service = new EliteDestinationService(
      input,
      { getCurrent: () => createEmptyRuntimeState() },
      mutableRoute({ timestamp: null, route: [] }),
      immediateTiming()
    )

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected',
      phase: 'preflight',
      message: 'Elite is not reporting live status.'
    })
    expect(input.events).toEqual([])
  })

  test.each([0, 6])('stops before search or typing when an old status snapshot never responds (focus %i)', async guiFocus => {
    const input = new RecordingDestinationInput()
    const service = new EliteDestinationService(
      input,
      cockpitRuntime('2026-09-10T12:00:00.000Z', guiFocus),
      mutableRoute({ timestamp: null, route: [] }),
      immediateTiming()
    )

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'timed_out',
      phase: 'open_map',
      message: 'Elite did not report an open Galaxy Map.'
    })
    expect(input.events).toEqual(['tap:GalaxyMapOpen'])
  })
})

class RecordingDestinationInput implements EliteDestinationInput {
  public available = true
  public readonly events: string[] = []

  public constructor (
    private readonly onPlot?: () => void,
    private readonly onTap?: (binding: EliteDestinationBinding) => void
  ) {}

  public getStatus () {
    return {
      available: this.available,
      detail: this.available ? 'Ready.' : 'Galaxy Map input unavailable.',
      missingBindings: []
    }
  }

  public async diagnoseBindings (): Promise<string[]> { return [] }

  public async tap (binding: EliteDestinationBinding): Promise<void> {
    this.events.push(`tap:${binding}`)
    this.onTap?.(binding)
  }

  public async hold (binding: EliteDestinationBinding, durationMs: number): Promise<void> {
    this.events.push(`hold:${binding}:${durationMs}`)
    if (binding === 'UI_Select') this.onPlot?.()
  }

  public async tapKey (key: string): Promise<void> {
    this.events.push(`key:${key}`)
  }

  public async typeText (text: string): Promise<void> {
    this.events.push(`type:${text}`)
  }
}

function cockpitRuntime (timestamp = '2026-09-11T12:00:00.000Z', guiFocus = 0) {
  const state = createEmptyRuntimeState()
  state.gameStatus = parseEliteStatus({ timestamp, event: 'Status', Flags: 0, GuiFocus: guiFocus })
  return {
    getCurrent: () => structuredClone(state),
    toggleMap (nextTimestamp = state.gameStatus!.timestamp) {
      state.gameStatus = parseEliteStatus({
        timestamp: nextTimestamp,
        event: 'Status',
        Flags: 0,
        GuiFocus: state.gameStatus?.guiFocus?.id === 6 ? 0 : 6
      })
    }
  }
}

function mutableRoute (initial: NavigationRoute): NavigationRouteReader & { value: NavigationRoute } {
  return {
    value: initial,
    getCurrent () { return structuredClone(this.value) }
  }
}

function immediateTiming (routeConfirmationTimeoutMs = 1_000): EliteDestinationTiming {
  return {
    pause: async () => {},
    pollIntervalMs: 100,
    mapFocusTimeoutMs: 1_000,
    routeConfirmationTimeoutMs
  }
}
