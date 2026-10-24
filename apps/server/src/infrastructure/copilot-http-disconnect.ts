interface ResponseConnection {
  readonly destroyed: boolean
  readonly writableFinished: boolean
  once(event: 'close', listener: () => void): unknown
  off(event: 'close', listener: () => void): unknown
}

/** A premature close cancels caller-owned work; a normal response finish does not. */
export function watchCopilotDisconnect (response: ResponseConnection): { signal: AbortSignal, dispose(): void } {
  const controller = new AbortController()
  const abort = () => {
    if (!response.writableFinished) controller.abort(new DOMException('Client disconnected.', 'AbortError'))
  }
  response.once('close', abort)
  if (response.destroyed) abort()
  return { signal: controller.signal, dispose: () => { response.off('close', abort) } }
}
