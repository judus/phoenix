import type { NavigationRoute, RuntimeState } from '@phoenix/contracts'
import type { DisplayCommands } from './mcp-tools/tool-gateways.js'

type Destination = NavigationRoute['route'][number]

/** Tracks arrival, not an empty NavRoute file (which can also mean cancellation). */
export class RouteCompletionDisplay {
  private destination: Destination | null = null
  private clearedDuringJump = false

  public constructor(
    private state: RuntimeState,
    private readonly display: Pick<DisplayCommands, 'showSystem'>
  ) {}

  public routeChanged(route: NavigationRoute): void {
    const destination = route.route.at(-1) ?? null
    // The route file can clear before the journal reports the last jump's arrival.
    if (!destination && this.state.gameStatus?.flags.fsdJump && this.destination) {
      this.clearedDuringJump = true
      return
    }
    this.clearedDuringJump = false
    this.destination = destination && !atDestination(this.state, destination) ? destination : null
  }

  public runtimeChanged(state: RuntimeState): void {
    const previous = this.state
    this.state = state
    const destination = this.destination
    if (!destination) return
    if (atDestination(state, destination)) {
      this.destination = null
      this.clearedDuringJump = false
      if (previous.system.name && !atDestination(previous, destination)) {
        this.display.showSystem({ systemName: state.system.name ?? destination.system })
      }
      return
    }
    // A cancelled jump must not leave a cleared route armed for a later journey.
    if (this.clearedDuringJump && !state.gameStatus?.flags.fsdJump) {
      this.destination = null
      this.clearedDuringJump = false
    }
  }
}

function atDestination(state: RuntimeState, destination: Destination): boolean {
  if (state.system.address !== null && destination.address !== null) return state.system.address === destination.address
  return state.system.name?.trim().toLowerCase() === destination.system.trim().toLowerCase()
}
