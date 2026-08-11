import type { EliteJournalEvent } from '@phoenix/elite'
import type {
  CartographyObservationStore,
  LocalBodyCartographyObservation,
  LocalOrganicSampleObservation,
  LocalSystemCartographyObservation
} from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const BODY_EVENTS = new Set(['Scan', 'FSSBodySignals', 'SAASignalsFound', 'SAAScanComplete', 'ScanOrganic'])
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
    if (event.timestamp < current.updatedAt) return
    const reportedBodyCount = SYSTEM_EVENTS.has(event.event)
      ? integerValue(event.BodyCount) ?? current.reportedBodyCount
      : current.reportedBodyCount
    const bodyId = event.event === 'ScanOrganic' ? integerCandidate(event.Body) : integerValue(event.BodyID)
    const runtimePlace = this.runtimeState.getCurrent().location.place
    const bodyName = stringValue(event.BodyName)
      ?? current.bodies.find(body => bodyId !== null && body.bodyId === bodyId)?.bodyName
      ?? (runtimePlace?.kind === 'body' && (bodyId === null || runtimePlace.id === bodyId) ? runtimePlace.name : null)
    const bodies = bodyName ? mergeBody(current.bodies, bodyName, bodyId, event) : current.bodies
    this.store.putObservation({
      ...current,
      allBodiesFound: event.event === 'FSSAllBodiesFound' || current.allBodiesFound === true,
      systemAddress: integerValue(event.SystemAddress) ?? current.systemAddress,
      reportedBodyCount,
      bodies,
      updatedAt: event.timestamp
    })
  }
}

function emptyObservation (systemName: string, event: EliteJournalEvent): LocalSystemCartographyObservation {
  return {
    allBodiesFound: event.event === 'FSSAllBodiesFound',
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
  bodyId: number | null,
  event: EliteJournalEvent
): LocalBodyCartographyObservation[] {
  const index = bodies.findIndex(body => (
    body.bodyName.toLocaleLowerCase() === bodyName.toLocaleLowerCase() ||
    (bodyId !== null && body.bodyId === bodyId)
  ))
  const current = index >= 0 ? bodies[index] : emptyBody(bodyName, event)
  const next: LocalBodyCartographyObservation = {
    ...current,
    bodyId: bodyId ?? current.bodyId,
    observedAt: event.timestamp,
    scan: event.event === 'Scan' ? copyRecord(event) : current.scan,
    bodySignals: event.event === 'FSSBodySignals' ? copyRecord(event) : current.bodySignals,
    surfaceSignals: event.event === 'SAASignalsFound' ? copyRecord(event) : current.surfaceSignals,
    surfaceScanCompleted: event.event === 'SAAScanComplete' || current.surfaceScanCompleted,
    discovered: event.event === 'Scan' ? booleanValue(event.WasDiscovered) : current.discovered,
    footfalled: event.event === 'Scan' ? booleanValue(event.WasFootfalled) : current.footfalled,
    mapped: event.event === 'Scan' ? booleanValue(event.WasMapped) : current.mapped,
    organicSamples: event.event === 'ScanOrganic'
      ? mergeOrganicSample(current.organicSamples ?? [], event)
      : current.organicSamples ?? []
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
    footfalled: null,
    mapped: null,
    observedAt: event.timestamp,
    organicSamples: [],
    scan: null,
    surfaceScanCompleted: false,
    surfaceSignals: null
  }
}

function mergeOrganicSample (
  samples: LocalOrganicSampleObservation[],
  event: EliteJournalEvent
): LocalOrganicSampleObservation[] {
  const genusId = stringValue(event.Genus)
  const speciesId = stringValue(event.Species)
  const variantId = stringValue(event.Variant)
  const genus = stringValue(event.Genus_Localised) ?? genusId ?? 'Unknown'
  const species = stringValue(event.Species_Localised) ?? speciesId ?? 'Unknown'
  const variant = stringValue(event.Variant_Localised) ?? variantId ?? 'Unknown'
  const key = [genusId ?? genus, speciesId ?? species, variantId ?? variant].join('|').toLocaleLowerCase()
  const index = samples.findIndex(sample => (
    [sample.genusId ?? sample.genus, sample.speciesId ?? sample.species, sample.variantId ?? sample.variant]
      .join('|').toLocaleLowerCase() === key
  ))
  const current = index >= 0 ? samples[index] : {
    completed: false,
    genus,
    genusId,
    lastUpdated: event.timestamp,
    progress: 0,
    scanTypes: [],
    species,
    speciesId,
    variant,
    variantId
  }
  const scanType = stringValue(event.ScanType)
  const scanTypes = scanType && !current.scanTypes.includes(scanType)
    ? [...current.scanTypes, scanType]
    : current.scanTypes
  const completed = current.completed || scanTypes.includes('Analyse')
  const next: LocalOrganicSampleObservation = {
    ...current,
    completed,
    genus,
    genusId,
    lastUpdated: event.timestamp,
    progress: completed ? 3 : Math.min(3, scanTypes.filter(type => type === 'Log' || type === 'Sample').length),
    scanTypes,
    species,
    speciesId,
    variant,
    variantId
  }
  if (index < 0) return [...samples, next]
  return samples.map((sample, sampleIndex) => sampleIndex === index ? next : sample)
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

function integerCandidate (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function booleanValue (candidate: unknown): boolean | null {
  return typeof candidate === 'boolean' ? candidate : null
}
