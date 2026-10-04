import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const payloadRoot = process.env.PHOENIX_PAYLOAD_ROOT
  ? resolve(process.env.PHOENIX_PAYLOAD_ROOT)
  : resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'phoenix-payload-smoke-'))
const installRoot = resolve(temporaryRoot, 'installation')
const userRoot = resolve(temporaryRoot, 'user')
const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node'
const windowsUserRoot = resolve(userRoot, 'local-app-data/PHOENIX')
const configRoot = process.platform === 'win32'
  ? resolve(windowsUserRoot, 'Config')
  : resolve(userRoot, 'config/phoenix')
const dataRoot = process.platform === 'win32'
  ? resolve(windowsUserRoot, 'Data')
  : resolve(userRoot, 'data/phoenix')
const launcherStateRoot = process.platform === 'win32'
  ? resolve(windowsUserRoot, 'Logs')
  : resolve(userRoot, 'state/phoenix/logs')
let child

try {
  cpSync(payloadRoot, installRoot, { recursive: true })
  makeReadOnly(installRoot)
  const port = await availablePort()
  const nativeLauncher = process.env.PHOENIX_SMOKE_LAUNCHER
    ? resolve(process.env.PHOENIX_SMOKE_LAUNCHER)
    : null
  const launcherRuntime = nativeLauncher ?? resolve(installRoot, 'runtime', runtimeName)
  const launcherScript = resolve(installRoot, 'scripts/package/launcher.mjs')
  const launcherArguments = nativeLauncher ? [] : [launcherScript]
  // Never inherit developer path overrides, provider credentials, or real Elite inputs.
  const inheritedEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
    !name.startsWith('PHOENIX_') && !name.startsWith('OPENAI_')
  )))
  const eliteRoot = resolve(userRoot, 'empty-elite')
  mkdirSync(eliteRoot, { recursive: true })
  const launcherEnvironment = {
    ...inheritedEnvironment,
    LOCALAPPDATA: resolve(userRoot, 'local-app-data'),
    PHOENIX_CATALOGUE_REFRESH: 'false',
    PHOENIX_HOST: '127.0.0.1',
    PHOENIX_ELITE_DIRECTORY: eliteRoot,
    PHOENIX_ELITE_BINDINGS_DIRECTORY: eliteRoot,
    PHOENIX_INPUT_BACKEND: 'recording',
    PHOENIX_LAUNCHER_OPEN_BROWSER: 'false',
    PHOENIX_OPENAI_API_KEY: 'sk-phoenix-payload-smoke-test-not-a-real-key',
    PHOENIX_PATH_MODE: 'installed',
    PHOENIX_PORT: String(port),
    XDG_CACHE_HOME: resolve(userRoot, 'cache'),
    XDG_CONFIG_HOME: resolve(userRoot, 'config'),
    XDG_DATA_HOME: resolve(userRoot, 'data'),
    XDG_STATE_HOME: resolve(userRoot, 'state')
  }
  const output = startLauncher()
  const response = await waitForServer(`http://127.0.0.1:${port}/api/pairing/status`, child, output)
  if (response.status !== 200) throw new Error(`Payload health probe returned ${response.status}.`)

  const duplicate = spawn(launcherRuntime, launcherArguments, { cwd: installRoot, env: launcherEnvironment, stdio: 'ignore' })
  const duplicateExit = await waitForExit(duplicate, 5_000)
  if (duplicateExit.code !== 0) throw new Error(`Duplicate launcher exited with ${duplicateExit.code ?? duplicateExit.signal}.`)
  if (child.exitCode !== null || child.signalCode !== null) throw new Error('The primary launcher exited after a duplicate launch attempt.')

  for (const required of [
    resolve(configRoot, 'pairing.json'),
    resolve(configRoot, 'settings.json'),
    resolve(dataRoot, 'runtime/catalogue/manifest.json'),
    resolve(dataRoot, 'runtime/phoenix.sqlite'),
    resolve(dataRoot, 'runtime/system.json')
  ]) {
    if (!existsSync(required)) throw new Error(`Payload did not create expected user state: ${required}`)
  }

  const pairing = JSON.parse(readFileSync(resolve(configRoot, 'pairing.json'), 'utf8'))
  const runtimeStatus = readFileSync(resolve(launcherStateRoot, 'runtime.txt'), 'utf8')
  if (!runtimeStatus.includes(`Pairing code: ${pairing.pairingCode}`)) {
    throw new Error('Payload did not expose its pairing code to the installed launcher.')
  }
  if (!runtimeStatus.includes('This computer: ')) {
    throw new Error('Payload did not expose its local URL to the installed launcher.')
  }
  const claim = await fetch(`http://127.0.0.1:${port}/api/pairing/claim`, {
    body: JSON.stringify({ code: pairing.pairingCode }),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
  if (!claim.ok) throw new Error(`Payload pairing claim returned ${claim.status}.`)
  const cookie = claim.headers.get('set-cookie')?.split(';')[0]
  if (!cookie) throw new Error('Payload pairing claim did not return a session cookie.')
  const contributionResponse = await fetch(`http://127.0.0.1:${port}/api/settings/eddn`, { headers: { cookie } })
  const contribution = await contributionResponse.json()
  if (!contributionResponse.ok || contribution.enabled !== true || contribution.mode !== 'unavailable' || contribution.queued !== 0) {
    throw new Error('Payload contribution preference or production release gate is incorrect.')
  }
  const anonymousLog = await fetch(`http://127.0.0.1:${port}/api/developer/eddn`)
  if (anonymousLog.status !== 401) throw new Error('Payload submission history is not protected by pairing.')
  const logResponse = await fetch(`http://127.0.0.1:${port}/api/developer/eddn`, { headers: { cookie } })
  const log = await logResponse.json()
  if (!logResponse.ok || log.status.mode !== 'unavailable' || !Array.isArray(log.entries) || log.entries.length !== 0) {
    throw new Error('Payload submission history is unavailable or contains unexpected attempts.')
  }
  const absentSubmission = await fetch(`http://127.0.0.1:${port}/api/developer/eddn/1`, { headers: { cookie } })
  if (absentSubmission.status !== 404) throw new Error('Payload does not report an absent submission correctly.')
  const optOut = await fetch(`http://127.0.0.1:${port}/api/settings/eddn`, {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false })
  })
  if (!optOut.ok || JSON.parse(readFileSync(resolve(configRoot, 'settings.json'), 'utf8')).community.eddnEnabled !== false) {
    throw new Error('Payload did not persist the contribution opt-out.')
  }
  const profileResponse = await fetch(`http://127.0.0.1:${port}/api/copilot/profiles/marin`, {
    headers: { cookie }
  })
  if (!profileResponse.ok) throw new Error(`Payload profile read returned ${profileResponse.status}.`)
  const profile = await profileResponse.json()
  const update = await fetch(`http://127.0.0.1:${port}/api/copilot/profiles/marin`, {
    body: JSON.stringify({ ...profile, characterText: `${profile.characterText}\nPayload smoke edit.` }),
    headers: { cookie, 'content-type': 'application/json' },
    method: 'PUT'
  })
  if (!update.ok) throw new Error(`Payload profile update returned ${update.status}.`)
  if (!existsSync(resolve(dataRoot, 'copilot/agents/marin/character.text.md'))) {
    throw new Error('Payload did not persist the Copilot profile under writable user data.')
  }

  await stopLauncher()

  const settingsPath = resolve(configRoot, 'settings.json')
  const legacy = JSON.parse(readFileSync(settingsPath, 'utf8'))
  legacy.version = 2
  delete legacy.copilot.profilePermissions
  legacy.controls.deckConfiguration.decks[0].name = 'Retained smoke customization'
  writeFileSync(settingsPath, JSON.stringify(legacy))
  const migratedOutput = startLauncher()
  await waitForServer(`http://127.0.0.1:${port}/api/pairing/status`, child, migratedOutput)
  await stopLauncher()
  const migratedText = readFileSync(settingsPath, 'utf8')
  const migrated = JSON.parse(migratedText)
  if (migrated.community.eddnEnabled !== false) throw new Error('Installed restart lost the EDDN opt-out.')
  if (migrated.version !== 3 || migrated.controls.deckConfiguration.decks[0].name !== 'Retained smoke customization') {
    throw new Error('Installed startup did not migrate settings while preserving customization.')
  }
  if (JSON.parse(readFileSync(resolve(configRoot, 'pairing.json'), 'utf8')).pairingCode !== pairing.pairingCode) {
    throw new Error('Installed restart replaced pairing identity.')
  }
  if (!readFileSync(resolve(dataRoot, 'copilot/agents/marin/character.text.md'), 'utf8').includes('Payload smoke edit.')) {
    throw new Error('Installed restart lost the edited Copilot profile.')
  }

  const corruptText = '{"version":'
  writeFileSync(settingsPath, corruptText)
  startLauncher()
  const failed = await waitForExit(child, 15_000)
  if (failed.code === 0) throw new Error('Installed startup accepted corrupt settings.')
  if (readFileSync(settingsPath, 'utf8') !== corruptText) throw new Error('Installed startup overwrote corrupt settings.')
  if (existsSync(resolve(launcherStateRoot, 'launcher.lock')) || existsSync(resolve(launcherStateRoot, 'runtime.txt'))) {
    throw new Error('Failed startup retained stale launcher state.')
  }
  writeFileSync(settingsPath, migratedText)
  const recoveredOutput = startLauncher()
  await waitForServer(`http://127.0.0.1:${port}/api/pairing/status`, child, recoveredOutput)
  await stopLauncher()

  const installationMode = process.platform === 'win32' ? 'isolated installation' : 'read-only installation'
  console.log(`PHOENIX payload smoke test passed: ${installationMode}, single instance, clean stop, isolated writable user state, retained data, settings migration and corrupt-settings recovery.`)

  function startLauncher () {
    const output = []
    child = spawn(launcherRuntime, launcherArguments, { cwd: installRoot, env: launcherEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', chunk => output.push(chunk.toString()))
    child.stderr.on('data', chunk => output.push(chunk.toString()))
    return output
  }

  async function stopLauncher () {
    const stopArguments = nativeLauncher ? ['--stop'] : [launcherScript, '--stop']
    const stop = spawn(launcherRuntime, stopArguments, { cwd: installRoot, env: launcherEnvironment, stdio: 'ignore' })
    const stopExit = await waitForExit(stop, 5_000)
    if (stopExit.code !== 0) throw new Error(`Launcher stop command exited with ${stopExit.code ?? stopExit.signal}.`)
    await waitForExit(child, 7_000)
  }
} finally {
  if (child !== undefined && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM')
    // The launcher gives its server five seconds before forcing shutdown. Do not
    // delete the sandbox while that server may still own files or hold the port.
    // If shutdown cannot be confirmed, preserve the sandbox for diagnosis.
    await waitForExit(child, 7_000)
  }
  makeWritable(installRoot)
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })
}

async function availablePort () {
  return await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') return reject(new Error('Could not reserve a smoke-test port.'))
      server.close(error => error === undefined ? resolvePort(address.port) : reject(error))
    })
  })
}

async function waitForServer (url, process, output) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`Payload exited during startup (${process.exitCode}).\n${output.join('')}`)
    try {
      return await fetch(url, { signal: AbortSignal.timeout(1_000) })
    } catch {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
    }
  }
  throw new Error(`Payload did not become ready.\n${output.join('')}`)
}

async function waitForExit (process, timeout) {
  if (process.exitCode !== null || process.signalCode !== null) return { code: process.exitCode, signal: process.signalCode }
  return await new Promise((resolveExit, reject) => {
    const onExit = (code, signal) => { clearTimeout(timer); resolveExit({ code, signal }) }
    const timer = setTimeout(() => {
      process.off('exit', onExit)
      reject(new Error('Process did not exit before the smoke-test deadline.'))
    }, timeout)
    process.once('exit', onExit)
  })
}

function makeReadOnly (directory) {
  if (!existsSync(directory) || process.platform === 'win32') return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) makeReadOnly(path)
    else chmodSync(path, entry.name === runtimeName ? 0o555 : 0o444)
  }
  chmodSync(directory, 0o555)
}

function makeWritable (directory) {
  if (!existsSync(directory) || process.platform === 'win32') return
  chmodSync(directory, 0o755)
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) makeWritable(path)
    else chmodSync(path, 0o644)
  }
}
