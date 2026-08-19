import type {
  PairingCredentials,
  PairingCredentialsRepository,
  PairingSecurity
} from '@jdu/control-deck-core'
import { PairingAttemptLimitError, PairingService } from '@jdu/control-deck-core'
import { expect, test } from 'vitest'

class MemoryRepository implements PairingCredentialsRepository {
  public value: PairingCredentials | null = null

  public load (): unknown | null {
    return this.value
  }

  public save (credentials: PairingCredentials): void {
    this.value = structuredClone(credentials)
  }
}

class DeterministicSecurity implements PairingSecurity {
  private sequence = 0

  public createId (): string { return `id-${++this.sequence}` }
  public createPairingCode (): string { return 'ABCDE-23456' }
  public createSecret (): string { return 's'.repeat(32) }
  public createSessionToken (): string { return `token-${++this.sequence}` }
  public equals (left: string, right: string): boolean { return left === right }
  public hash (secret: string, value: string): string { return `${secret}:${value}` }
}

test('pairing policy creates, persists, authorizes, and revokes independent sessions', () => {
  const repository = new MemoryRepository()
  const service = new PairingService(repository, new DeterministicSecurity(), { now: () => 1_000 })

  expect(service.status()).toMatchObject({ authenticated: false, pairingRequired: true })
  const first = service.claim('abcde 23456')
  const second = service.claim('ABCDE-23456')
  expect(first).not.toBeNull()
  expect(second).not.toBe(first)
  expect(service.isAuthorized({ sessionToken: first! })).toBe(true)
  expect(service.authorize({ sessionToken: first! })).toMatchObject({ type: 'session', id: expect.any(String) })
  expect(service.isAuthorized({ bearerToken: service.bearerToken })).toBe(true)
  expect(service.release(first!)).toBe(true)
  expect(service.isAuthorized({ sessionToken: first! })).toBe(false)
  expect(service.isAuthorized({ sessionToken: second! })).toBe(true)
  expect(repository.value?.sessions).toHaveLength(1)
})

test('pairing policy rate limits repeated invalid claims', () => {
  const service = new PairingService(new MemoryRepository(), new DeterministicSecurity(), { now: () => 1_000 })
  for (let attempt = 0; attempt < 10; attempt++) expect(service.claim('wrong')).toBeNull()
  expect(() => service.claim('wrong')).toThrow(PairingAttemptLimitError)
})
