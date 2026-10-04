import type { NavigationRoute, RuntimeState } from '@phoenix/contracts'
import type { DisplayCommands } from './mcp-tools/tool-gateways.js'

type Destination = NavigationRoute['route'][number]

/** Tracks arrival, not an empty NavRoute file (which can also mean cancellation). */
export class RouteCompletionDisplay {
  private destination: Destination | null = null
  private clearedDuringJump = false
  private clearedJumpEnded = false

  public constructor(
    private state: RuntimeState,
    private readonly display: Pick<DisplayCommands, 'showSystem'>
  ) {}

  public routeChanged(route: NavigationRoute): void {
    const destination = route.route.at(-1) ?? null
    // The route file can clear before the journal reports the last jump's arrival.
    if (!destination && inHyperspace(this.state) && this.destination) {
      this.clearedDuringJump = true
      return
    }
    this.clearedDuringJump = false
    this.clearedJumpEnded = false
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
      this.clearedJumpEnded = false
      if (previous.system.name && !atDestination(previous, destination)) {
        this.display.showSystem({ systemName: state.system.name ?? destination.system })
      }
      return
    }
    if (this.clearedDuringJump) {
      // Status.json can finish a jump before its journal arrival is projected.
      // Keep that arrival pending, but never carry it into another journey.
      const systemChanged = previous.system.name !== null && state.system.name !== null &&
        !sameSystem(state.system, previous.system)
      if (systemChanged || (this.clearedJumpEnded && inHyperspace(state))) {
        this.destination = null
        this.clearedDuringJump = false
        this.clearedJumpEnded = false
      } else if (!inHyperspace(state)) {
        this.clearedJumpEnded = true
      }
    }
  }
}

function inHyperspace(state: RuntimeState): boolean {
  return state.gameStatus?.flags.fsdJump === true || state.location.state === 'hyperspace'
}

function atDestination(state: RuntimeState, destination: Destination): boolean {
  return sameSystem(state.system, { address: destination.address, name: destination.system })
}

function sameSystem(
  left: Pick<RuntimeState['system'], 'address' | 'name'>,
  right: Pick<RuntimeState['system'], 'address' | 'name'>
): boolean {
  if (left.address !== null && right.address !== null) return left.address === right.address
  return left.name !== null && right.name !== null &&
    left.name.trim().toLowerCase() === right.name.trim().toLowerCase()
}
