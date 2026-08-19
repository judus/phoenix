import { resolve } from 'node:path'
import { ControlDeckApplication } from './control-deck-application.js'

const application = new ControlDeckApplication({
  dataDirectory: resolve(process.cwd(), 'data/control-deck'),
  host: process.env.CONTROL_DECK_HOST ?? '0.0.0.0',
  port: Number(process.env.CONTROL_DECK_PORT ?? 3410)
})

const address = await application.start()
console.log(`Control Deck listening on http://${address.host}:${address.port}`)
console.log(`Control Deck pairing code: ${application.pairing.pairingCode}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void application.stop().finally(() => process.exit(0))
  })
}
