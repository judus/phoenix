import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { PairingSecurity } from '@jdu/control-deck-core'

export class NodePairingSecurity implements PairingSecurity {
  public createId (): string {
    return randomUUID()
  }

  public createPairingCode (): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const characters = [...randomBytes(10)].map(byte => alphabet[byte % alphabet.length]).join('')
    return `${characters.slice(0, 5)}-${characters.slice(5)}`
  }

  public createSecret (): string {
    return randomBytes(32).toString('base64url')
  }

  public createSessionToken (): string {
    return randomBytes(32).toString('base64url')
  }

  public equals (left: string, right: string): boolean {
    const leftBytes = Buffer.from(left)
    const rightBytes = Buffer.from(right)
    return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  }

  public hash (secret: string, value: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url')
  }
}
