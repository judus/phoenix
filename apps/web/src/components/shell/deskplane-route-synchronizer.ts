import { isPhoenixWorkspace, type PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export class DeskplaneRouteSynchronizer {
  #activeWorkspace: PhoenixWorkspace
  #programmaticTarget: PhoenixWorkspace | undefined

  constructor(activeWorkspace: PhoenixWorkspace) {
    this.#activeWorkspace = activeWorkspace
  }

  beginRouteSynchronization(workspace: PhoenixWorkspace): void {
    this.#activeWorkspace = workspace
    this.#programmaticTarget = workspace
  }

  finishRouteSynchronization(workspace: PhoenixWorkspace): void {
    if (this.#programmaticTarget === workspace) this.#programmaticTarget = undefined
  }

  receiveDeskplaneSnapshot(desktop: string): PhoenixWorkspace | undefined {
    if (this.#programmaticTarget) {
      if (desktop === this.#programmaticTarget) this.#programmaticTarget = undefined
      return undefined
    }
    if (!isPhoenixWorkspace(desktop) || desktop === this.#activeWorkspace) return undefined
    this.#activeWorkspace = desktop
    return desktop
  }
}
