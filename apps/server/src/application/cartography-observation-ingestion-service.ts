import type { EliteJournalEvent } from '@phoenix/elite'
import type {
  CartographyObservationStore,
  LocalBodyCartographyObservation,
  LocalSystemCartographyObservation
} from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const BODY_EVENTS = new Set(['Scan', 'FSSBodySignals', 'SAASignalsFound', 'SAAScanComplete'])
const SYSTEM_EVENTS = new Set(['FSSDiscoveryScan', 'FSSAllBodiesFound'])

export class CartographyObservationIngestionService {
  public constructor (
    private readonly store: CartographyObservationStore,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public ingest (event: EliteJournalEvent): void {
    if (!BODY_EVENTS.has(event.event) && !SYSTEM_EVENTS.has(event.event)) return
    const systemName = stringValue(event.SystemName) ?? stringValue(event.StarSystem) ?? this.runtimeState.getCurrent().system.name
    if (!systemName) return
    const current = this.store.getObservation(systemName) ?? emptyObservation(systemName, event)
    const reportedBodyCount = SYSTEM_EVENTS.has(event.event)
      ? integerValue(event.BodyCount) ?? current.reportedBodyCount
      : current.reportedBodyCount
    const bodyName = stringValue(event.BodyName)
    const bodies = bodyName ? mergeBody(current.bodies, bodyName, event) : current.bodies
    this.store.putObservation({
      ...current,
      systemAddress: integerValue(event.SystemAddress) ?? current.systemAddress,
      reportedBodyCount,
      bodies,
      updatedAt: event.timestamp
    })
  }
}

function emptyObservation (systemName: string, event: EliteJournalEvent): LocalSystemCartographyObservation {
  return {
    systemName,
    systemAddress: integerValue(event.SystemAddress),
    reportedBodyCount: null,
    bodies: [],
    updatedAt: event.timestamp
  }
}

function mergeBody (
  bodies: LocalBodyCartographyObservation[],
  bodyName: string,
  event: EliteJournalEvent
): LocalBodyCartographyObservation[] {
  const index = bodies.findIndex(body => body.bodyName.toLocaleLowerCase() === bodyName.toLocaleLowerCase())
  const current = index >= 0 ? bodies[index] : emptyBody(bodyName, event)
  const next: LocalBodyCartographyObservation = {
    ...current,
    bodyId: integerValue(event.BodyID) ?? current.bodyId,
    observedAt: event.timestamp,
    scan: event.event === 'Scan' ? copyRecord(event) : current.scan,
    bodySignals: event.event === 'FSSBodySignals' ? copyRecord(event) : current.bodySignals,
    surfaceSignals: event.event === 'SAASignalsFound' ? copyRecord(event) : current.surfaceSignals,
    surfaceScanCompleted: event.event === 'SAAScanComplete' || current.surfaceScanCompleted,
    discovered: event.event === 'Scan' ? booleanValue(event.WasDiscovered) : current.discovered,
    mapped: event.event === 'Scan' ? booleanValue(event.WasMapped) : current.mapped
  }
  if (index < 0) return [...bodies, next]
  return bodies.map((body, bodyIndex) => bodyIndex === index ? next : body)
}

function emptyBody (bodyName: string, event: EliteJournalEvent): LocalBodyCartographyObservation {
  return {
    bodyId: integerValue(event.BodyID),
    bodyName,
    bodySignals: null,
    discovered: null,
    mapped: null,
    observedAt: event.timestamp,
    scan: null,
    surfaceScanCompleted: false,
    surfaceSignals: null
  }
}

function copyRecord (candidate: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(candidate)
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function integerValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function booleanValue (candidate: unknown): boolean | null {
  return typeof candidate === 'boolean' ? candidate : null
}
