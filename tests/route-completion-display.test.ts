import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type DisplayCommand, type NavigationRoute } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { RouteCompletionDisplay } from '../apps/server/src/application/route-completion-display.js'
import { DisplayCommandService } from '../apps/server/src/application/display-command-service.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { routeForDisplayCommand } from '../apps/web/src/application/navigation/display-page-routes.js'

function state(name: string | null, address: number | null = null, jumping = false) {
  const result = createEmptyRuntimeState()
  result.system.name = name
  result.system.address = address
  result.gameStatus = parseEliteStatus({ timestamp: '2026-09-28T12:00:00Z', event: 'Status', Flags: 0 })
  result.gameStatus.flags.fsdJump = jumping
  return result
}
function route(...systems: string[]): NavigationRoute {
  return { timestamp: '2026-09-28T12:00:00Z', route: systems.map(system => ({ system, address: null, position: null, starClass: null })) }
}
function fixture(initial = state('Sol')) {
  const publisher = new InProcessPublisher<DisplayCommand>()
  const commands: DisplayCommand[] = []
  publisher.subscribe(command => commands.push(command))
  const display = new DisplayCommandService(publisher, { getCurrent: () => initial })
  return { tracker: new RouteCompletionDisplay(initial, display), commands }
}

test('final arrival opens the destination schematic exactly once through the normal display command', () => {
  const { tracker, commands } = fixture()
  tracker.routeChanged(route('Sol', 'Achenar', 'Alioth'))
  tracker.runtimeChanged(state('Achenar'))
  expect(commands).toHaveLength(0)
  tracker.runtimeChanged(state('Alioth'))
  expect(commands).toHaveLength(1)
  expect(commands[0]).toMatchObject({ type: 'show_system', systemName: 'Alioth', selectedName: null })
  expect(routeForDisplayCommand(commands[0]!)).toEqual({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Alioth' })
  tracker.runtimeChanged(state('Alioth'))
  tracker.routeChanged(route('Alioth'))
  tracker.routeChanged(route())
  expect(commands).toHaveLength(1)
})

test('cleared and replaced routes do not open their old destinations', () => {
  const { tracker, commands } = fixture()
  tracker.routeChanged(route('Sol', 'Alioth'))
  tracker.routeChanged(route())
  tracker.runtimeChanged(state('Alioth'))
  tracker.routeChanged(route('Alioth', 'Sol'))
  tracker.routeChanged(route('Alioth', 'Achenar'))
  tracker.runtimeChanged(state('Sol'))
  expect(commands).toHaveLength(0)
  tracker.runtimeChanged(state('Achenar'))
  expect(commands).toHaveLength(1)
})

test('startup at destination and repeated telemetry do not count as arrival', () => {
  const { tracker, commands } = fixture(state(null))
  tracker.routeChanged(route('Sol', 'Alioth'))
  tracker.runtimeChanged(state('Alioth'))
  tracker.runtimeChanged(state('Alioth'))
  tracker.routeChanged(route('Alioth'))
  expect(commands).toHaveLength(0)
})

test('route clearing during the final jump still allows arrival, but jump cancellation disarms it', () => {
  const { tracker, commands } = fixture(state('Sol', null, true))
  tracker.routeChanged(route('Sol', 'Alioth'))
  tracker.routeChanged(route())
  tracker.runtimeChanged(state('Alioth'))
  expect(commands).toHaveLength(1)
  tracker.routeChanged(route('Alioth', 'Achenar'))
  tracker.runtimeChanged(state('Alioth', null, true))
  tracker.routeChanged(route())
  tracker.runtimeChanged(state('Alioth', null, false))
  tracker.runtimeChanged(state('Achenar'))
  expect(commands).toHaveLength(1)
})

test('system address takes precedence; names are a case-insensitive fallback', () => {
  const { tracker, commands } = fixture(state('Sol', 1))
  const plotted = route('Alioth')
  plotted.route[0]!.address = 2
  tracker.routeChanged(plotted)
  tracker.runtimeChanged(state('Alioth', 3))
  expect(commands).toHaveLength(0)
  tracker.runtimeChanged(state('Alioth', 2))
  expect(commands).toHaveLength(1)
  tracker.routeChanged(route('ACHENAR'))
  tracker.runtimeChanged(state('Achenar'))
  expect(commands).toHaveLength(2)
})
