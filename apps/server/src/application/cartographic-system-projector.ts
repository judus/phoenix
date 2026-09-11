import type { CartographicBody, CartographicSystem, CurrentSystem } from '@phoenix/contracts'
import {
  hasCartographicBodyEvidence,
  type CartographyRecord,
  type LocalBodyCartographyObservation,
  type LocalSystemCartographyObservation
} from '../domain/cartography.js'

export function projectCartographicSystem (record: CartographyRecord, current: CurrentSystem): CartographicSystem {
  const local = record.local
  const external = record.external
  const base = external ?? systemFromObservation(local)
  const observed = local ? mergeObservation(base, local) : base
  const runtime = sameName(current.name, observed.name) ? current : null
  return {
    ...observed,
    address: runtime?.address ?? observed.address,
    position: runtime?.position ?? observed.position,
    information: runtime ? mergeInformation(observed, runtime) : observed.information,
    localSystem: runtime,
    provenance: {
      edsm: external?.provenance.edsm ?? null,
      journal: local ? { updatedAt: local.updatedAt } : null
    }
  }
}

function systemFromObservation (observation: LocalSystemCartographyObservation | null): CartographicSystem {
  if (!observation) throw new Error('Cartography record contains no source data.')
  const bodies = observation.bodies.filter(hasCartographicBodyEvidence).map(bodyFromObservation)
  return {
    schemaVersion: 5,
    name: observation.systemName,
    address: observation.systemAddress,
    position: null,
    permitRequired: null,
    permitName: null,
    information: emptyInformation(),
    primaryStar: null,
    bodies,
    stations: [],
    scanProgress: scanProgress(bodies.length, observation.reportedBodyCount),
    localSystem: null,
    provenance: { edsm: null, journal: { updatedAt: observation.updatedAt } },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}

function mergeObservation (
  system: CartographicSystem,
  observation: LocalSystemCartographyObservation
): CartographicSystem {
  const bodies = [...system.bodies]
  for (const local of observation.bodies.filter(hasCartographicBodyEvidence)) {
    const index = bodies.findIndex(body => (
      sameName(body.name, local.bodyName) ||
      (body.bodyId !== null && local.bodyId !== null && body.bodyId === local.bodyId)
    ))
    const body = index >= 0 ? bodies[index]! : bodyFromObservation(local)
    const journalBody = local.scan ? bodyFromObservation(local) : null
    const merged = {
      ...body,
      bodyId: local.bodyId ?? body.bodyId,
      ...(journalBody
        ? {
            type: journalBody.type ?? body.type,
            subType: journalBody.subType ?? body.subType,
            distanceToArrival: journalBody.distanceToArrival ?? body.distanceToArrival,
            parents: journalBody.parents.length > 0 ? journalBody.parents : body.parents,
            landable: journalBody.landable ?? body.landable,
            gravityGs: journalBody.gravityGs ?? body.gravityGs,
            surfaceTemperatureKelvin: journalBody.surfaceTemperatureKelvin ?? body.surfaceTemperatureKelvin,
            radiusKilometres: journalBody.radiusKilometres ?? body.radiusKilometres,
            atmosphere: journalBody.atmosphere ?? body.atmosphere,
            ringed: journalBody.ringed,
            details: mergeBodyDetails(body.details, journalBody.details)
          }
        : {}),
      local: localBodyData(local)
    }
    if (index >= 0) bodies[index] = merged
    else bodies.push(merged)
  }
  return {
    ...system,
    address: observation.systemAddress ?? system.address,
    bodies,
    scanProgress: scanProgress(bodies.length, observation.reportedBodyCount),
    provenance: { ...system.provenance, journal: { updatedAt: observation.updatedAt } }
  }
}

function bodyFromObservation (observation: LocalBodyCartographyObservation): CartographicBody {
  const scan = observation.scan ?? {}
  const parents = Array.isArray(scan.Parents)
    ? scan.Parents.filter(item => item !== null && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[]
    : []
  return {
    id: null,
    id64: null,
    bodyId: observation.bodyId,
    name: observation.bodyName,
    type: typeof scan.StarType === 'string' ? 'Star' : typeof scan.PlanetClass === 'string' ? 'Planet' : null,
    subType: stringField(scan.StarType) ?? stringField(scan.PlanetClass),
    distanceToArrival: nonnegativeNumber(scan.DistanceFromArrivalLS),
    parents,
    landable: booleanField(scan.Landable),
    gravityGs: scaledNonnegativeNumber(scan.SurfaceGravity, 1 / 9.80665),
    surfaceTemperatureKelvin: nonnegativeNumber(scan.SurfaceTemperature),
    radiusKilometres: scaledNonnegativeNumber(scan.Radius, 1 / 1_000),
    atmosphere: stringField(scan.AtmosphereType) ?? stringField(scan.Atmosphere),
    ringed: Array.isArray(scan.Rings) && scan.Rings.length > 0,
    details: journalBodyDetails(scan),
    firstDiscoveredBy: null,
    firstFootfallBy: null,
    firstMappedBy: null,
    local: localBodyData(observation),
    raw: scan
  }
}

function localBodyData (observation: LocalBodyCartographyObservation): NonNullable<CartographicBody['local']> {
  const signalSource = observation.surfaceSignals ?? observation.bodySignals
  return {
    observedAt: observation.observedAt,
    discovered: observation.scan !== null,
    footfalled: observation.footfallCompleted,
    mapped: observation.surfaceScanCompleted,
    firstDiscoveredByCommander: observation.scan !== null && observation.previouslyDiscovered === false,
    firstMappedByCommander: observation.surfaceScanCompleted && observation.previouslyMapped === false,
    previouslyFootfalled: observation.previouslyFootfalled,
    surfaceScanCompleted: observation.surfaceScanCompleted,
    signals: signalCounts(signalSource?.Signals),
    signalDetails: signalDetails(signalSource?.Signals),
    biologicalGenuses: Array.isArray(observation.surfaceSignals?.Genuses)
      ? observation.surfaceSignals.Genuses.map(item => {
          const record = item !== null && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
          return stringField(record.Genus_Localised) ?? stringField(record.Genus)
        }).filter((value): value is string => value !== null)
      : [],
    organicSamples: observation.organicSamples ?? [],
    raw: {
      scan: observation.scan,
      bodySignals: observation.bodySignals,
      surfaceSignals: observation.surfaceSignals
    }
  }
}

function journalBodyDetails (scan: Record<string, unknown>): CartographicBody['details'] {
  return {
    absoluteMagnitude: numberValue(scan.AbsoluteMagnitude),
    ageMillionYears: nonnegativeNumber(scan.Age_MY),
    atmosphereComposition: constituents(scan.AtmosphereComposition),
    isMainStar: null,
    isScoopable: null,
    luminosity: stringField(scan.Luminosity),
    massEarths: nonnegativeNumber(scan.MassEM),
    materials: constituents(scan.Materials),
    orbit: {
      ascendingNodeDegrees: numberValue(scan.AscendingNode),
      axialTiltDegrees: scaledNumber(scan.AxialTilt, 180 / Math.PI),
      eccentricity: nonnegativeNumber(scan.Eccentricity),
      inclinationDegrees: numberValue(scan.OrbitalInclination),
      meanAnomalyDegrees: numberValue(scan.MeanAnomaly),
      orbitalPeriodSeconds: numberValue(scan.OrbitalPeriod),
      periapsisDegrees: numberValue(scan.Periapsis),
      rotationPeriodSeconds: numberValue(scan.RotationPeriod),
      semiMajorAxisKilometres: scaledNumber(scan.SemiMajorAxis, 1 / 1_000)
    },
    reserveLevel: cleanEliteLabel(scan.ReserveLevel),
    rings: rings(scan.Rings, 1 / 1_000),
    scanType: stringField(scan.ScanType),
    solarMasses: nonnegativeNumber(scan.StellarMass),
    solarRadius: null,
    solidComposition: solidComposition(scan.Composition, 100),
    spectralClass: stringField(scan.StarType),
    starSubclass: integerRange(scan.Subclass, 0, 9),
    surfacePressurePascals: nonnegativeNumber(scan.SurfacePressure),
    terraformState: explicitEliteState(scan, 'TerraformState', 'Not terraformable'),
    tidallyLocked: booleanField(scan.TidalLock),
    volcanism: explicitEliteState(scan, 'Volcanism', 'None')
  }
}

function mergeBodyDetails (
  external: CartographicBody['details'],
  journal: CartographicBody['details']
): CartographicBody['details'] {
  return {
    absoluteMagnitude: journal.absoluteMagnitude ?? external.absoluteMagnitude,
    ageMillionYears: journal.ageMillionYears ?? external.ageMillionYears,
    atmosphereComposition: journal.atmosphereComposition.length > 0
      ? journal.atmosphereComposition
      : external.atmosphereComposition,
    isMainStar: journal.isMainStar ?? external.isMainStar,
    isScoopable: journal.isScoopable ?? external.isScoopable,
    luminosity: journal.luminosity ?? external.luminosity,
    massEarths: journal.massEarths ?? external.massEarths,
    materials: journal.materials.length > 0 ? journal.materials : external.materials,
    orbit: {
      ascendingNodeDegrees: journal.orbit.ascendingNodeDegrees ?? external.orbit.ascendingNodeDegrees,
      axialTiltDegrees: journal.orbit.axialTiltDegrees ?? external.orbit.axialTiltDegrees,
      eccentricity: journal.orbit.eccentricity ?? external.orbit.eccentricity,
      inclinationDegrees: journal.orbit.inclinationDegrees ?? external.orbit.inclinationDegrees,
      meanAnomalyDegrees: journal.orbit.meanAnomalyDegrees ?? external.orbit.meanAnomalyDegrees,
      orbitalPeriodSeconds: journal.orbit.orbitalPeriodSeconds ?? external.orbit.orbitalPeriodSeconds,
      periapsisDegrees: journal.orbit.periapsisDegrees ?? external.orbit.periapsisDegrees,
      rotationPeriodSeconds: journal.orbit.rotationPeriodSeconds ?? external.orbit.rotationPeriodSeconds,
      semiMajorAxisKilometres: journal.orbit.semiMajorAxisKilometres ?? external.orbit.semiMajorAxisKilometres
    },
    reserveLevel: journal.reserveLevel ?? external.reserveLevel,
    rings: journal.rings.length > 0 ? journal.rings : external.rings,
    scanType: journal.scanType ?? external.scanType,
    solarMasses: journal.solarMasses ?? external.solarMasses,
    solarRadius: journal.solarRadius ?? external.solarRadius,
    solidComposition: journal.solidComposition ?? external.solidComposition,
    spectralClass: journal.spectralClass ?? external.spectralClass,
    starSubclass: journal.starSubclass ?? external.starSubclass,
    surfacePressurePascals: journal.surfacePressurePascals ?? external.surfacePressurePascals,
    terraformState: journal.terraformState ?? external.terraformState,
    tidallyLocked: journal.tidallyLocked ?? external.tidallyLocked,
    volcanism: journal.volcanism ?? external.volcanism
  }
}

function scanProgress (knownBodies: number, reportedBodies: number | null): CartographicSystem['scanProgress'] {
  return {
    knownBodies,
    reportedBodies,
    percent: reportedBodies && reportedBodies > 0
      ? Math.min(100, Math.floor((knownBodies / reportedBodies) * 100))
      : null
  }
}

function signalCounts (candidate: unknown): { biological: number, geological: number, human: number } {
  const counts = { biological: 0, geological: 0, human: 0 }
  if (!Array.isArray(candidate)) return counts
  for (const item of candidate) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
    const signal = item as Record<string, unknown>
    const type = stringField(signal.Type)?.toLocaleLowerCase() ?? ''
    const count = Number.isSafeInteger(signal.Count) && (signal.Count as number) >= 0 ? signal.Count as number : 0
    if (type.includes('biological')) counts.biological = count
    if (type.includes('geological')) counts.geological = count
    if (type.includes('human')) counts.human = count
  }
  return counts
}

function signalDetails (candidate: unknown): Array<{ count: number, type: string }> {
  if (!Array.isArray(candidate)) return []
  const signals = candidate.flatMap(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return []
    const signal = item as Record<string, unknown>
    const type = stringField(signal.Type_Localised) ?? cleanEliteLabel(signal.Type)
    const count = nonnegativeInteger(signal.Count)
    return type && count !== null ? [{ count, type }] : []
  })
  return [...signals.reduce((grouped, signal) => {
    const key = signal.type.toLocaleLowerCase()
    const existing = grouped.get(key)
    grouped.set(key, existing ? { ...existing, count: existing.count + signal.count } : signal)
    return grouped
  }, new Map<string, { count: number, type: string }>()).values()]
}

function constituents (candidate: unknown): Array<{ name: string, percent: number }> {
  if (!Array.isArray(candidate)) return []
  return candidate.flatMap(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    const name = cleanEliteLabel(value.Name_Localised) ?? cleanEliteLabel(value.Name)
    const percent = boundedPercent(value.Percent)
    return name && percent !== null ? [{ name, percent }] : []
  })
}

function solidComposition (candidate: unknown, scale: number): CartographicBody['details']['solidComposition'] {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const value = candidate as Record<string, unknown>
  const icePercent = scaledPercent(value.Ice, scale)
  const metalPercent = scaledPercent(value.Metal, scale)
  const rockPercent = scaledPercent(value.Rock, scale)
  return icePercent === null && metalPercent === null && rockPercent === null
    ? null
    : { icePercent, metalPercent, rockPercent }
}

function rings (candidate: unknown, radiusScale: number): CartographicBody['details']['rings'] {
  if (!Array.isArray(candidate)) return []
  return candidate.flatMap(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    const name = stringField(value.Name) ?? stringField(value.name)
    if (!name) return []
    return [{
      innerRadiusKilometres: scaledNonnegativeNumber(value.InnerRad ?? value.innerRadius, radiusScale),
      massMegatonnes: nonnegativeNumber(value.MassMT ?? value.mass),
      name,
      outerRadiusKilometres: scaledNonnegativeNumber(value.OuterRad ?? value.outerRadius, radiusScale),
      type: cleanEliteLabel(value.RingClass ?? value.type)
    }]
  })
}

function mergeInformation (system: CartographicSystem, local: CurrentSystem): CartographicSystem['information'] {
  return {
    allegiance: local.allegiance ?? system.information.allegiance,
    government: local.government?.label ?? local.government?.id ?? system.information.government,
    security: local.security?.label ?? local.security?.id ?? system.information.security,
    state: local.controllingFaction?.state ?? system.information.state,
    primaryEconomy: local.primaryEconomy?.label ?? local.primaryEconomy?.id ?? system.information.primaryEconomy,
    secondaryEconomy: local.secondaryEconomy?.label ?? local.secondaryEconomy?.id ?? system.information.secondaryEconomy,
    population: local.population ?? system.information.population,
    controllingFaction: local.controllingFaction?.name ?? system.information.controllingFaction
  }
}

function emptyInformation (): CartographicSystem['information'] {
  return {
    allegiance: null,
    government: null,
    security: null,
    state: null,
    primaryEconomy: null,
    secondaryEconomy: null,
    population: null,
    controllingFaction: null
  }
}

function sameName (left: string | null, right: string): boolean {
  return left !== null && normalize(left) === normalize(right)
}

function normalize (value: string): string {
  return value.trim().toLocaleLowerCase()
}

function stringField (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

function scaledNonnegativeNumber (candidate: unknown, scale: number): number | null {
  const value = nonnegativeNumber(candidate)
  return value === null ? null : value * scale
}

function numberValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function scaledNumber (candidate: unknown, scale: number): number | null {
  const value = numberValue(candidate)
  return value === null ? null : value * scale
}

function boundedPercent (candidate: unknown): number | null {
  const value = numberValue(candidate)
  return value !== null && value >= 0 && value <= 100 ? value : null
}

function scaledPercent (candidate: unknown, scale: number): number | null {
  const value = numberValue(candidate)
  return value === null ? null : boundedPercent(value * scale)
}

function integerRange (candidate: unknown, minimum: number, maximum: number): number | null {
  return typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= minimum && candidate <= maximum
    ? candidate
    : null
}

function nonnegativeInteger (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function cleanEliteLabel (candidate: unknown): string | null {
  const value = stringField(candidate)
  if (!value) return null
  const stripped = value.replace(/^\$/u, '').replace(/;$/u, '').replace(/^eRingClass_/u, '')
  if (!stripped || stripped.toLocaleLowerCase() === 'none') return null
  return stripped
    .replace(/_/gu, ' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replace(/\b\w/gu, letter => letter.toLocaleUpperCase())
}

function explicitEliteState (source: Record<string, unknown>, field: string, emptyLabel: string): string | null {
  if (!Object.hasOwn(source, field)) return null
  return cleanEliteLabel(source[field]) ?? emptyLabel
}

function booleanField (candidate: unknown): boolean | null {
  return typeof candidate === 'boolean' ? candidate : null
}
