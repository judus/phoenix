// Isolated production shell only; no real player/server/provider data.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RuntimeStateSchema } from '@phoenix/contracts'

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const previewUrl = argument('isolated-preview-url')
if (!previewUrl || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(previewUrl)) {
  throw new Error('Provide the supplied isolated fixture URL: --isolated-preview-url=http://127.0.0.1:PORT')
}
const port = argument('debugging-port') ?? '9344'
assert.match(port, /^\d+$/)
const origin = new URL(previewUrl).origin
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const tab = tabs.find(candidate => candidate.type === 'page')
assert.ok(tab, 'A fresh separate diagnostic Chrome must have a page target')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
const pending = new Map()
const counts = new Map()
const successfulResponses = new Set()
const errors = []
const httpErrors = []
let nextId = 0
let instrumentation
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Network.requestWillBeSent') {
    const url = new URL(message.params.request.url)
    if (url.origin === origin) counts.set(url.pathname, (counts.get(url.pathname) ?? 0) + 1)
    else if (url.protocol === 'http:' || url.protocol === 'https:') errors.push(`Unexpected external request: ${url.origin}`)
  }
  if (message.method === 'Network.loadingFailed' && !message.params.canceled) errors.push(message.params.errorText)
  if (message.method === 'Network.responseReceived' && message.params.response.status === 200) {
    successfulResponses.add(new URL(message.params.response.url).pathname)
  }
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
    const response = message.params.response
    const pathname = new URL(response.url).pathname
    // Copilot is deliberately disabled, so its initial catalogue reports unavailable.
    if (pathname !== '/api/copilot/profiles' || response.status !== 503) httpErrors.push({ pathname, status: response.status })
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  clearTimeout(request.timeout)
  message.error ? request.reject(message.error) : request.resolve(message.result)
})
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out`))
    }, 30_000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const settle = milliseconds => evaluate(`new Promise(resolve => setTimeout(resolve, ${milliseconds}))`)
async function sample() {
  await call('HeapProfiler.collectGarbage')
  const { metrics } = await call('Performance.getMetrics')
  const selected = Object.fromEntries(metrics.filter(metric => [
    'JSHeapUsedSize', 'ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration'
  ].includes(metric.name)).map(metric => [metric.name, metric.value]))
  const dom = await call('Memory.getDOMCounters')
  const probe = await evaluate('({ commits: window.phoenixProfile.commits, activeStreams: window.phoenixProfile.sources.size })')
  assert.equal(probe.activeStreams, 1)
  return { ...selected, ...dom, ...probe }
}
function delta(after, before) {
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]]))
}
async function navigate(view) {
  await evaluate(`location.hash = ${JSON.stringify(view.hash)}`)
  // Do not confuse a lazy-loading/error page with a successful zero-request result.
  for (let attempt = 0; attempt < 100; attempt++) {
    const selected = await evaluate(`location.hash === ${JSON.stringify(view.hash)} &&
      document.querySelector('h1')?.textContent.trim() === ${JSON.stringify(view.heading)}`)
    if (selected && successfulResponses.has(view.endpoint)) {
      if (view.hash.includes('/galaxy/system')) {
        assert.equal(await evaluate("document.querySelectorAll('.system-body-node').length"), 121, 'Dense mocked catalogue must actually render')
      }
      await settle(500)
      return
    }
    await settle(100)
  }
  throw new Error(`Expected successful ${view.endpoint} and heading ${view.heading} at ${view.hash}`)
}
try {
  await call('Page.enable')
  await call('Runtime.enable')
  await call('Network.enable')
  await call('Performance.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 800, height: 1280, deviceScaleFactor: 1, mobile: false })
  instrumentation = await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.phoenixProfile = { sources: new Set(), commits: 0 };
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(...args) { super(...args); window.phoenixProfile.sources.add(this); }
      close() { window.phoenixProfile.sources.delete(this); super.close(); }
    };
    // Root commits, NOT individual component renders. This production-safe hook
    // deliberately does not retain roots/fibers or install the DevTools extension.
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, inject() { return 1; },
      onCommitFiberRoot() { window.phoenixProfile.commits++; },
      onCommitFiberUnmount() {}
    };
  ` })
  // Changing only the hash can keep an earlier bundle/runtime alive. A unique
  // query forces a fresh document after rebuilds and restarts monotonic revisions.
  const documentQuery = `?diagnostic-profile=${Date.now()}`
  await call('Page.navigate', { url: `${origin}/${documentQuery}#/engineering/materials/encoded` })
  await settle(1500)
  assert.equal(await evaluate('location.origin'), origin)
  assert.equal(await evaluate('location.search'), documentQuery)
  const expectedEntry = readFileSync(new URL('../../apps/web/dist/index.html', import.meta.url), 'utf8').match(/<script[^>]+src="([^"]+)"/)?.[1]
  assert.ok(expectedEntry, 'Build the production web shell before profiling')
  const loadedEntry = await evaluate("new URL(document.querySelector('script[src]').src).pathname")
  assert.equal(loadedEntry, expectedEntry, 'Fixture must serve the current production entry asset')
  console.log(JSON.stringify({ productionEntry: loadedEntry, freshDocumentQuery: documentQuery,
    chrome: (await call('Browser.getVersion')).product, viewport: { width: 800, height: 1280 } }))
  await evaluate(`(async () => {
    const response = await fetch('/api/runtime-state');
    if (!response.ok) throw new Error('Diagnostic runtime unavailable');
    const probe = window.phoenixProfile;
    probe.runtime = await response.json();
    probe.revision = probe.runtime.revision;
  })()`)
  RuntimeStateSchema.parse(await evaluate('window.phoenixProfile.runtime'))
  const views = [
    { hash: '#/engineering/materials/encoded', heading: 'Encoded materials', endpoint: '/api/engineering/materials' },
    { hash: '#/engineering/blueprints', heading: 'Blueprints', endpoint: '/api/engineering/blueprints' },
    { hash: '#/engineering/engineers', heading: 'Engineers', endpoint: '/api/engineering/engineers' },
    { hash: '#/equipment/materials', heading: 'Materials', endpoint: '/api/equipment/materials' },
    { hash: '#/galaxy/system?name=Diagnostic', heading: 'Diagnostic', endpoint: '/api/navigation/system' }
  ]
  // Warm lazy module caches, then compare quiet/event windows within each mounted page.
  for (const view of views) await navigate(view)
  for (const view of views) {
    await navigate(view)
    const quietStart = await sample()
    await settle(5000)
    const before = await sample()
    counts.clear()
    await evaluate(`(async () => {
      const probe = window.phoenixProfile;
      const source = [...probe.sources][0];
      for (let index = 0; index < 100; index++) {
        source.dispatchEvent(new MessageEvent('runtime-state', {
          data: JSON.stringify({ ...probe.runtime, revision: ++probe.revision })
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    })()`)
    await settle(500)
    const after = await sample()
    console.log(JSON.stringify({ hash: view.hash, events: 100, unchangedRuntimeSlices: true,
      quietDelta: delta(before, quietStart), eventDelta: delta(after, before),
      requests: Object.fromEntries(counts), after }))
  }
  assert.deepEqual(errors, [], 'No browser exceptions or unexpected network requests')
  assert.deepEqual(httpErrors, [], 'No unexpected HTTP errors')
  console.log(JSON.stringify({ completed: true, events: 500, errors, httpErrors }))
} finally {
  if (instrumentation) await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: instrumentation.identifier })
  for (const request of pending.values()) clearTimeout(request.timeout)
  socket.close()
}
