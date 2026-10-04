import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { Variant, defineInterface, sessionBus } from 'dbus-native'

// Invoked under dbus-run-session: never registers with the user's real desktop.
const { createLinuxTray } = await import(process.argv[2]
  ? pathToFileURL(process.argv[2]).href : '../../scripts/package/linux-tray.mjs')
const host = sessionBus({ variants: 'wrap', timeout: 2_000 })
const client = sessionBus({ variants: 'wrap', timeout: 2_000 })
const registrations = []
const actions = []
const errors = []
let tray
try {
  await host.export('/StatusNotifierWatcher', defineInterface({
    name: 'org.kde.StatusNotifierWatcher',
    methods: { RegisterStatusNotifierItem: { in: { service: 's' }, handler: ({ service }) => { registrations.push(service) } } }
  }))
  // Start without a tray host; later activation and host restarts must register.
  tray = await createLinuxTray({ iconPath: '/tmp/PHOENIX icon.svg', environment: process.env,
    actions: Object.fromEntries(['open', 'pair', 'logs', 'quit'].map(action => [action, () => { actions.push(action) }])),
    onError: message => errors.push(message) })
  assert.ok(tray)
  assert.ok(errors.some(message => message.includes('No tray host')))
  let ownership = await host.ownName('org.kde.StatusNotifierWatcher')
  await until(() => registrations.length === 1)
  const destination = registrations[0]
  const call = (member, signature, body) => client.invoke({ destination, path: '/MenuBar',
    interface: 'com.canonical.dbusmenu', member, signature, body })
  const [revision, layout] = await call('GetLayout', 'iias', [0, -1, []])
  assert.equal(revision, 1)
  assert.deepEqual(layout[2].map(item => item.value[1].label?.value ?? 'separator'),
    ['Open PHOENIX', 'Pair device', 'Open logs', 'separator', 'Quit PHOENIX'])
  assert.equal((await call('GetLayout', 'iias', [0, 0, []]))[1][2].length, 0)
  const groups = await call('GetGroupProperties', 'aias', [[1, 5, 999], ['label']])
  assert.deepEqual(groups.map(([id, props]) => [id, Object.keys(props)]), [[1, ['label']], [5, ['label']]])
  assert.equal((await call('GetProperty', 'is', [2, 'label'])).value, 'Pair device')
  for (const name of ['org.kde.StatusNotifierItem', 'org.freedesktop.StatusNotifierItem']) {
    const props = await client.invoke({ destination, path: '/StatusNotifierItem', interface: 'org.freedesktop.DBus.Properties',
      member: 'GetAll', signature: 's', body: [name] })
    assert.equal(props.Id.value, 'phoenix')
    assert.equal(props.IconName.value, '/tmp/PHOENIX icon.svg')
  }
  await client.invoke({ destination, path: '/StatusNotifierItem', interface: 'org.kde.StatusNotifierItem', member: 'Activate', signature: 'ii', body: [0, 0] })
  for (const id of [2, 3, 5]) await call('Event', 'isvu', [id, 'clicked', new Variant('s', ''), 0])
  assert.deepEqual(actions, ['open', 'pair', 'logs', 'quit'])
  assert.deepEqual(await call('EventGroup', 'a(isvu)', [[[999, 'clicked', new Variant('s', ''), 0]]]), [999])
  assert.equal(await call('AboutToShow', 'i', [0]), false)
  await ownership.release()
  ownership = await host.ownName('org.kde.StatusNotifierWatcher')
  await until(() => registrations.length === 2)
  await tray.close()
  await tray.close()
  assert.ok(!(await client.listNames()).includes(destination))
  assert.equal(errors.length, 1)
  console.log('PHOENIX tray: branding, menu, actions, late host/restart and cleanup passed over D-Bus.')
} finally {
  await tray?.close()
  await client.close()
  await host.close()
}

async function until (predicate) {
  const deadline = Date.now() + 3_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Tray registration timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
