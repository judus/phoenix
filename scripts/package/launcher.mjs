import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const installRoot = fileURLToPath(new URL('../../', import.meta.url))
const runtime = resolve(installRoot, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
const server = resolve(installRoot, 'apps/server/dist/main.js')
const port = validatedPort(process.env.PHOENIX_PORT ?? '3400')
const localUrl = `http://127.0.0.1:${port}`
const launcherRoot = platformLauncherRoot()
const lockPath = resolve(launcherRoot, 'launcher.lock')
const stopPath = resolve(launcherRoot, 'launcher.stop')
const logPath = resolve(launcherRoot, 'phoenix.log')
const runtimeStatusPath = resolve(launcherRoot, 'runtime.txt')

mkdirSync(launcherRoot, { recursive: true })

if (process.argv.includes('--stop')) {
  stopExistingLauncher()
  process.exit(0)
}

const lock = acquireLock()
if (!lock.acquired) {
  const existingUrl = `http://127.0.0.1:${lock.port}`
  if (await waitForReady(existingUrl, undefined, 5_000) && process.env.PHOENIX_LAUNCHER_OPEN_BROWSER !== 'false') {
    openBrowser(existingUrl)
  }
  process.exit(0)
}

const log = openSync(logPath, 'a')
let child
let requestedStop = false
let forceStopTimer
let stopPoll

try {
  removeFile(stopPath)
  removeFile(runtimeStatusPath)
  logLine(log, `Launcher starting PHOENIX ${localUrl}.`)
  child = spawn(runtime, [server], {
    cwd: installRoot,
    env: {
      ...process.env,
      PHOENIX_PATH_MODE: 'installed',
      PHOENIX_PORT: String(port),
      PHOENIX_RUNTIME_STATUS_PATH: runtimeStatusPath
    },
    stdio: ['pipe', log, log]
  })
  child.stdin.on('error', () => {})

  const requestStop = () => {
    if (requestedStop) return
    requestedStop = true
    logLine(log, 'Launcher requested a clean PHOENIX shutdown.')
    if (child.exitCode === null && child.signalCode === null) child.stdin.end()
    forceStopTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 5_000)
    forceStopTimer.unref()
  }
  process.once('SIGINT', requestStop)
  process.once('SIGTERM', requestStop)
  stopPoll = setInterval(() => {
    try {
      readFileSync(stopPath)
      try { unlinkSync(stopPath) } catch {}
      requestStop()
    } catch {}
  }, 250)

  if (!await waitForReady(localUrl, child, 60_000)) {
    requestStop()
    throw new Error(`PHOENIX did not become healthy at ${localUrl}. See ${logPath}.`)
  }

  logLine(log, `PHOENIX is ready at ${localUrl}.`)
  if (process.env.PHOENIX_LAUNCHER_OPEN_BROWSER !== 'false') openBrowser(localUrl)

  const result = await waitForExit(child)
  if (forceStopTimer) clearTimeout(forceStopTimer)
  if (!requestedStop && (result.code !== 0 || result.signal !== null)) {
    throw new Error(`PHOENIX stopped unexpectedly (${result.code ?? result.signal}). See ${logPath}.`)
  }
  logLine(log, 'PHOENIX stopped cleanly.')
} catch (error) {
  logLine(log, error instanceof Error ? error.message : String(error))
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (forceStopTimer) clearTimeout(forceStopTimer)
  if (stopPoll) clearInterval(stopPoll)
  if (child?.exitCode === null && child?.signalCode === null) child.kill('SIGKILL')
  removeFile(stopPath)
  removeFile(runtimeStatusPath)
  releaseLock()
  closeSync(log)
}

function platformLauncherRoot () {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? resolve(homedir(), 'AppData', 'Local')
    return resolve(localAppData, 'PHOENIX', 'Logs')
  }
  const state = process.env.XDG_STATE_HOME ?? resolve(homedir(), '.local', 'state')
  return resolve(state, 'phoenix', 'logs')
}

function validatedPort (value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) throw new Error(`Invalid PHOENIX_PORT: ${value}`)
  return parsed
}

function acquireLock () {
  try {
    const descriptor = openSync(lockPath, 'wx')
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, port })}\n`)
    closeSync(descriptor)
    return { acquired: true }
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const existing = readLock()
    if (existing && processExists(existing.pid)) return { acquired: false, port: validatedPort(existing.port ?? String(port)) }
    try { unlinkSync(lockPath) } catch (unlinkError) {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError
    }
    const descriptor = openSync(lockPath, 'wx')
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, port })}\n`)
    closeSync(descriptor)
    return { acquired: true }
  }
}

function releaseLock () {
  const lock = readLock()
  if (lock?.pid !== process.pid) return
  try { unlinkSync(lockPath) } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function readLock () {
  try {
    const value = JSON.parse(readFileSync(lockPath, 'utf8'))
    return Number.isInteger(value.pid) ? value : null
  } catch {
    return null
  }
}

function processExists (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function stopExistingLauncher () {
  const lock = readLock()
  if (!lock || !processExists(lock.pid)) {
    try { unlinkSync(lockPath) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    return
  }
  writeFileSync(stopPath, `${Date.now()}\n`, 'utf8')
}

function removeFile (path) {
  try { unlinkSync(path) } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function waitForReady (url, serverProcess, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if ((serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) || serverProcess?.signalCode) return false
    try {
      const response = await fetch(`${url}/api/pairing/status`)
      if (response.ok) return true
    } catch {}
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
  }
  return false
}

function openBrowser (url) {
  const command = process.platform === 'win32'
    ? { executable: 'cmd.exe', arguments: ['/d', '/s', '/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { executable: 'open', arguments: [url] }
      : { executable: 'xdg-open', arguments: [url] }
  const browser = spawn(command.executable, command.arguments, { detached: true, stdio: 'ignore' })
  browser.once('error', () => {})
  browser.unref()
}

function waitForExit (serverProcess) {
  if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return Promise.resolve({ code: serverProcess.exitCode, signal: serverProcess.signalCode })
  }
  return new Promise((resolveExit, reject) => {
    serverProcess.once('error', reject)
    serverProcess.once('exit', (code, signal) => resolveExit({ code, signal }))
  })
}

function logLine (descriptor, message) {
  writeSync(descriptor, `[${new Date().toISOString()}] ${message}\n`)
}
