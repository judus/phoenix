import type { AttachedInstallation, OrbitalHierarchyNode } from './system-hierarchy.js'

export interface OrbitalLayoutPoint {
  x: number
  y: number
}

export interface OrbitalLayoutEdge {
  key: string
  points: OrbitalLayoutPoint[]
}

export interface OrbitalLayoutNode extends OrbitalLayoutPoint {
  compact: boolean
  node: OrbitalHierarchyNode
}

export interface OrbitalLayoutInstallation extends OrbitalLayoutPoint {
  installation: AttachedInstallation
  key: string
}

export interface SystemOrbitalLayout {
  edges: OrbitalLayoutEdge[]
  height: number
  installations: OrbitalLayoutInstallation[]
  nodes: OrbitalLayoutNode[]
  width: number
}

interface LayoutFragment {
  edges: OrbitalLayoutEdge[]
  height: number
  installations: OrbitalLayoutInstallation[]
  nodes: OrbitalLayoutNode[]
  root: OrbitalLayoutPoint
  width: number
}

const horizontalGap = 0.25
const orbitalRowGap = 0.4
const satelliteGap = 0
const canvasBlockMargin = 0.65
const canvasInlineStartMargin = 0.1
const canvasInlineEndMargin = 0.65

export function layoutSystemHierarchy (roots: OrbitalHierarchyNode[]): SystemOrbitalLayout {
  const fragments = roots.map(root => layoutNode(root, false))
  const combined = emptyFragment()
  let cursorY = 0
  for (const fragment of fragments) {
    appendFragment(combined, fragment, 0, cursorY)
    cursorY += fragment.height + orbitalRowGap
    combined.width = Math.max(combined.width, fragment.width)
    combined.height = Math.max(combined.height, cursorY - orbitalRowGap)
  }
  const inlineOffset = canvasInlineStartMargin - minimumContentX(combined)
  translateFragment(combined, inlineOffset, canvasBlockMargin)
  return {
    edges: combined.edges,
    height: Math.max(1.5, combined.height + canvasBlockMargin * 2),
    installations: combined.installations,
    nodes: combined.nodes,
    width: Math.max(1.5, combined.width + inlineOffset + canvasInlineEndMargin)
  }
}

function layoutNode (node: OrbitalHierarchyNode, compact: boolean): LayoutFragment {
  if (node.kind === 'barycentre') return layoutBarycentre(node, compact)
  const fragment = ownNodeFragment(node, compact)
  if (node.children.length === 0) return fragment
  return isStellarNode(node)
    ? attachHorizontally(fragment, node.children)
    : attachVertically(fragment, node.children)
}

function layoutBarycentre (node: OrbitalHierarchyNode & { kind: 'barycentre' }, compact: boolean): LayoutFragment {
  return containsStar(node)
    ? layoutVerticalBarycentre(node, compact)
    : layoutHorizontalBarycentre(node, compact)
}

/*
 * A stellar barycentre is a structural axis, not an object. Its stellar
 * branches sit above and below the shared orbit, while non-stellar children
 * occupy one horizontal band through the middle of that axis.
 */
function layoutVerticalBarycentre (node: OrbitalHierarchyNode & { kind: 'barycentre' }, compact: boolean): LayoutFragment {
  const fragment = structuralFragment()
  fragment.root = { x: 0.5, y: 0 }
  const stellarChildren = node.children.filter(containsStar)
  const orbitingChildren = node.children.filter(child => !containsStar(child))
  const middle = Math.ceil(stellarChildren.length / 2)
  const upperStellarChildren = stellarChildren.slice(0, middle)
  const lowerStellarChildren = stellarChildren.slice(middle)
  let cursorY = 0

  const appendStellarChildren = (children: OrbitalHierarchyNode[]): void => {
    for (const child of children) {
      const childFragment = layoutNode(child, compact)
      const childX = 1
      appendFragment(fragment, childFragment, childX, cursorY)
      fragment.edges.push({
        key: `${node.key}:${child.key}`,
        points: [
          { x: 0.5, y: 0 },
          { x: 0.5, y: cursorY + childFragment.root.y },
          { x: childX + childFragment.root.x, y: cursorY + childFragment.root.y }
        ]
      })
      cursorY += childFragment.height + orbitalRowGap
      fragment.width = Math.max(fragment.width, childX + childFragment.width)
      fragment.height = Math.max(fragment.height, cursorY - orbitalRowGap)
    }
  }

  appendStellarChildren(upperStellarChildren)

  if (orbitingChildren.length > 0) {
    let cursorX = 2 + horizontalGap
    let rowHeight = 1
    for (const child of orbitingChildren) {
      const childFragment = layoutNode(child, compact)
      appendFragment(fragment, childFragment, cursorX, cursorY)
      fragment.edges.push({
        key: `${node.key}:${child.key}`,
        points: [
          { x: 0.5, y: 0 },
          { x: 0.5, y: cursorY + childFragment.root.y },
          { x: cursorX + childFragment.root.x, y: cursorY + childFragment.root.y }
        ]
      })
      cursorX += childFragment.width + horizontalGap
      rowHeight = Math.max(rowHeight, childFragment.height)
    }
    cursorY += rowHeight + orbitalRowGap
    fragment.width = Math.max(fragment.width, cursorX - horizontalGap)
    fragment.height = Math.max(fragment.height, cursorY - orbitalRowGap)
  }

  appendStellarChildren(lowerStellarChildren)
  return fragment
}

function layoutHorizontalBarycentre (node: OrbitalHierarchyNode & { kind: 'barycentre' }, compact: boolean): LayoutFragment {
  const fragment = structuralFragment()
  const childRoots: OrbitalLayoutPoint[] = []
  let cursorX = 0
  for (const child of node.children) {
    const childFragment = layoutNode(child, compact)
    appendFragment(fragment, childFragment, cursorX, 0)
    childRoots.push({ x: cursorX + childFragment.root.x, y: childFragment.root.y })
    cursorX += childFragment.width + horizontalGap
    fragment.width = Math.max(fragment.width, cursorX - horizontalGap)
    fragment.height = Math.max(fragment.height, childFragment.height)
  }
  if (childRoots.length > 0) {
    const first = childRoots[0]!
    const last = childRoots.at(-1)!
    fragment.root = { x: (first.x + last.x) / 2, y: first.y }
    childRoots.forEach((childRoot, index) => {
      fragment.edges.push({
        key: `${node.key}:${node.children[index]!.key}`,
        points: [fragment.root, childRoot]
      })
    })
  }
  return fragment
}

function attachHorizontally (fragment: LayoutFragment, children: OrbitalHierarchyNode[]): LayoutFragment {
  let cursorX = fragment.width + horizontalGap
  for (const child of children) {
    const childFragment = layoutNode(child, false)
    appendFragment(fragment, childFragment, cursorX, 0)
    fragment.edges.push({
      key: `${fragment.nodes[0]!.node.key}:${child.key}`,
      points: [fragment.root, { x: cursorX + childFragment.root.x, y: childFragment.root.y }]
    })
    cursorX += childFragment.width + horizontalGap
    fragment.width = Math.max(fragment.width, cursorX - horizontalGap)
    fragment.height = Math.max(fragment.height, childFragment.height)
  }
  return fragment
}

function attachVertically (fragment: LayoutFragment, children: OrbitalHierarchyNode[]): LayoutFragment {
  let cursorY = fragment.height + satelliteGap
  for (const child of children) {
    const childFragment = layoutNode(child, true)
    appendFragment(fragment, childFragment, 0, cursorY)
    const childRoot = { x: childFragment.root.x, y: cursorY + childFragment.root.y }
    fragment.edges.push({
      key: `${fragment.nodes[0]!.node.key}:${child.key}`,
      points: [fragment.root, { x: fragment.root.x, y: childRoot.y }, childRoot]
    })
    cursorY += childFragment.height + satelliteGap
    fragment.width = Math.max(fragment.width, childFragment.width)
    fragment.height = Math.max(fragment.height, cursorY - satelliteGap)
  }
  return fragment
}

function ownNodeFragment (node: OrbitalHierarchyNode, compact: boolean): LayoutFragment {
  const installations = node.kind === 'body'
    ? node.installations.map((installation, index) => ({
        installation,
        key: `${node.key}:installation:${installation.station.marketId ?? installation.station.id ?? installation.station.name}`,
        x: 0.62,
        y: index * 0.28
      }))
    : []
  return {
    edges: installations.length > 0
      ? [{ key: `${node.key}:installations`, points: [{ x: 0, y: 0 }, { x: 0.62, y: 0 }] }]
      : [],
    height: Math.max(1, installations.length * 0.28),
    installations,
    nodes: [{ compact, node, x: 0, y: 0 }],
    root: { x: 0, y: 0 },
    width: installations.length > 0 ? 2 : 1
  }
}

function structuralFragment (): LayoutFragment {
  return { edges: [], height: 1, installations: [], nodes: [], root: { x: 0, y: 0 }, width: 0 }
}

function appendFragment (target: LayoutFragment, source: LayoutFragment, x: number, y: number): void {
  target.nodes.push(...source.nodes.map(node => ({ ...node, x: node.x + x, y: node.y + y })))
  target.installations.push(...source.installations.map(item => ({ ...item, x: item.x + x, y: item.y + y })))
  target.edges.push(...source.edges.map(edge => ({
    ...edge,
    points: edge.points.map(point => ({ x: point.x + x, y: point.y + y }))
  })))
}

function translateFragment (fragment: LayoutFragment, x: number, y: number): void {
  fragment.root = { x: fragment.root.x + x, y: fragment.root.y + y }
  fragment.nodes = fragment.nodes.map(node => ({ ...node, x: node.x + x, y: node.y + y }))
  fragment.installations = fragment.installations.map(item => ({ ...item, x: item.x + x, y: item.y + y }))
  fragment.edges = fragment.edges.map(edge => ({
    ...edge,
    points: edge.points.map(point => ({ x: point.x + x, y: point.y + y }))
  }))
}

function emptyFragment (): LayoutFragment {
  return { edges: [], height: 0, installations: [], nodes: [], root: { x: 0, y: 0 }, width: 0 }
}

function minimumContentX (fragment: LayoutFragment): number {
  const coordinates = [
    ...fragment.edges.flatMap(edge => edge.points.map(point => point.x)),
    ...fragment.nodes.map(node => node.x - 0.5),
    ...fragment.installations.map(installation => installation.x)
  ]
  return coordinates.length > 0 ? Math.min(...coordinates) : 0
}

function isStar (type: string | null): boolean {
  return type?.toLocaleLowerCase() === 'star'
}

function containsStar (node: OrbitalHierarchyNode): boolean {
  if (node.kind !== 'barycentre') return isStellarNode(node)
  return node.children.some(containsStar)
}

function isStellarNode (node: Exclude<OrbitalHierarchyNode, { kind: 'barycentre' }>): boolean {
  return node.kind === 'body' ? isStar(node.body.type) : node.bodyType === 'Star'
}
