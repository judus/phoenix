import {
  NumpadExecuteRequestSchema,
  NumpadExecutionResultSchema,
  NumpadTreeNodeSchema,
  NumpadTreeSnapshotSchema,
  commandTargetKey,
  type CommandCatalogueSnapshot,
  type CommandDescriptor,
  type CommandRisk,
  type CommandTarget,
  type NumpadTreeNode,
  type NumpadTreeSnapshot
} from '@phoenix/contracts'
import type { CommandCatalogueSnapshots, Commands } from '../domain/commands.js'
import type { NumpadCommands } from '../domain/numpad.js'
import type { ControlGridLayoutRepository, SystemSettingsRepository } from '../domain/system-configuration.js'

interface MenuDefinition {
  id: string
  label: string
  selector: string
  destinations: Array<{ destinationId: string, selector: string }>
}

const CONTROL_SELECTORS: Readonly<Record<string, string>> = {
  ship: '1',
  combat: '2',
  navigation: '3',
  vessel: '4',
  srv: '5',
  on_foot: '6',
  radio: '7',
  emote: '8',
  misc: '9',
  macros: '0'
}

const INFORMATION_MENUS: readonly MenuDefinition[] = [
  menu('info.commander', 'Commander', '1', [
    destination('commander.overview', '1'), destination('commander.inventory', '2'), destination('commander.progress', '3')
  ]),
  menu('info.fleet', 'Fleet', '2', [
    destination('fleet.overview', '1'), destination('fleet.current', '2'), destination('fleet.current-loadout', '3'),
    destination('fleet.current-cargo', '4'), destination('fleet.carriers', '5'), destination('fleet.stored-modules', '6'),
    destination('fleet.catalogue', '7')
  ]),
  menu('info.galaxy', 'Galaxy', '3', [
    destination('galaxy.current-system', '1'), destination('galaxy.route', '2'), destination('galaxy.database', '3')
  ]),
  menu('info.operations', 'Operations', '4', [
    destination('operations.overview', '1'), destination('operations.missions', '2'),
    destination('operations.objectives', '3'), destination('operations.community-goals', '4'),
    destination('operations.powerplay', '5'), destination('operations.colonisation', '6')
  ]),
  menu('info.engineering', 'Engineering', '5', [
    destination('engineering.blueprints', '1'), destination('engineering.engineers', '2'),
    destination('engineering.materials-raw', '3'), destination('engineering.materials-manufactured', '4'),
    destination('engineering.materials-encoded', '5'), destination('engineering.materials-xeno', '6')
  ]),
  menu('info.comms', 'Comms', '6', [
    destination('comms.overview', '1'), destination('comms.inbox', '2'), destination('comms.traffic', '3'),
    destination('comms.contacts', '4'), destination('comms.galnet', '5'), destination('comms.radio', '6')
  ]),
  menu('info.records', 'Records', '7', [
    destination('records.journal', '1'), destination('records.exploration-ledger', '2'),
    destination('records.exploration-body', '3'), destination('records.exploration-biology', '4'),
    destination('records.exploration-geology', '5')
  ])
]

export class NumpadTreeProjector {
  public constructor (
    private readonly catalogues: CommandCatalogueSnapshots,
    private readonly layouts: ControlGridLayoutRepository
  ) {}

  public getSnapshot (): NumpadTreeSnapshot {
    const catalogue = this.catalogues.getSnapshot()
    const descriptors = new Map(catalogue.commands.map(command => [commandTargetKey(command.target), command]))
    const nodes: NumpadTreeNode[] = []
    const diagnostics: string[] = []

    const controls = branch(nodes, null, 'desktop.controls', '1', 'Controls')
    const information = branch(nodes, null, 'desktop.info', '2', 'Info')
    appendDestination(nodes, descriptors, null, '3', 'copilot.channel', diagnostics)

    this.appendControls(nodes, descriptors, controls, diagnostics)
    appendDestination(nodes, descriptors, information.id, '0', 'information.home', diagnostics)
    for (const definition of INFORMATION_MENUS) {
      const parent = branch(nodes, information.id, definition.id, definition.selector, definition.label)
      for (const entry of definition.destinations) {
        appendDestination(nodes, descriptors, parent.id, entry.selector, entry.destinationId, diagnostics)
      }
    }

    validateNodes(nodes, diagnostics)
    return NumpadTreeSnapshotSchema.parse({
      activationDigit: '0',
      diagnostics,
      generatedAt: catalogue.generatedAt,
      nodes,
      revision: catalogue.revision
    })
  }

  private appendControls (
    nodes: NumpadTreeNode[],
    descriptors: Map<string, CommandDescriptor>,
    controls: NumpadTreeNode,
    diagnostics: string[]
  ): void {
    for (const page of this.layouts.getLayout().pages) {
      const selector = CONTROL_SELECTORS[page.category]
      if (!selector) {
        diagnostics.push(`Control page ${page.id} has no numpad selector.`)
        continue
      }
      const parent = branch(nodes, controls.id, `controls.${page.id}`, selector, page.label, {
        columns: page.columns,
        rows: page.rows
      })
      for (const cell of page.cells) {
        if (!cell.target) continue
        const descriptor = descriptors.get(commandTargetKey(cell.target))
        if (!descriptor) {
          diagnostics.push(`Control cell ${page.id}:${cell.position} targets an unknown command.`)
          continue
        }
        leaf(nodes, parent.id, `controls.${page.id}.${cell.position}`, String(cell.position), descriptor, {
          position: cell.position,
          span: cell.span
        })
      }
    }

    const macros = [...descriptors.values()]
      .filter(descriptor => descriptor.kind === 'macro')
      .sort((left, right) => left.label.localeCompare(right.label))
    if (macros.length > 0) {
      const parent = branch(nodes, controls.id, 'controls.macros', CONTROL_SELECTORS.macros!, 'Macros')
      macros.forEach((descriptor, index) => {
        leaf(nodes, parent.id, `controls.macros.${descriptor.id}`, String(index + 1), descriptor)
      })
    }
  }
}

export class DefaultNumpadCommands implements NumpadCommands {
  public constructor (
    private readonly projector: NumpadTreeProjector,
    private readonly commands: Commands,
    private readonly settings: SystemSettingsRepository
  ) {}

  public getSnapshot (): NumpadTreeSnapshot { return this.projector.getSnapshot() }

  public async execute (candidate: unknown, signal?: AbortSignal) {
    const request = NumpadExecuteRequestSchema.parse(candidate)
    const snapshot = this.getSnapshot()
    if (snapshot.revision !== request.revision) {
      return NumpadExecutionResultSchema.parse({
        address: request.address,
        command: null,
        message: 'Command map updated. Restart numpad entry.',
        revision: snapshot.revision,
        status: 'stale'
      })
    }
    if (!this.settings.loadOrCreate().modules.numpadCommands.enabled) {
      return NumpadExecutionResultSchema.parse({
        address: request.address,
        command: null,
        message: 'Numpad command module is disabled.',
        revision: snapshot.revision,
        status: 'rejected'
      })
    }
    const node = snapshot.nodes.find(candidateNode => candidateNode.address === request.address)
    if (!node?.target || !node.available) {
      return NumpadExecutionResultSchema.parse({
        address: request.address,
        command: null,
        message: node?.unavailableReason ?? 'Numpad address is not executable.',
        revision: snapshot.revision,
        status: 'rejected'
      })
    }
    const command = await this.commands.execute({ target: node.target, operation: 'tap' }, 'numpad', signal)
    return NumpadExecutionResultSchema.parse({
      address: request.address,
      command,
      message: command.message,
      revision: snapshot.revision,
      status: command.status === 'accepted' || command.status === 'confirmed' || command.status === 'already_satisfied'
        ? 'accepted'
        : 'rejected'
    })
  }
}

function branch (
  nodes: NumpadTreeNode[],
  parentId: string | null,
  id: string,
  selector: string,
  label: string,
  layout: { columns?: number, rows?: number } = {}
): NumpadTreeNode {
  const node = NumpadTreeNodeSchema.parse({
    address: parentAddress(nodes, parentId) + selector,
    available: true,
    id,
    kind: 'menu',
    label,
    parentId,
    risk: 'safe',
    selector,
    target: null,
    ...layout
  })
  nodes.push(node)
  return node
}

function leaf (
  nodes: NumpadTreeNode[],
  parentId: string | null,
  id: string,
  selector: string,
  descriptor: CommandDescriptor,
  layout: { position?: number, span?: number } = {}
): void {
  nodes.push(NumpadTreeNodeSchema.parse({
    address: parentAddress(nodes, parentId) + selector,
    available: descriptor.available,
    category: descriptor.category,
    description: descriptor.description,
    id,
    kind: descriptor.kind,
    label: descriptor.label,
    parentId,
    risk: descriptor.risk,
    selector,
    target: descriptor.target,
    ...(descriptor.unavailableReason ? { unavailableReason: descriptor.unavailableReason } : {}),
    ...layout
  }))
}

function appendDestination (
  nodes: NumpadTreeNode[],
  descriptors: Map<string, CommandDescriptor>,
  parentId: string | null,
  selector: string,
  destinationId: string,
  diagnostics: string[]
): void {
  const descriptor = descriptors.get(commandTargetKey({ type: 'navigation', destinationId }))
  if (!descriptor) {
    diagnostics.push(`Navigation destination ${destinationId} is missing from the command catalogue.`)
    return
  }
  leaf(nodes, parentId, `navigation.${destinationId}`, selector, descriptor)
}

function parentAddress (nodes: readonly NumpadTreeNode[], parentId: string | null): string {
  if (parentId === null) return ''
  return nodes.find(node => node.id === parentId)?.address ?? ''
}

function validateNodes (nodes: readonly NumpadTreeNode[], diagnostics: string[]): void {
  const ids = new Set<string>()
  const addresses = new Set<string>()
  const selectors = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) diagnostics.push(`Duplicate numpad node id: ${node.id}.`)
    if (addresses.has(node.address)) diagnostics.push(`Duplicate numpad address: ${node.address}.`)
    const selectorKey = `${node.parentId ?? 'root'}:${node.selector}`
    if (selectors.has(selectorKey)) diagnostics.push(`Duplicate selector ${node.selector} below ${node.parentId ?? 'root'}.`)
    ids.add(node.id)
    addresses.add(node.address)
    selectors.add(selectorKey)
  }
}

function menu (
  id: string,
  label: string,
  selector: string,
  destinations: MenuDefinition['destinations']
): MenuDefinition {
  return { destinations, id, label, selector }
}

function destination (destinationId: string, selector: string) {
  return { destinationId, selector }
}
