import { NavigationRouteSchema, type NavigationRoute } from '@phoenix/contracts'

export function parseEliteNavigationRoute (candidate: unknown): NavigationRoute {
  const input = record(candidate)
  return NavigationRouteSchema.parse({
    timestamp: stringValue(input.timestamp),
    route: arrayValue(input.Route).map(item => {
      const hop = record(item)
      return {
        system: hop.StarSystem,
        address: integerValue(hop.SystemAddress),
        position: coordinateValue(hop.StarPos),
        starClass: stringValue(hop.StarClass)
      }
    })
  })
}

function record (candidate: unknown): Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : {}
}

function arrayValue (candidate: unknown): unknown[] {
  return Array.isArray(candidate) ? candidate : []
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function integerValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function coordinateValue (candidate: unknown): [number, number, number] | null {
  return Array.isArray(candidate) && candidate.length === 3 && candidate.every(value => typeof value === 'number' && Number.isFinite(value))
    ? candidate as [number, number, number]
    : null
}
