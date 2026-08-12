import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const payloadRoot = resolve(projectRoot, 'dist/payload', `${process.platform}-${process.arch}`)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'phoenix-payload-smoke-'))
const installRoot = resolve(temporaryRoot, 'installation')
const userRoot = resolve(temporaryRoot, 'user')
const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node'
let child

try {
  cpSync(payloadRoot, installRoot, { recursive: true })
  makeReadOnly(installRoot)
  const port = await availablePort()
  child = spawn(resolve(installRoot, 'runtime', runtimeName), [
    resolve(installRoot, 'apps/server/dist/main.js')
  ], {
    cwd: installRoot,
    env: {
      ...process.env,
      HOME: resolve(userRoot, 'home'),
      PHOENIX_CATALOGUE_REFRESH: 'false',
      PHOENIX_HOST: '127.0.0.1',
      PHOENIX_PATH_MODE: 'installed',
      PHOENIX_PORT: String(port),
      XDG_CACHE_HOME: resolve(userRoot, 'cache'),
      XDG_CONFIG_HOME: resolve(userRoot, 'config'),
      XDG_DATA_HOME: resolve(userRoot, 'data'),
      XDG_STATE_HOME: resolve(userRoot, 'state')
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const output = []
  child.stdout.on('data', chunk => output.push(chunk.toString()))
  child.stderr.on('data', chunk => output.push(chunk.toString()))
  const response = await waitForServer(`http://127.0.0.1:${port}/api/pairing/status`, child, output)
  if (response.status !== 200) throw new Error(`Payload health probe returned ${response.status}.`)

  for (const required of [
    resolve(userRoot, 'config/phoenix/pairing.json'),
    resolve(userRoot, 'config/phoenix/settings.json'),
    resolve(userRoot, 'data/phoenix/runtime/phoenix.sqlite'),
    resolve(userRoot, 'data/phoenix/runtime/system.json')
  ]) {
    if (!existsSync(required)) throw new Error(`Payload did not create expected user state: ${required}`)
  }

  JSON.parse(readFileSync(resolve(userRoot, 'config/phoenix/pairing.json'), 'utf8'))
  console.log('PHOENIX payload smoke test passed: read-only installation, isolated writable user state.')
} finally {
  if (child !== undefined && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise(resolveExit => child.once('exit', resolveExit)),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 2_000))
    ])
  }
  makeWritable(installRoot)
  rmSync(temporaryRoot, { recursive: true, force: true })
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
      return await fetch(url)
    } catch {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 100))
    }
  }
  throw new Error(`Payload did not become ready.\n${output.join('')}`)
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
