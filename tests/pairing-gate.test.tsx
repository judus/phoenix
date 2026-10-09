import { phoenixApiStub } from './support/phoenix-api-stub.js'
import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { PairingGate } from '../apps/web/src/bootstrap/pairing-gate.js'
import { createPhoenixApplication } from '../apps/web/src/bootstrap/create-application.js'
import { App } from '../apps/web/src/app.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('an idle authorized page returns to pairing after revocation and can pair again', async () => {
  vi.useFakeTimers()
  const getPairingStatus = vi.fn()
    .mockResolvedValueOnce({ authenticated: true })
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ authenticated: false })
  const claimPairing = vi.fn(async () => ({ authenticated: true, installationId: 'test', pairingRequired: true, serverDevice: false }))
  const api = { ...apiStub(claimPairing), getPairingStatus }
  const requirePairing = vi.fn()
  const renderer = await renderWithAct(<PairingGate api={api} onPairingRequired={requirePairing}><span>Protected content</span></PairingGate>)
  expect(renderer.root.findByType('span').children).toEqual(['Protected content'])
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(renderer.root.findByType('span').children).toEqual(['Protected content'])
  expect(requirePairing).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(renderer.root.findAllByType('span').some(node => node.children.includes('Protected content'))).toBe(false)
  expect(requirePairing).toHaveBeenCalledTimes(1)
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'NEW-CODE' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(claimPairing).toHaveBeenCalledWith('NEW-CODE')
  expect(renderer.root.findByType('span').children).toEqual(['Protected content'])
  await act(async () => renderer.unmount())
  expect(vi.getTimerCount()).toBe(0)
})

test('concurrent protected API failures redirect once through the application boundary', async () => {
  const browser = pairingBrowser('')
  const replace = vi.fn()
  browser.location.replace = replace
  const application = createPhoenixApplication(browser, { request: vi.fn(async () => new Response(JSON.stringify({
    error: { code: 'pairing_required', message: 'Pair this device with PHOENIX.' }
  }), { status: 401 })) })
  await Promise.allSettled([application.api.getHealth(), application.api.getRuntimeState()])
  expect(replace).toHaveBeenCalledExactlyOnceWith('/pairing')
})

test('unmount aborts a pending status check and ignores its late revocation response', async () => {
  vi.useFakeTimers()
  let completeCheck!: (value: { authenticated: boolean }) => void
  const getPairingStatus = vi.fn()
    .mockResolvedValueOnce({ authenticated: true })
    .mockImplementationOnce(() => new Promise(resolve => { completeCheck = resolve }))
  const requirePairing = vi.fn()
  const renderer = await renderWithAct(<PairingGate api={{ ...apiStub(vi.fn()), getPairingStatus }} onPairingRequired={requirePairing}><span>Protected</span></PairingGate>)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  const signal = getPairingStatus.mock.calls[1]![0] as AbortSignal
  expect(signal.aborted).toBe(false)
  await act(async () => renderer.unmount())
  expect(signal.aborted).toBe(true)
  await act(async () => completeCheck({ authenticated: false }))
  expect(requirePairing).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('PairingGate checks authorization and admits the application only after a successful claim', async () => {
  const claimPairing = vi.fn(async () => ({
    authenticated: true,
    installationId: 'test-installation',
    pairingRequired: true, serverDevice: false
  }))
  const api = apiStub(claimPairing)
  const renderer = await renderWithAct(<PairingGate api={api}><span>Authorized application</span></PairingGate>)

  const input = renderer?.root.findByType('input')
  expect(renderer?.root.findByProps({ className: 'pairing-logo' }).props).toMatchObject({
    src: '/phoenix.svg', alt: 'Phoenix'
  })
  const header = renderer.root.findByType('header')
  expect(header.findByType('h1').children).toEqual(['PHOENIX'])
  expect(header.findByType('img').props.alt).toBe('Phoenix')
  expect(header.findByType('p').parent).toBe(header)
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
  const renderer = await renderWithAct(<PairingGate api={api}><span>Authorized application</span></PairingGate>)

  expect(renderer?.root.findByProps({ className: 'pairing-qr' }).props).toMatchObject({
    alt: 'QR code for http://192.168.1.42:3400'
  })
  expect(renderer?.root.findByProps({ className: 'pairing-code' }).findByType('strong').children).toEqual(['ABCDE-12345'])

  await act(async () => renderer?.unmount())
})

test.each([
  ['#pair=ABCDE%2D12345', 'ABCDE-12345'],
  ['', ''],
  ['#/settings/help?topic=pairing', '']
])('application bootstrap passes the pairing code from %s through App mounting', async (hash, expectedCode) => {
  const browser = pairingBrowser(hash)
  const request = vi.fn(async () => new Response(JSON.stringify({
    authenticated: false, installationId: 'test-installation', pairingRequired: true, serverDevice: false
  }), { headers: { 'Content-Type': 'application/json' } }))
  const application = createPhoenixApplication(browser, { request })
  expect(browser.location.hash).not.toContain('pair=')
  const renderer = await renderWithAct(<App application={application} />)
  expect(renderer?.root.findByType('input').props.value).toBe(expectedCode)
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => renderer?.unmount())
})

test('a scanned code requires confirmation and remains editable after a failed claim', async () => {
  const claimPairing = vi.fn(async () => ({
    authenticated: true,
    installationId: 'test-installation',
    pairingRequired: true,
    serverDevice: false
  }))
  claimPairing.mockRejectedValueOnce(new Error('Pairing code expired.'))
  const renderer = await renderWithAct(<PairingGate api={apiStub(claimPairing)} initialCode="ABCDE-12345"><span>Authorized application</span></PairingGate>)

  expect(renderer?.root.findByType('input').props.value).toBe('ABCDE-12345')
  expect(claimPairing).not.toHaveBeenCalled()
  await act(async () => renderer?.root.findByType('form').props.onSubmit({ preventDefault() {} }))

  expect(claimPairing).toHaveBeenCalledWith('ABCDE-12345')
  expect(renderer?.root.findByType('input').props.value).toBe('ABCDE-12345')
  await act(async () => renderer?.root.findByType('input').props.onChange({ target: { value: 'fresh-54321' } }))
  await act(async () => renderer?.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(claimPairing).toHaveBeenLastCalledWith('FRESH-54321')
  expect(renderer?.root.findByType('span').children).toEqual(['Authorized application'])

  await act(async () => renderer?.unmount())
})

function pairingBrowser(hash: string): Window {
  const location = { hash }
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }
  }
  return {
    location,
    history: { replaceState: (_data: unknown, _unused: string, url: string) => { location.hash = url } },
    localStorage: storage,
    sessionStorage: storage,
    addEventListener() {},
    removeEventListener() {}
  } as unknown as Window
}

function apiStub(claimPairing: PhoenixApi['claimPairing']): PhoenixApi {
  return phoenixApiStub({
    claimPairing,
    eventStreamUrl() { return '/api/events' },
    async getHealth() { throw new Error('Not used.') },
    async getPairingStatus() {
      return { authenticated: false, installationId: 'test-installation', pairingRequired: true, serverDevice: false }
    },
    async getPairingInfo() { throw new Error('Not used.') },
    async getRuntimeState() { throw new Error('Not used.') }
  })
}
