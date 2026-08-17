export class LatestRequest {
  #controller: AbortController | undefined

  start(): AbortSignal {
    this.#controller?.abort()
    this.#controller = new AbortController()
    return this.#controller.signal
  }

  cancel(): void {
    this.#controller?.abort()
    this.#controller = undefined
  }

  isCurrent(signal: AbortSignal): boolean {
    return !signal.aborted && this.#controller?.signal === signal
  }
}
