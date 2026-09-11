import { setTimeout as delay } from 'node:timers/promises'
import {
  PlotEliteDestinationRequestSchema,
  PlotEliteDestinationResultSchema,
  type EliteDestinationPhase,
  type NavigationRoute,
  type PlotEliteDestinationResult
} from '@phoenix/contracts'
import type { NavigationRouteReader } from '../domain/navigation.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import {
  EliteDestinationOperationError,
  type EliteDestinationInput,
  type EliteDestinations
} from '../domain/elite-destination.js'

export interface EliteDestinationTiming {
  pause(durationMs: number, signal?: AbortSignal): Promise<void>
  now(): number
  pollIntervalMs: number
  mapFocusTimeoutMs: number
  routeConfirmationTimeoutMs: number
  statusFreshnessMs: number
}

const DEFAULT_TIMING: EliteDestinationTiming = {
  pause: async (durationMs, signal) => delay(durationMs, undefined, { signal }),
  now: Date.now,
  pollIntervalMs: 100,
  mapFocusTimeoutMs: 12_000,
  routeConfirmationTimeoutMs: 15_000,
  statusFreshnessMs: 30_000
}

export class EliteDestinationService implements EliteDestinations {
  private active = false

  public constructor (
    private readonly input: EliteDestinationInput,
    private readonly runtimeState: RuntimeStateReader,
    private readonly navigationRoutes: NavigationRouteReader,
    private readonly timing: EliteDestinationTiming = DEFAULT_TIMING
  ) {}

  public async plot (systemNameCandidate: string, signal?: AbortSignal): Promise<PlotEliteDestinationResult> {
    const { systemName } = PlotEliteDestinationRequestSchema.parse({ systemName: systemNameCandidate })
    if (this.active) return result(systemName, 'rejected', 'preflight', 'Another Galaxy Map operation is already running.')

    const status = this.input.getStatus()
    if (!status.available) return result(systemName, 'rejected', 'preflight', status.detail)
    const gameStatus = this.runtimeState.getCurrent().gameStatus
    if (!gameStatus) {
      return result(systemName, 'rejected', 'preflight', 'Elite is not reporting live status.')
    }
    const statusAge = this.timing.now() - Date.parse(gameStatus.timestamp)
    if (!Number.isFinite(statusAge) || statusAge > this.timing.statusFreshnessMs) {
      return result(systemName, 'rejected', 'preflight', 'Elite status is stale.')
    }

    this.active = true
    const baselineRoute = this.navigationRoutes.getCurrent()
    let openedMap = false
    try {
      await this.at('open_map', async () => {
        await this.input.tap('GalaxyMapOpen', signal)
        openedMap = true
        await this.waitFor(
          () => this.runtimeState.getCurrent().gameStatus?.guiFocus?.id === 6,
          this.timing.mapFocusTimeoutMs,
          'open_map',
          'Elite did not report an open Galaxy Map.',
          signal
        )
      })

      await this.at('focus_search', async () => {
        await this.timing.pause(500, signal)
        await this.input.tap('UI_Up', signal)
        await this.timing.pause(500, signal)
        await this.input.tap('UI_Select', signal)
        await this.timing.pause(500, signal)
      })

      await this.at('enter_destination', async () => {
        await this.input.typeText(systemName, signal)
        await this.input.tapKey('Enter', signal)
        await this.timing.pause(2_000, signal)
      })

      await this.at('select_result', async () => {
        await this.input.tap('UI_Right', signal)
        await this.timing.pause(500, signal)
        await this.input.tap('UI_Select', signal)
        await this.timing.pause(2_000, signal)
        await this.input.tap('CamZoomIn', signal)
        await this.timing.pause(500, signal)
      })

      await this.at('plot_route', async () => {
        await this.input.hold('UI_Select', 5_000, signal)
      })

      const confirmedRoute = await this.at('confirm_route', async () => this.waitForRoute(systemName, baselineRoute, signal))
      const confirmedSystem = confirmedRoute.route.at(-1)!.system

      try {
        await this.closeMap(signal)
        openedMap = false
      } catch (cause) {
        return result(
          systemName,
          'confirmed',
          'close_map',
          `Route to ${confirmedSystem} was confirmed, but PHOENIX could not close the Galaxy Map: ${errorMessage(cause)}`,
          confirmedSystem
        )
      }
      return result(systemName, 'confirmed', 'confirm_route', `Route to ${confirmedSystem} was confirmed.`, confirmedSystem)
    } catch (cause) {
      if (openedMap && this.runtimeState.getCurrent().gameStatus?.guiFocus?.id === 6) {
        try { await this.closeMap() } catch { /* Preserve the primary failure. */ }
      }
      if (cause instanceof EliteDestinationOperationError) {
        return result(systemName, cause.timedOut ? 'timed_out' : 'failed', cause.phase, cause.message)
      }
      return result(systemName, 'failed', 'preflight', errorMessage(cause))
    } finally {
      this.active = false
    }
  }

  private async at<T> (phase: EliteDestinationPhase, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (cause) {
      if (cause instanceof EliteDestinationOperationError) throw cause
      throw new EliteDestinationOperationError(phase, errorMessage(cause), false, { cause })
    }
  }

  private async closeMap (signal?: AbortSignal): Promise<void> {
    await this.at('close_map', async () => this.input.tap('GalaxyMapOpen', signal))
  }

  private async waitForRoute (systemName: string, baseline: NavigationRoute, signal?: AbortSignal): Promise<NavigationRoute> {
    let confirmed: NavigationRoute | null = null
    await this.waitFor(() => {
      const route = this.navigationRoutes.getCurrent()
      const destination = route.route.at(-1)?.system
      if (routeChanged(route, baseline) && destination?.localeCompare(systemName, undefined, { sensitivity: 'base' }) === 0) {
        confirmed = route
        return true
      }
      return false
    }, this.timing.routeConfirmationTimeoutMs, 'confirm_route', `Elite did not confirm a newly plotted route to ${systemName}.`, signal)
    return confirmed!
  }

  private async waitFor (
    predicate: () => boolean,
    timeoutMs: number,
    phase: EliteDestinationPhase,
    timeoutMessage: string,
    signal?: AbortSignal
  ): Promise<void> {
    let elapsed = 0
    while (!predicate()) {
      signal?.throwIfAborted()
      if (elapsed >= timeoutMs) throw new EliteDestinationOperationError(phase, timeoutMessage, true)
      const interval = Math.min(this.timing.pollIntervalMs, timeoutMs - elapsed)
      await this.timing.pause(interval, signal)
      elapsed += interval
    }
  }
}

function routeChanged (current: NavigationRoute, baseline: NavigationRoute): boolean {
  if (current.timestamp !== baseline.timestamp) return true
  return JSON.stringify(current.route) !== JSON.stringify(baseline.route)
}

function result (
  requestedSystem: string,
  status: PlotEliteDestinationResult['status'],
  phase: EliteDestinationPhase,
  message: string,
  confirmedSystem: string | null = null
): PlotEliteDestinationResult {
  return PlotEliteDestinationResultSchema.parse({ requestedSystem, confirmedSystem, status, phase, message })
}

function errorMessage (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Elite Galaxy Map automation failed.'
}
