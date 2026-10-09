// Preloaded only by the diagnostic failure test; run real cleanup before injecting the error.
import { PhoenixApplication } from '../../apps/server/src/phoenix-application.ts'

const stop = PhoenixApplication.prototype.stop
PhoenixApplication.prototype.stop = async function () {
  await stop.call(this)
  throw new Error('Fixture cleanup failure')
}
