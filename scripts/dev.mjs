import { spawn } from 'node:child_process'

const children = []
let stopping = false

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

startChild('dev:server')
await waitForServer()

if (!stopping) startChild('dev:web')

function startChild (script) {
  const child = spawn('npm', ['run', script], { stdio: 'inherit' })
  children.push(child)
  child.on('exit', code => {
    if (!stopping && code !== 0) {
      process.exitCode = code ?? 1
      stop()
    }
  })
  return child
}

async function waitForServer () {
  const deadline = Date.now() + 30_000
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:3400/api/health')
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!stopping) {
    process.exitCode = 1
    stop()
    throw new Error('PHOENIX server did not become ready within 30 seconds.')
  }
}

function stop (signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}
