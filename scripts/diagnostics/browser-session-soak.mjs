// Run only against the isolated in-memory preview (mock cartography, no Elite/game input).
// Start a separate Chrome with --remote-debugging-port=9337, then:
// node scripts/diagnostics/browser-session-soak.mjs --isolated-preview-url=http://127.0.0.1:PORT
// About 90 seconds: 500 system routes, 2,000 runtime events, workspace switches.
// Reports forced-GC heap/DOM/listener measurements; this is not a physical-tablet diagnosis.
import assert from 'node:assert/strict'
import { RuntimeStateSchema } from '@phoenix/contracts'

const urlArgument = process.argv.find(argument => argument.startsWith('--isolated-preview-url='))
const previewUrl = urlArgument?.slice('--isolated-preview-url='.length)
if (!previewUrl || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(previewUrl)) {
  throw new Error('Provide --isolated-preview-url=http://127.0.0.1:PORT for an in-memory preview with mock cartography.')
}
const origin = new URL(previewUrl).origin
const tabs = await (await fetch('http://127.0.0.1:9337/json/list')).json()
const tab = tabs.find(candidate => candidate.type === 'page')
if (!tab) throw new Error('The separate diagnostic Chrome has no page target.')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let nextId = 0
const pending = new Map()
const requests = { total: 0, failed: 0, httpErrors: 0 }
const errors = []
const systemsRequested = new Set()
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Network.requestWillBeSent') {
    requests.total += 1
    const requestUrl = new URL(message.params.request.url)
    const system = requestUrl.searchParams.get('name')
    if (requestUrl.pathname === '/api/navigation/system' && system?.startsWith('Soak ')) systemsRequested.add(system)
  }
  if (message.method === 'Network.loadingFailed' && !message.params.canceled) requests.failed += 1
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) requests.httpErrors += 1
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
async function navigate(hash, delay = 100) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await settle(delay)
}

async function sample(label) {
  await call('HeapProfiler.collectGarbage')
  const { metrics } = await call('Performance.getMetrics')
  const heap = metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value
  const dom = await call('Memory.getDOMCounters')
  const activeStreams = await evaluate('window.phoenixSoak.sources.size')
  assert.equal(activeStreams, 1, 'One event stream should remain active throughout route changes')
  const measurement = { label, heapBytes: heap, ...dom, activeStreams, requests: { ...requests } }
  console.log(JSON.stringify(measurement))
  return measurement
}

try {
  await call('Page.enable')
  await call('Runtime.enable')
  await call('Network.enable')
  await call('Performance.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 800, height: 1280, deviceScaleFactor: 1, mobile: false })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.phoenixSoak = { sources: new Set() };
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(...arguments_) {
        super(...arguments_);
        window.phoenixSoak.sources.add(this);
      }
      close() {
        window.phoenixSoak.sources.delete(this);
        super.close();
      }
    };
  ` })
  await call('Page.navigate', { url: `${origin}/#/galaxy/atlas` })
  await settle(1500)
  assert.equal(await evaluate('location.origin'), origin)
  await evaluate(`(async () => {
    const response = await fetch('/api/runtime-state');
    if (!response.ok) throw new Error('Isolated runtime unavailable');
    window.phoenixSoak.runtime = await response.json();
    window.phoenixSoak.revision = window.phoenixSoak.runtime.revision;
  })()`)
  RuntimeStateSchema.parse(await evaluate('window.phoenixSoak.runtime'))

  // Warm lazy pages before collecting a baseline, avoiding ordinary module-loading growth.
  const workspaces = ['#/controls/quick', '#/numpad', '#/log/commander', '#/developer/journal', '#/galaxy/atlas']
  for (const hash of workspaces) await navigate(hash, 250)
  const samples = [await sample('warm baseline')]
  for (let round = 0; round < 10; round += 1) {
    for (let index = 0; index < 50; index += 1) {
      const name = `Soak ${round * 50 + index}`
      await navigate(`#/galaxy/system?name=${encodeURIComponent(name)}`, 40)
    }
    for (const hash of workspaces) await navigate(hash)
    for (let batch = 0; batch < 10; batch += 1) {
      await evaluate(`(() => {
        const probe = window.phoenixSoak;
        const source = [...probe.sources][0];
        for (let index = 0; index < 20; index += 1) {
          source.dispatchEvent(new MessageEvent('runtime-state', {
            data: JSON.stringify({ ...probe.runtime, revision: ++probe.revision })
          }));
        }
      })()`)
      await settle(25)
    }
    await settle(5000)
    samples.push(await sample(`round ${round + 1}`))
  }
  assert.equal(errors.length, 0, `Browser exceptions: ${errors.join('; ')}`)
  assert.equal(systemsRequested.size, 500, 'Every distinct route must exercise a distinct cartography request')
  console.log(JSON.stringify({
    completed: true,
    systemRoutes: 500,
    systemsRequested: systemsRequested.size,
    injectedRuntimeEvents: 2000,
    heapDeltaBytes: samples.at(-1).heapBytes - samples[0].heapBytes,
    listenerDelta: samples.at(-1).jsEventListeners - samples[0].jsEventListeners,
    requests,
    errors
  }))
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout)
  socket.close()
}
