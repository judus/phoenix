import { describe, expect, test } from 'vitest'
import { createEmptyRuntimeState, type NavigationRoute } from '@phoenix/contracts'
import { EliteDestinationService, type EliteDestinationTiming } from '../apps/server/src/application/elite-destination-service.js'
import type {
  EliteDestinationBinding,
  EliteDestinationInput
} from '../apps/server/src/domain/elite-destination.js'
import type { NavigationRouteReader } from '../apps/server/src/domain/navigation.js'
import type { RuntimeStateReader } from '../apps/server/src/domain/runtime-state.js'

describe('Elite destination automation', () => {
  test('drives the Galaxy Map sequence and reports success only after a new route confirms the destination', async () => {
    const route = mutableRoute({ timestamp: null, route: [] })
    const input = new RecordingDestinationInput(() => {
      route.value = {
        timestamp: '2026-09-11T12:00:00.000Z',
        route: [{ system: 'Shinrarta Dezhra', address: 3932277478106, position: [55.71875, 17.59375, 27.15625], starClass: 'A' }]
      }
    })
    const service = new EliteDestinationService(input, galaxyMapRuntime(), route, immediateTiming())

    await expect(service.plot('  Shinrarta Dezhra  ')).resolves.toEqual({
      requestedSystem: 'Shinrarta Dezhra',
      confirmedSystem: 'Shinrarta Dezhra',
      status: 'confirmed',
      phase: 'confirm_route',
      message: 'Route to Shinrarta Dezhra was confirmed.'
    })
    expect(input.events).toEqual([
      'tap:GalaxyMapOpen',
      'tap:UI_Up',
      'tap:UI_Select',
      'type:Shinrarta Dezhra',
      'key:Enter',
      'tap:UI_Right',
      'tap:UI_Select',
      'tap:CamZoomIn',
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
    const input = new RecordingDestinationInput()
    const service = new EliteDestinationService(input, galaxyMapRuntime(), route, immediateTiming(200))

    const result = await service.plot('Sol')

    expect(result).toMatchObject({ status: 'timed_out', phase: 'confirm_route', confirmedSystem: null })
    expect(result.message).toContain('newly plotted route')
    expect(input.events.at(-1)).toBe('tap:GalaxyMapOpen')
  })

  test('rejects the operation before sending input when the backend or required bindings are unavailable', async () => {
    const input = new RecordingDestinationInput()
    input.available = false
    const service = new EliteDestinationService(input, galaxyMapRuntime(), mutableRoute({ timestamp: null, route: [] }), immediateTiming())

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected',
      phase: 'preflight',
      message: 'Galaxy Map input unavailable.'
    })
    expect(input.events).toEqual([])
  })

  test('does not send Galaxy Map input when Elite telemetry is stale', async () => {
    const input = new RecordingDestinationInput()
    const service = new EliteDestinationService(
      input,
      galaxyMapRuntime('2026-09-11T11:59:00.000Z'),
      mutableRoute({ timestamp: null, route: [] }),
      immediateTiming()
    )

    await expect(service.plot('Sol')).resolves.toMatchObject({
      status: 'rejected',
      phase: 'preflight',
      message: 'Elite status is stale.'
    })
    expect(input.events).toEqual([])
  })
})

class RecordingDestinationInput implements EliteDestinationInput {
  public available = true
  public readonly events: string[] = []

  public constructor (private readonly onPlot?: () => void) {}

  public getStatus () {
    return {
      available: this.available,
      detail: this.available ? 'Ready.' : 'Galaxy Map input unavailable.',
      missingBindings: []
    }
  }

  public async tap (binding: EliteDestinationBinding): Promise<void> {
    this.events.push(`tap:${binding}`)
  }

  public async hold (binding: EliteDestinationBinding, durationMs: number): Promise<void> {
    this.events.push(`hold:${binding}:${durationMs}`)
    this.onPlot?.()
  }

  public async tapKey (key: string): Promise<void> {
    this.events.push(`key:${key}`)
  }

  public async typeText (text: string): Promise<void> {
    this.events.push(`type:${text}`)
  }
}

function galaxyMapRuntime (timestamp = '2026-09-11T12:00:00.000Z'): RuntimeStateReader {
  const state = createEmptyRuntimeState()
  return {
    getCurrent: () => ({
      ...state,
      gameStatus: {
        ...state.gameStatus,
        timestamp,
        guiFocus: { id: 6, label: 'galaxy_map' }
      }
    }) as ReturnType<RuntimeStateReader['getCurrent']>
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
    now: () => Date.parse('2026-09-11T12:00:00.000Z'),
    pollIntervalMs: 100,
    mapFocusTimeoutMs: 1_000,
    routeConfirmationTimeoutMs,
    statusFreshnessMs: 15_000
  }
}
