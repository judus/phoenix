import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'

const roots: string[] = []
const children: ChildProcess[] = []

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await exit(child)
    }
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

// The PHOENIX Windows tray launcher is exercised by the native installer smoke test.
test.skipIf(process.platform === 'win32')('launcher does not mistake another HTTP service for its own server', async () => {
  const server = createServer((_request, response) => { response.writeHead(200); response.end('{}') })
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing fixture port')
    const fixture = installation('setTimeout(() => process.exit(1), 400)')
    const launcher = launch(fixture, address.port)
    expect(await exit(launcher)).toBe(1)
    const log = readFileSync(join(fixture.state, 'phoenix/logs/phoenix.log'), 'utf8')
    expect(log).not.toContain('PHOENIX is ready')
    expect(log).toContain('did not become healthy')
  } finally {
    await new Promise<void>(resolveClose => server.close(() => resolveClose()))
  }
})

test.skipIf(process.platform === 'win32').each(['127.0.0.1', 'localhost'])('launcher accepts %s readiness from its spawned process and supports clean stop', async advertisedHost => {
  const fixture = installation(`
    import { createServer } from 'node:http'
    import { writeFileSync, unlinkSync } from 'node:fs'
    const port = Number(process.env.PHOENIX_PORT)
    const server = createServer((_request, response) => { response.writeHead(200); response.end('{}') })
    server.listen(port, '127.0.0.1', () => writeFileSync(process.env.PHOENIX_RUNTIME_STATUS_PATH,
      'PHOENIX READY\\nProcess: ' + process.pid + '\\nThis computer: http://${advertisedHost}:' + port))
    process.stdin.resume()
    process.stdin.on('end', () => {
      unlinkSync(process.env.PHOENIX_RUNTIME_STATUS_PATH)
      server.close(() => process.exit(0))
    })
  `)
  const reservation = createServer()
  await new Promise<void>(resolveListen => reservation.listen(0, '127.0.0.1', resolveListen))
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  await new Promise<void>(resolveClose => reservation.close(() => resolveClose()))
  const launcher = launch(fixture, address.port)
  const logPath = join(fixture.state, 'phoenix/logs/phoenix.log')
  await waitUntil(() => {
    try { return readFileSync(logPath, 'utf8').includes('PHOENIX is ready') } catch { return false }
  })
  const stopper = launch(fixture, address.port, ['--stop'])
  expect(await exit(stopper)).toBe(0)
  expect(await exit(launcher)).toBe(0)
  expect(readFileSync(logPath, 'utf8')).toContain('PHOENIX stopped cleanly')
})

test.skipIf(process.platform === 'win32').each(['wrong-port', 'foreign-host', 'wrong-pid'])('launcher rejects %s readiness despite a healthy HTTP listener', async mismatch => {
  const fixture = installation(`
    import { createServer } from 'node:http'
    import { writeFileSync } from 'node:fs'
    const port = Number(process.env.PHOENIX_PORT)
    const server = createServer((_request, response) => { response.writeHead(200); response.end('{}') })
    server.listen(port, '127.0.0.1', () => {
      const pid = ${mismatch === 'wrong-pid' ? 'process.pid + 1' : 'process.pid'}
      const advertisedPort = ${mismatch === 'wrong-port' ? 'port === 65535 ? 65534 : port + 1' : 'port'}
      writeFileSync(process.env.PHOENIX_RUNTIME_STATUS_PATH,
        'PHOENIX READY\\nProcess: ' + pid + '\\nThis computer: http://${mismatch === 'foreign-host' ? 'provider.invalid' : 'localhost'}:' + advertisedPort)
      setTimeout(() => process.exit(1), 400)
    })
  `)
  const reservation = createServer()
  await new Promise<void>(resolveListen => reservation.listen(0, '127.0.0.1', resolveListen))
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  await new Promise<void>(resolveClose => reservation.close(() => resolveClose()))
  expect(await exit(launch(fixture, address.port))).toBe(1)
  expect(readFileSync(join(fixture.state, 'phoenix/logs/phoenix.log'), 'utf8')).not.toContain('PHOENIX is ready')
})

test.skipIf(process.platform !== 'linux').each([0, 1])('failed startup displays a desktop error (notification exit %s)', async notificationExit => {
  const fixture = installation('process.exit(1)')
  const bin = join(fixture.root, 'bin')
  mkdirSync(bin)
  for (const command of ['notify-send', 'xdg-open']) {
    writeFileSync(join(bin, command), `#!${process.execPath}
import { appendFileSync, existsSync } from 'node:fs'
appendFileSync(${JSON.stringify(join(fixture.root, 'desktop.jsonl'))}, JSON.stringify({
  command: ${JSON.stringify(command)}, args: process.argv.slice(2),
  locked: existsSync(${JSON.stringify(join(fixture.state, 'phoenix/logs/launcher.lock'))})
}) + '\\n')
process.exit(${command === 'notify-send' ? notificationExit : 0})
`, { mode: 0o755 })
  }
  const launcher = launch(fixture, 34001, [], { PATH: bin, DISPLAY: ':fixture' })
  expect(await exit(launcher)).toBe(1)
  const calls = readFileSync(join(fixture.root, 'desktop.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
  expect(calls.map(call => call.command)).toEqual(notificationExit === 0 ? ['notify-send'] : ['notify-send', 'xdg-open'])
  expect(calls.every(call => call.locked === false)).toBe(true)
  expect(calls[0].args).toContain('PHOENIX could not start or stopped unexpectedly')
  expect(calls[0].args.at(-1)).toContain('phoenix.log')
  if (notificationExit !== 0) expect(calls[1].args).toEqual([join(fixture.state, 'phoenix/logs/phoenix.log')])
})

test.skipIf(process.platform !== 'linux').each(['headless', 'non-interactive'])('startup failure stays non-interactive for %s launch', async mode => {
  const fixture = installation('process.exit(1)')
  const bin = join(fixture.root, 'bin')
  mkdirSync(bin)
  for (const command of ['notify-send', 'xdg-open']) {
    writeFileSync(join(bin, command), `#!${process.execPath}\nimport { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(join(fixture.root, 'unexpected'))}, '')`, { mode: 0o755 })
  }
  const launcher = launch(fixture, 34001, mode === 'non-interactive' ? ['--non-interactive'] : [], {
    PATH: bin, DISPLAY: mode === 'headless' ? '' : ':fixture', WAYLAND_DISPLAY: ''
  })
  expect(await exit(launcher)).toBe(1)
  expect(existsSync(join(fixture.root, 'unexpected'))).toBe(false)
})

function installation (serverCode: string) {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-launcher-test-'))
  roots.push(root)
  for (const path of ['scripts/package', 'runtime', 'apps/server/dist']) mkdirSync(join(root, path), { recursive: true })
  copyFileSync(resolve('scripts/package/launcher.mjs'), join(root, 'scripts/package/launcher.mjs'))
  symlinkSync(process.execPath, join(root, 'runtime/node'))
  writeFileSync(join(root, 'apps/server/dist/main.js'), serverCode)
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  return { root, state: join(root, 'state') }
}

function launch (fixture: ReturnType<typeof installation>, port: number, args: string[] = ['--non-interactive'], environment: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [join(fixture.root, 'scripts/package/launcher.mjs'), ...args], {
    env: { ...process.env, XDG_STATE_HOME: fixture.state, PHOENIX_PORT: String(port), PHOENIX_LAUNCHER_OPEN_BROWSER: 'false', ...environment },
    stdio: 'ignore'
  })
  children.push(child)
  return child
}

async function exit (child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode
  return new Promise((resolveExit, reject) => {
    const onExit = (code: number | null) => { clearTimeout(timer); resolveExit(code) }
    const timer = setTimeout(() => { child.off('exit', onExit); reject(new Error('Launcher test timed out')) }, 8_000)
    child.once('exit', onExit)
  })
}

async function waitUntil (ready: () => boolean) {
  const deadline = Date.now() + 5_000
  while (!ready()) {
    if (Date.now() >= deadline) throw new Error('Launcher did not become ready')
    await new Promise(resolveDelay => setTimeout(resolveDelay, 20))
  }
}
