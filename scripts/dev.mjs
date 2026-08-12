import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const children = []
let stopping = false
const serverPort = Number(process.env.PHOENIX_PORT ?? 3400)
const webPort = 3401

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

await assertPortAvailable(serverPort, 'PHOENIX server')
await assertPortAvailable(webPort, 'Vite web server')
startChild('dev:server')
await waitForServer()

if (!stopping) startChild('dev:web')

function startChild (script) {
  const child = spawn('npm', ['run', script], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'inherit', 'inherit']
  })
  children.push(child)
  child.on('error', cause => {
    if (!stopping) {
      console.error(`Failed to start npm run ${script}:`, cause)
      process.exitCode = 1
      stop()
    }
  })
  child.on('exit', code => {
    if (!stopping && code !== 0) {
      process.exitCode = code ?? 1
      stop()
    }
  })
  return child
}

async function waitForServer () {
  const deadline = Date.now() + 120_000
  console.log(`Waiting for PHOENIX server on port ${serverPort}…`)
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/pairing/status`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!stopping) {
    process.exitCode = 1
    stop()
    throw new Error('PHOENIX server did not become ready within 120 seconds.')
  }
}

function stop (signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) {
    stopChildTree(child, signal)
  }
}

function stopChildTree (child, signal) {
  if (child.killed || child.pid === undefined) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    } else {
      process.kill(-child.pid, signal)
    }
  } catch (cause) {
    if (cause?.code !== 'ESRCH') console.error(`Failed to stop child process ${child.pid}:`, cause)
  }
}

async function assertPortAvailable (port, label) {
  await new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.once('error', cause => {
      reject(cause?.code === 'EADDRINUSE'
        ? new Error(`${label} port ${port} is already in use. Stop the existing process before running npm run dev.`)
        : cause)
    })
    probe.listen(port, '0.0.0.0', () => probe.close(resolve))
  })
}
