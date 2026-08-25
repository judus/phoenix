import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { PairingGate } from '../apps/web/src/bootstrap/pairing-gate.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => vi.unstubAllGlobals())

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

test('the server device shows a scannable LAN pairing link and code', async () => {
  const api = {
    ...apiStub(vi.fn()),
    async getPairingStatus() {
      return { authenticated: false, installationId: 'test-installation', pairingRequired: true, serverDevice: true }
    },
    async getPairingInfo() {
      return {
        access: [{
          pairingUrl: 'http://192.168.1.42:3400/#pair=ABCDE-12345',
          qrDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          url: 'http://192.168.1.42:3400'
        }],
        installationId: 'test-installation',
        pairingCode: 'ABCDE-12345',
        serverDevice: true as const
      }
    }
  }
  let renderer: ReactTestRenderer | undefined

  await act(async () => {
    renderer = create(<PairingGate api={api}><span>Authorized application</span></PairingGate>)
  })

  expect(renderer?.root.findByProps({ className: 'pairing-qr' }).props).toMatchObject({
    alt: 'QR code for http://192.168.1.42:3400'
  })
  expect(renderer?.root.findByProps({ className: 'pairing-code' }).findByType('strong').children).toEqual(['ABCDE-12345'])

  await act(async () => renderer?.unmount())
})

test('a scanned pairing fragment pre-fills the code and is removed after confirmation', async () => {
  const replaceState = vi.fn()
  vi.stubGlobal('location', { hash: '#pair=ABCDE-12345', pathname: '/', search: '' })
  vi.stubGlobal('history', { replaceState })
  const claimPairing = vi.fn(async () => ({
    authenticated: true,
    installationId: 'test-installation',
    pairingRequired: true,
    serverDevice: false
  }))
  let renderer: ReactTestRenderer | undefined

  await act(async () => {
    renderer = create(<PairingGate api={apiStub(claimPairing)}><span>Authorized application</span></PairingGate>)
  })

  expect(renderer?.root.findByType('input').props.value).toBe('ABCDE-12345')
  await act(async () => renderer?.root.findByType('form').props.onSubmit({ preventDefault() {} }))

  expect(claimPairing).toHaveBeenCalledWith('ABCDE-12345')
  expect(replaceState).toHaveBeenCalledWith(null, '', '/')

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
    async getPairingInfo() { throw new Error('Not used.') },
    async getRuntimeState() { throw new Error('Not used.') }
  }
}
