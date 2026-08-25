import { PairingService } from 'control-deck/core'
import {
  FilePairingCredentialsRepository,
  NodePairingSecurity,
  PairingHttpController
} from 'control-deck/host'
import { networkInterfaces } from 'node:os'
import { isServerAddress } from './server-access-urls.js'

/** PHOENIX composition adapter for the shared Control Deck pairing host. */
export class PairingAccessController extends PairingHttpController {
  public constructor (credentialsFile: string) {
    super(
      new PairingService(
        new FilePairingCredentialsRepository(credentialsFile),
        new NodePairingSecurity()
      ),
      {
        cookieName: 'phoenix_session',
        isServerRequest: request => isServerAddress(request.socket.remoteAddress, networkInterfaces())
      }
    )
  }
}
