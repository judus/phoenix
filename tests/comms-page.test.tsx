import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { CommunicationsResponse, GalnetNewsResponse } from '@phoenix/contracts'
import { CommsPage } from '../apps/web/src/features/comms/comms-page.js'
import { commsNavigationItems } from '../apps/web/src/features/comms/comms-navigation.js'

const execute = async () => ({ actionId: 'test', message: 'accepted', operation: 'tap' as const, status: 'accepted' as const })

test('Comms exposes its typed section navigation', () => {
  expect(commsNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Overview', '#/comms/overview'], ['Inbox', '#/comms/inbox'], ['Traffic', '#/comms/traffic'],
    ['Contacts', '#/comms/contacts'], ['GalNet', '#/comms/galnet'], ['Radio', '#/comms/radio']
  ])
})

test('Traffic renders retained provenance and selected message detail', () => {
  const markup = renderToStaticMarkup(<CommsPage controller={{ communications: communications(), status: 'ready' }} onExecuteAction={execute} view="traffic" />)
  expect(markup).toContain('Local traffic')
  expect(markup).toContain('Locke Terminal')
  expect(markup).toContain('Docking request granted')
  expect(markup).toContain('ReceiveText')
  expect(markup).toContain('Raw Frontier message')
})

test('Contacts explicitly describe observation rather than presence', () => {
  const markup = renderToStaticMarkup(<CommsPage controller={{ communications: communications(), status: 'ready' }} onExecuteAction={execute} view="contacts" />)
  expect(markup).toContain('Observed commanders')
  expect(markup).toContain('Last-seen evidence only')
  expect(markup).toContain('<dt>Presence</dt><dd>Unknown</dd>')
})

test('GalNet composes the cached article index and reader', () => {
  const news: GalnetNewsResponse = {
    articles: [{ body: 'First paragraph.\nSecond paragraph.', id: 'article-1', image: null, publishedAt: '2026-08-16T12:00:00.000Z', title: 'Pilots gather at Colonia' }],
    cache: 'stale', fetchedAt: '2026-08-16T13:00:00.000Z'
  }
  const markup = renderToStaticMarkup(<CommsPage controller={{ galnet: news, status: 'ready' }} onExecuteAction={execute} view="galnet" />)
  expect(markup).toContain('stale feed')
  expect(markup).toContain('Pilots gather at Colonia')
  expect(markup).toContain('First paragraph')
  expect(markup).toContain('Second paragraph')
})

test('GalNet Radio preserves the accepted previous, stop, play, next control order', () => {
  const markup = renderToStaticMarkup(<CommsPage controller={{ actions: { actions: [] }, status: 'ready' }} onExecuteAction={execute} view="radio" />)
  expect(markup).toContain('GalNet Radio')
  const labels = ['Previous', 'Stop', 'Play', 'Next'].map(label => markup.indexOf(`aria-label="${label}"`))
  expect(labels.every(index => index >= 0)).toBe(true)
  expect(labels).toEqual([...labels].sort((left, right) => left - right))
})

function communications(): CommunicationsResponse {
  return {
    contacts: [{ channels: ['npc'], id: 'contact-1', inboundCount: 1, lastMessage: 'Docking request granted.', lastSeenAt: '2026-08-16T12:00:00.000Z', name: 'Locke Terminal', outboundCount: 0 }],
    messages: [{ channel: 'npc', direction: 'inbound', id: 'message-1', message: 'Docking request granted.', rawMessage: '$DockingRequestGranted;', rawSender: 'Locke Terminal', recipient: null, sender: 'Locke Terminal', senderKind: 'npc', sourceEvent: 'ReceiveText', timestamp: '2026-08-16T12:00:00.000Z', view: 'traffic' }],
    summary: { inbound: 1, inbox: 0, outbound: 0, total: 1, traffic: 1 },
    view: 'all'
  }
}
