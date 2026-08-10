import { PhoenixApplication } from './phoenix-application.js'

const application = new PhoenixApplication()

try {
  const address = await application.start()
  console.log(`PHOENIX server listening on http://${address.host}:${address.port}`)
} catch (error) {
  console.error('ERROR_PHOENIX_START_FAILED', error)
  process.exit(1)
}

async function shutdown (): Promise<void> {
  await application.stop()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

