import type {
  CartographicBody,
  CartographicStation,
  CartographicSystem
} from '@phoenix/contracts'

export type InstallationParentSource = 'explicit' | 'distance'

export interface AttachedInstallation {
  source: InstallationParentSource
  station: CartographicStation
}

export interface BodyHierarchyNode {
  body: CartographicBody
  children: BodyHierarchyNode[]
  installations: AttachedInstallation[]
}

export interface SystemHierarchy {
  roots: BodyHierarchyNode[]
  unassignedInstallations: CartographicStation[]
}

export function buildSystemHierarchy (system: CartographicSystem): SystemHierarchy {
  const nodes = new Map(system.bodies.map(body => [body, createNode(body)]))
  const byBodyId = new Map<number, BodyHierarchyNode>()
  for (const node of nodes.values()) {
    if (node.body.bodyId != null) byBodyId.set(node.body.bodyId, node)
  }

  const roots: BodyHierarchyNode[] = []
  for (const node of nodes.values()) {
    const parent = directParent(node.body, byBodyId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  sortHierarchy(roots)

  const unassignedInstallations: CartographicStation[] = []
  for (const station of system.stations) {
    const placement = explicitParent(station, nodes)
    const parent = placement ?? nearestBody(station, nodes)
    if (!parent) {
      unassignedInstallations.push(station)
      continue
    }
    parent.node.installations.push({ station, source: parent.source })
  }

  for (const node of nodes.values()) {
    node.installations.sort((left, right) => compareStations(left.station, right.station))
  }
  unassignedInstallations.sort(compareStations)
  return { roots, unassignedInstallations }
}

function createNode (body: CartographicBody): BodyHierarchyNode {
  return { body, children: [], installations: [] }
}

function directParent (
  body: CartographicBody,
  byBodyId: Map<number, BodyHierarchyNode>
): BodyHierarchyNode | undefined {
  for (const parent of body.parents) {
    for (const type of ['Planet', 'Star']) {
      const bodyId = parent[type] ?? parent[type.toLocaleLowerCase()]
      if (typeof bodyId !== 'number' || bodyId === body.bodyId) continue
      const node = byBodyId.get(bodyId)
      if (node) return node
    }
  }
}

function explicitParent (
  station: CartographicStation,
  nodes: Map<CartographicBody, BodyHierarchyNode>
): { node: BodyHierarchyNode, source: InstallationParentSource } | undefined {
  const rawBody = recordValue(station.raw.body)
  const id = integerValue(rawBody?.id ?? station.raw.bodyId)
  const bodyId = integerValue(rawBody?.bodyId)
  const name = stringValue(rawBody?.name ?? station.raw.bodyName)
  for (const [body, node] of nodes) {
    if ((id != null && (body.id === id || body.bodyId === id)) ||
      (bodyId != null && body.bodyId === bodyId) ||
      (name != null && body.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return { node, source: 'explicit' }
    }
  }
}

function nearestBody (
  station: CartographicStation,
  nodes: Map<CartographicBody, BodyHierarchyNode>
): { node: BodyHierarchyNode, source: InstallationParentSource } | undefined {
  if (station.distanceToArrival == null) {
    const node = [...nodes.values()].sort(compareNodes)[0]
    return node ? { node, source: 'distance' } : undefined
  }
  const candidates = [...nodes.values()].filter(node => node.body.distanceToArrival != null)
  candidates.sort((left, right) => {
    const leftDelta = Math.abs(station.distanceToArrival! - left.body.distanceToArrival!)
    const rightDelta = Math.abs(station.distanceToArrival! - right.body.distanceToArrival!)
    return leftDelta - rightDelta || compareNodes(left, right)
  })
  return candidates[0] ? { node: candidates[0], source: 'distance' } : undefined
}

function sortHierarchy (nodes: BodyHierarchyNode[]): void {
  nodes.sort(compareNodes)
  for (const node of nodes) sortHierarchy(node.children)
}

function compareNodes (left: BodyHierarchyNode, right: BodyHierarchyNode): number {
  return compareBodies(left.body, right.body)
}

function compareBodies (left: CartographicBody, right: CartographicBody): number {
  if (left.bodyId != null || right.bodyId != null) {
    const bodyIdOrder = (left.bodyId ?? Number.MAX_SAFE_INTEGER) - (right.bodyId ?? Number.MAX_SAFE_INTEGER)
    if (bodyIdOrder !== 0) return bodyIdOrder
  }
  const distanceOrder = (left.distanceToArrival ?? Number.MAX_SAFE_INTEGER) -
    (right.distanceToArrival ?? Number.MAX_SAFE_INTEGER)
  return distanceOrder || left.name.localeCompare(right.name)
}

function compareStations (left: CartographicStation, right: CartographicStation): number {
  return (left.distanceToArrival ?? Number.MAX_SAFE_INTEGER) -
    (right.distanceToArrival ?? Number.MAX_SAFE_INTEGER) || left.name.localeCompare(right.name)
}

function recordValue (value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function integerValue (value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function stringValue (value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
