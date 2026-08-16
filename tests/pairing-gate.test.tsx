import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { PairingGate } from '../apps/web/src/bootstrap/pairing-gate.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

test('PairingGate checks authorization and admits the application only after a successful claim', async () => {
  const claimPairing = vi.fn(async () => ({
    authenticated: true,
    installationId: 'test-installation',
    pairingRequired: true
  }))
  const api = apiStub(claimPairing)
  let renderer: ReactTestRenderer | undefined

  await act(async () => {
    renderer = create(<PairingGate api={api}><span>Authorized application</span></PairingGate>)
  })

  const input = renderer?.root.findByType('input')
  await act(async () => input?.props.onChange({ target: { value: 'abcde-12345' } }))
  const form = renderer?.root.findByType('form')
  await act(async () => form?.props.onSubmit({ preventDefault() {} }))

  expect(claimPairing).toHaveBeenCalledWith('ABCDE-12345')
  expect(renderer?.root.findByType('span').children).toEqual(['Authorized application'])

  await act(async () => renderer?.unmount())
})

function apiStub(claimPairing: PhoenixApi['claimPairing']): PhoenixApi {
  return {
    claimPairing,
    eventStreamUrl() { return '/api/events' },
    async getHealth() { throw new Error('Not used.') },
    async getPairingStatus() {
      return { authenticated: false, installationId: 'test-installation', pairingRequired: true }
    },
    async getRuntimeState() { throw new Error('Not used.') }
  }
}
