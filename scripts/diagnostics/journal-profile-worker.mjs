import { performance, monitorEventLoopDelay } from 'node:perf_hooks'
import { PhoenixApplication } from '../../apps/server/src/phoenix-application.ts'
import { InMemorySystemSettingsRepository } from '../../apps/server/src/infrastructure/json-system-configuration.ts'

process.env.PHOENIX_EDDN_TEST_MODE = '0'
globalThis.fetch = async () => { throw new Error('External fetch is forbidden in the journal diagnostic.') }
const settings = new InMemorySystemSettingsRepository()
const current = settings.loadOrCreate()
settings.save({ ...current, community: { eddnEnabled: false, eddnChangedAt: 0 } })
const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: process.argv[2],
  eliteBindingsDirectory: null, host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null,
  openAiEnvironmentKey: null, systemSettingsRepository: settings, atlasSources: [] })

// If the parent fails or is terminated, do not leave the diagnostic server/watchers running.
const disconnected = () => { void application.stop().catch(error => console.error('Diagnostic cleanup failed:', error)) }
process.once('disconnect', disconnected)

async function measure(operation) {
  const histogram = monitorEventLoopDelay({ resolution: 10 })
  histogram.enable()
  let peakRss = process.memoryUsage().rss, maxTimerLagMs = 0, lastTick = performance.now()
  const timer = setInterval(() => {
    const now = performance.now()
    maxTimerLagMs = Math.max(maxTimerLagMs, now - lastTick - 10)
    lastTick = now
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }, 10)
  const before = process.memoryUsage()
  const linesBefore = application.journalSource.getDiagnostics().linesRead
  const start = performance.now()
  let address
  try {
    if (operation === 'bootstrap') {
      address = await application.start()
      // Explicit refreshes exclude the normal 500 ms poll interval from ingestion wall time.
      await application.journalSource.stop()
    } else if (operation === 'idle') await new Promise(resolve => setTimeout(resolve, 250))
    else if (operation === 'history') {
      await application.journalBackfill.stop()
      await application.journalBackfill.start()
    } else await application.journalSource.refresh()
    const wallMs = performance.now() - start
    const after = process.memoryUsage()
    peakRss = Math.max(peakRss, after.rss)
    // Let timers/sockets observe any starvation before stopping the measurement.
    await new Promise(resolve => setTimeout(resolve, 50))
    const journal = application.journalSource.getDiagnostics()
    const history = application.journalBackfill.getDiagnostics()
    if (journal.error || history.error) throw new Error(journal.error ?? history.error)
    return { type: 'result', operation, port: address?.port,
      wallMs, linesProcessed: journal.linesRead - linesBefore, revision: application.stateStore.getCurrent().revision,
      history: { status: history.status, linesProcessed: history.linesProcessed, bytesProcessed: history.bytesProcessed },
      memory: { before, after, sampledPeakRss: peakRss, processPeakRss: process.resourceUsage().maxRSS * 1024 },
      eventLoop: { samples: histogram.count, maxDelayMs: histogram.max / 1e6, p99DelayMs: histogram.percentile(99) / 1e6, maxTimerLagMs } }
  } finally { clearInterval(timer); histogram.disable() }
}

process.on('message', async ({ id, operation }) => {
  try {
    if (operation === 'stop') {
      await application.stop()
      process.send({ type: 'result', id })
    } else process.send({ ...await measure(operation), id })
  } catch (error) { process.send({ type: 'result', id, error: error.message }) }
  finally {
    if (operation === 'stop') {
      process.removeListener('disconnect', disconnected)
      process.disconnect()
    }
  }
})
process.send({ type: 'ready' })
