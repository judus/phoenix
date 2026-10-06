// Parent-only fetch reads are delayed; the worker still uses the actual HTTP/SSE server.
const nativeFetch = globalThis.fetch
globalThis.fetch = async (input, options) => {
  const response = await nativeFetch(input, options)
  if (new URL(String(input)).pathname !== '/api/runtime-state/stream') return response
  const reader = response.body.getReader()
  const body = new ReadableStream({
    async pull(controller) {
      await new Promise(resolve => setTimeout(resolve, 120))
      const { done, value } = await reader.read()
      if (done) controller.close()
      else controller.enqueue(value)
    },
    cancel(reason) { return reader.cancel(reason) }
  })
  return new Response(body, { status: response.status, headers: response.headers })
}
