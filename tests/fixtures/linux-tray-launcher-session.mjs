import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Variant, defineInterface, sessionBus } from 'dbus-native'

// This fixture runs the real AppImage under a PRIVATE D-Bus session and user roots.
const image = process.argv[2]
if (!image) throw new Error('An absolute AppImage path is required.')
const root = mkdtempSync(join(tmpdir(), 'phoenix tray launcher-'))
const bus = sessionBus({ timeout: 3_000, variants: 'wrap' })
let child
let destination
let registrations = 0
const output = []
try {
  await bus.ownName('org.kde.StatusNotifierWatcher')
  await bus.export('/StatusNotifierWatcher', defineInterface({
    name: 'org.kde.StatusNotifierWatcher',
    methods: { RegisterStatusNotifierItem: { in: { service: 's' }, handler: ({ service }) => { destination = service; registrations++ } } }
  }))
  const reservation = createServer()
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const bin = join(root, 'bin')
  const elite = join(root, 'empty-elite')
  mkdirSync(bin)
  mkdirSync(elite)
  const opensPath = join(root, 'opens.jsonl')
  writeFileSync(join(bin, 'xdg-open'), `#!${process.execPath}\nimport { appendFileSync } from 'node:fs'; appendFileSync(${JSON.stringify(opensPath)}, JSON.stringify(process.argv.slice(2)) + '\\n')`, { mode: 0o755 })
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PHOENIX_') && !key.startsWith('OPENAI_'))),
    PATH: `${bin}:${process.env.PATH}`, PHOENIX_PORT: String(port), PHOENIX_HOST: '127.0.0.1',
    PHOENIX_CATALOGUE_REFRESH: 'false', PHOENIX_LAUNCHER_OPEN_BROWSER: 'false',
    PHOENIX_INPUT_BACKEND: 'recording', PHOENIX_ELITE_DIRECTORY: elite, PHOENIX_ELITE_BINDINGS_DIRECTORY: elite,
    PHOENIX_OPENAI_API_KEY: 'sk-phoenix-test-not-a-key',
    XDG_STATE_HOME: join(root, 'state'), XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'), XDG_CACHE_HOME: join(root, 'cache')
  }
  child = spawn(image, [], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', data => output.push(data.toString()))
  child.stderr.on('data', data => output.push(data.toString()))
  await until(() => destination || child.exitCode !== null)
  assert.ok(destination, `AppImage failed before tray registration: ${output.join('')}`)
  const duplicate = spawn(image, [], { env, stdio: 'ignore' })
  assert.equal(await exit(duplicate), 0)
  assert.equal(registrations, 1)
  const click = id => bus.invoke({ destination, path: '/MenuBar', interface: 'com.canonical.dbusmenu',
    member: 'Event', signature: 'isvu', body: [id, 'clicked', new Variant('s', ''), 0] })
  for (const id of [1, 2, 3]) await click(id)
  await until(() => existsSync(opensPath) && readFileSync(opensPath, 'utf8').trim().split('\n').length === 3)
  const opened = readFileSync(opensPath, 'utf8').trim().split('\n').map(line => JSON.parse(line)[0]).sort()
  const log = join(root, 'state/phoenix/logs/phoenix.log')
  assert.deepEqual(opened, [`http://127.0.0.1:${port}`, `http://127.0.0.1:${port}/#/settings/pairing`, pathToFileURL(log).href].sort())
  await click(5)
  assert.equal(await exit(child), 0)
  assert.ok(readFileSync(log, 'utf8').includes('PHOENIX stopped cleanly.'))
  assert.equal(existsSync(join(root, 'state/phoenix/logs/launcher.lock')), false)
  assert.ok(!(await bus.listNames()).includes(destination))
  console.log('AppImage tray: single instance, Open/Pair/Logs targets and clean Quit passed.')
} finally {
  if (child && child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exit(child) }
  await bus.close()
  rmSync(root, { recursive: true, force: true })
}

async function until (predicate) {
  const deadline = Date.now() + 20_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Tray launcher timed out: ${output.join('')}`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

async function exit (process) {
  if (process.exitCode !== null || process.signalCode !== null) return process.exitCode
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { process.kill('SIGKILL'); reject(new Error('Launcher failed to exit')) }, 8_000)
    process.once('error', error => { clearTimeout(timer); reject(error) })
    process.once('exit', code => { clearTimeout(timer); resolve(code) })
  })
}
