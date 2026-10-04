import { Variant, defineInterface, sessionBus } from 'dbus-native'

const itemPath = '/StatusNotifierItem'
const menuPath = '/MenuBar'
const watcherNames = ['org.kde.StatusNotifierWatcher', 'org.freedesktop.StatusNotifierWatcher']
const menuItems = [
  { id: 1, label: 'Open PHOENIX', action: 'open' },
  { id: 2, label: 'Pair device', action: 'pair' },
  { id: 3, label: 'Open logs', action: 'logs' },
  { id: 4, separator: true },
  { id: 5, label: 'Quit PHOENIX', action: 'quit' }
]

// Desktop integration owns its own connection, never the server or its input bus.
export async function createLinuxTray ({ actions, iconPath, onError, environment = process.env, busFactory = sessionBus }) {
  if (!environment.DBUS_SESSION_BUS_ADDRESS || environment.PHOENIX_DESKTOP_INTEGRATION === 'false') return null
  let bus
  let closed = false
  const report = error => { if (!closed) onError(`PHOENIX tray: ${error instanceof Error ? error.message : error}`) }
  const invoke = action => { void Promise.resolve().then(() => actions[action]()).catch(report) }
  const name = `org.kde.StatusNotifierItem-${process.pid}-1`
  let ownerEvent
  const ownerChanged = ([watcher, , owner]) => {
    if (!closed && owner && watcherNames.includes(watcher)) void register(watcher).catch(report)
  }
  async function register (watcher) {
    await bus.invoke({ destination: watcher, path: '/StatusNotifierWatcher', interface: watcher,
      member: 'RegisterStatusNotifierItem', signature: 's', body: [name] })
  }
  async function close () {
    if (closed) return
    closed = true
    bus?.signals.removeListener(ownerEvent, ownerChanged)
    // Closing this private connection releases its exports, names and match rules.
    await bus?.close().catch(report)
  }
  try {
    bus = busFactory({ busAddress: environment.DBUS_SESSION_BUS_ADDRESS, timeout: 3_000, variants: 'wrap' })
    ownerEvent = bus.mangle('/org/freedesktop/DBus', 'org.freedesktop.DBus', 'NameOwnerChanged')
    // A disappearing/broken desktop bus must not bring down the application.
    bus.connection.on('error', report)
    const ownership = await bus.ownName(name)
    if (!ownership.isPrimaryOwner) throw new Error('Tray service name is already in use.')
    for (const namespace of ['org.kde', 'org.freedesktop']) {
      await bus.export(itemPath, defineInterface({
        name: `${namespace}.StatusNotifierItem`,
        methods: {
          Activate: { in: { x: 'i', y: 'i' }, handler: () => invoke('open') },
          SecondaryActivate: { in: { x: 'i', y: 'i' }, handler: () => invoke('open') },
          ContextMenu: { in: { x: 'i', y: 'i' }, handler: () => {} },
          Scroll: { in: { delta: 'i', orientation: 's' }, handler: () => {} }
        },
        properties: {
          Category: property('s', 'ApplicationStatus'),
          Id: property('s', 'phoenix'),
          Title: property('s', 'PHOENIX'),
          Status: property('s', 'Active'),
          WindowId: property('u', 0),
          IconName: property('s', iconPath),
          IconPixmap: property('a(iiay)', []),
          OverlayIconName: property('s', ''),
          OverlayIconPixmap: property('a(iiay)', []),
          AttentionIconName: property('s', iconPath),
          AttentionIconPixmap: property('a(iiay)', []),
          AttentionMovieName: property('s', ''),
          ToolTip: property('(sa(iiay)ss)', [iconPath, [], 'PHOENIX', 'PHOENIX is running']),
          ItemIsMenu: property('b', false),
          Menu: property('o', menuPath)
        },
        signals: { NewTitle: {}, NewIcon: {}, NewAttentionIcon: {}, NewOverlayIcon: {}, NewToolTip: {},
          NewStatus: { args: { status: 's' } } }
      }))
    }
    const activate = (id, eventId) => {
      const item = menuItems.find(item => item.id === id)
      if (!item?.action) return false
      if (eventId === 'clicked') invoke(item.action)
      return true
    }
    await bus.export(menuPath, defineInterface({
      name: 'com.canonical.dbusmenu',
      methods: {
        GetLayout: {
          in: { parentId: 'i', recursionDepth: 'i', propertyNames: 'as' },
          out: { revision: 'u', layout: '(ia{sv}av)' },
          handler: ({ parentId, recursionDepth, propertyNames }) => ({ revision: 1,
            layout: parentId === 0
              ? [0, {}, recursionDepth === 0 ? [] : menuItems.map(item => new Variant('(ia{sv}av)', [item.id, menuProperties(item.id, propertyNames), []]))]
              : [parentId, menuProperties(parentId, propertyNames), []] })
        },
        GetGroupProperties: { in: { ids: 'ai', propertyNames: 'as' }, out: { properties: 'a(ia{sv})' },
          handler: ({ ids, propertyNames }) => menuItems.filter(item => ids.length === 0 || ids.includes(item.id))
            .map(item => [item.id, menuProperties(item.id, propertyNames)]) },
        GetProperty: { in: { id: 'i', name: 's' }, out: { value: 'v' },
          handler: ({ id, name }) => menuProperties(id, [name])[name] ?? new Variant('s', '') },
        Event: { in: { id: 'i', eventId: 's', data: 'v', timestamp: 'u' },
          handler: ({ id, eventId }) => { activate(id, eventId) } },
        EventGroup: { in: { events: 'a(isvu)' }, out: { idErrors: 'ai' },
          handler: ({ events }) => events.filter(([id, eventId]) => !activate(id, eventId)).map(([id]) => id) },
        AboutToShow: { in: { id: 'i' }, out: { needUpdate: 'b' }, handler: () => false },
        AboutToShowGroup: { in: { ids: 'ai' }, out: { updatesNeeded: 'ai', idErrors: 'ai' },
          handler: ({ ids }) => ({ updatesNeeded: [], idErrors: ids.filter(id => id !== 0 && !menuItems.some(item => item.id === id)) }) }
      },
      properties: { Version: property('u', 3), TextDirection: property('s', 'ltr'), Status: property('s', 'normal'), IconThemePath: property('as', []) },
      signals: { LayoutUpdated: { args: { revision: 'u', parent: 'i' } },
        ItemsPropertiesUpdated: { args: { updatedProperties: 'a(ia{sv})', removedProperties: 'a(ias)' } } }
    }))
    bus.signals.on(ownerEvent, ownerChanged)
    await bus.watch("type='signal',sender='org.freedesktop.DBus',interface='org.freedesktop.DBus',member='NameOwnerChanged'")
    const names = await bus.listNames()
    const hosts = watcherNames.filter(name => names.includes(name))
    if (hosts.length === 0) report('No tray host available; waiting for a StatusNotifier host.')
    for (const host of hosts) {
      try { await register(host); break } catch (error) { report(error) }
    }
    return { close }
  } catch (error) {
    report(error)
    await close()
    return null
  }
}

function property (type, value) { return { type, access: 'read', value } }

function menuProperties (id, names) {
  const item = menuItems.find(item => item.id === id)
  if (!item) return {}
  const values = item.separator ? { type: new Variant('s', 'separator') }
    : { label: new Variant('s', item.label), enabled: new Variant('b', true), visible: new Variant('b', true) }
  return names.length === 0 ? values : Object.fromEntries(Object.entries(values).filter(([key]) => names.includes(key)))
}
