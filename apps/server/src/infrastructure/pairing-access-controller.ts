import { PairingService } from 'control-deck/core'
import {
  FilePairingCredentialsRepository,
  NodePairingSecurity,
  PairingHttpController
} from 'control-deck/host'
import { networkInterfaces } from 'node:os'
import { clientAddressBehindLocalProxy, isServerAddress } from './server-access-urls.js'

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
        isServerRequest: request => {
          // The opt-in Android TLS listener is always a paired-device transport,
          // including when an emulator connects from this computer.
          if ('encrypted' in request.socket && request.socket.encrypted === true) return false
          const interfaces = networkInterfaces()
          const clientAddress = clientAddressBehindLocalProxy(
            request.socket.remoteAddress,
            request.headers['x-forwarded-for'],
            interfaces
          )
          return isServerAddress(clientAddress, interfaces)
        }
      }
    )
  }
}
