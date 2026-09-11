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
  kind: 'body'
  key: string
  body: CartographicBody
  children: OrbitalHierarchyNode[]
  installations: AttachedInstallation[]
}

export interface BarycentreHierarchyNode {
  kind: 'barycentre'
  key: string
  bodyId: number
  children: OrbitalHierarchyNode[]
}

export interface UnresolvedBodyHierarchyNode {
  kind: 'unresolved-body'
  key: string
  bodyId: number
  bodyType: 'Star' | 'Planet'
  children: OrbitalHierarchyNode[]
}

export type OrbitalHierarchyNode =
  | BodyHierarchyNode
  | BarycentreHierarchyNode
  | UnresolvedBodyHierarchyNode

export interface SystemHierarchy {
  roots: OrbitalHierarchyNode[]
  unassignedInstallations: CartographicStation[]
}

interface ParentReference {
  bodyId: number
  kind: 'body' | 'barycentre'
  bodyType?: 'Star' | 'Planet'
}

export function buildSystemHierarchy (system: CartographicSystem): SystemHierarchy {
  const nodes = new Map<string, OrbitalHierarchyNode>()
  const bodies = [...system.bodies].sort(compareBodies)

  for (const body of bodies) {
    nodes.set(bodyKey(body), createBodyNode(body))
  }

  const parentByChild = new Map<string, string>()
  for (const body of bodies) {
    if (body.bodyId == null) continue
    const chain = [bodyReference(body.bodyId), ...parentReferences(body)]
    for (const reference of chain) ensureNode(reference, nodes)
    for (let index = 0; index < chain.length - 1; index += 1) {
      const child = referenceKey(chain[index]!)
      const parent = referenceKey(chain[index + 1]!)
      if (child !== parent && !parentByChild.has(child)) parentByChild.set(child, parent)
    }
  }

  const roots: OrbitalHierarchyNode[] = []
  for (const node of nodes.values()) {
    const parentKey = parentByChild.get(node.key)
    const parent = parentKey ? nodes.get(parentKey) : undefined
    if (parent && !wouldCreateCycle(node.key, parent.key, parentByChild)) parent.children.push(node)
    else roots.push(node)
  }
  sortHierarchy(roots)

  const bodyNodes = [...nodes.values()].filter((node): node is BodyHierarchyNode => node.kind === 'body')
  const unassignedInstallations = attachInstallations(system.stations, bodyNodes)
  return { roots, unassignedInstallations }
}

function bodyReference (bodyId: number): ParentReference {
  return { bodyId, kind: 'body' }
}

function parentReferences (body: CartographicBody): ParentReference[] {
  const references: ParentReference[] = []
  for (const parent of body.parents) {
    const star = integerValue(parent.Star ?? parent.star)
    if (star !== null) {
      references.push({ bodyId: star, kind: 'body', bodyType: 'Star' })
      continue
    }
    const planet = integerValue(parent.Planet ?? parent.planet)
    if (planet !== null) {
      references.push({ bodyId: planet, kind: 'body', bodyType: 'Planet' })
      continue
    }
    const barycentre = integerValue(parent.Null ?? parent.null)
    if (barycentre !== null) references.push({ bodyId: barycentre, kind: 'barycentre' })
  }
  return references
}

function ensureNode (reference: ParentReference, nodes: Map<string, OrbitalHierarchyNode>): void {
  const key = referenceKey(reference)
  if (nodes.has(key)) return
  nodes.set(key, reference.kind === 'barycentre'
    ? { bodyId: reference.bodyId, children: [], key, kind: 'barycentre' }
    : {
        bodyId: reference.bodyId,
        bodyType: reference.bodyType ?? 'Planet',
        children: [],
        key,
        kind: 'unresolved-body'
      })
}

function referenceKey (reference: ParentReference): string {
  return reference.kind === 'barycentre'
    ? barycentreNodeKey(reference.bodyId)
    : bodyNodeKey(reference.bodyId)
}

function bodyNodeKey (bodyId: number): string {
  return `body:${bodyId}`
}

function barycentreNodeKey (bodyId: number): string {
  return `barycentre:${bodyId}`
}

function createBodyNode (body: CartographicBody): BodyHierarchyNode {
  return {
    body,
    children: [],
    installations: [],
    key: bodyKey(body),
    kind: 'body'
  }
}

function bodyKey (body: CartographicBody): string {
  if (body.bodyId != null) return bodyNodeKey(body.bodyId)
  if (body.id64 != null) return `body:id64:${body.id64}`
  if (body.id != null) return `body:id:${body.id}`
  return `body:name:${body.name.toLocaleLowerCase()}`
}

function wouldCreateCycle (childKey: string, parentKey: string, parentByChild: Map<string, string>): boolean {
  const visited = new Set([childKey])
  let cursor: string | undefined = parentKey
  while (cursor) {
    if (visited.has(cursor)) return true
    visited.add(cursor)
    cursor = parentByChild.get(cursor)
  }
  return false
}

function attachInstallations (
  stations: CartographicStation[],
  nodes: BodyHierarchyNode[]
): CartographicStation[] {
  const unassigned: CartographicStation[] = []
  for (const station of stations) {
    const placement = explicitParent(station, nodes) ?? nearestBody(station, nodes)
    if (!placement) {
      unassigned.push(station)
      continue
    }
    placement.node.installations.push({ station, source: placement.source })
  }
  for (const node of nodes) {
    node.installations.sort((left, right) => compareStations(left.station, right.station))
  }
  unassigned.sort(compareStations)
  return unassigned
}

function explicitParent (
  station: CartographicStation,
  nodes: BodyHierarchyNode[]
): { node: BodyHierarchyNode, source: InstallationParentSource } | undefined {
  const rawBody = recordValue(station.raw.body)
  const id = integerValue(rawBody?.id ?? station.raw.bodyId)
  const bodyId = integerValue(rawBody?.bodyId)
  const name = stringValue(rawBody?.name ?? station.raw.bodyName)
  for (const node of nodes) {
    const body = node.body
    if ((id != null && (body.id === id || body.bodyId === id)) ||
      (bodyId != null && body.bodyId === bodyId) ||
      (name != null && body.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return { node, source: 'explicit' }
    }
  }
}

function nearestBody (
  station: CartographicStation,
  nodes: BodyHierarchyNode[]
): { node: BodyHierarchyNode, source: InstallationParentSource } | undefined {
  const candidateNodes = station.type?.toLocaleLowerCase() === 'fleet carrier'
    ? nodes
    : nodes.some(node => !isStar(node.body))
      ? nodes.filter(node => !isStar(node.body))
      : nodes
  if (station.distanceToArrival == null) {
    const node = [...candidateNodes].sort(compareNodes)[0]
    return node ? { node, source: 'distance' } : undefined
  }
  const candidates = candidateNodes.filter(node => node.body.distanceToArrival != null)
  candidates.sort((left, right) => {
    const leftDelta = Math.abs(station.distanceToArrival! - left.body.distanceToArrival!)
    const rightDelta = Math.abs(station.distanceToArrival! - right.body.distanceToArrival!)
    return leftDelta - rightDelta || compareNodes(left, right)
  })
  return candidates[0] ? { node: candidates[0], source: 'distance' } : undefined
}

function isStar (body: CartographicBody): boolean {
  return body.type?.toLocaleLowerCase() === 'star'
}

function sortHierarchy (nodes: OrbitalHierarchyNode[]): void {
  nodes.sort(compareNodes)
  for (const node of nodes) sortHierarchy(node.children)
}

function compareNodes (left: OrbitalHierarchyNode, right: OrbitalHierarchyNode): number {
  return nodeBodyId(left) - nodeBodyId(right) || left.key.localeCompare(right.key)
}

function nodeBodyId (node: OrbitalHierarchyNode): number {
  return node.kind === 'body' ? node.body.bodyId ?? Number.MAX_SAFE_INTEGER : node.bodyId
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
