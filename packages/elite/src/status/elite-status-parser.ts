import {
  EliteGameStatusSchema,
  type EliteGameStatus,
  type EliteStatusFlags,
  type EliteStatusFlags2
} from '@phoenix/contracts'
import { z } from 'zod'

const EliteStatusFileSchema = z.object({
  timestamp: z.iso.datetime(),
  event: z.literal('Status'),
  Flags: z.number().int().nonnegative(),
  Flags2: z.number().int().nonnegative().optional().default(0),
  Pips: z.tuple([
    z.number().int().min(0).max(8),
    z.number().int().min(0).max(8),
    z.number().int().min(0).max(8)
  ]).optional(),
  FireGroup: z.number().int().nonnegative().optional(),
  GuiFocus: z.number().int().nonnegative().optional(),
  Fuel: z.object({
    FuelMain: z.number().finite().nonnegative(),
    FuelReservoir: z.number().finite().nonnegative()
  }).optional(),
  Cargo: z.number().finite().optional(),
  LegalState: z.string().min(1).optional(),
  BodyName: z.string().min(1).optional(),
  Latitude: z.number().finite().optional(),
  Longitude: z.number().finite().optional(),
  Heading: z.number().finite().optional(),
  Altitude: z.number().finite().optional(),
  PlanetRadius: z.number().finite().optional(),
  Balance: z.number().finite().optional(),
  Destination: z.object({
    System: z.number().int().nonnegative(),
    Body: z.number().int().nonnegative(),
    Name: z.string()
  }).optional(),
  Oxygen: z.number().finite().optional(),
  Health: z.number().finite().optional(),
  Temperature: z.number().finite().optional(),
  SelectedWeapon: z.string().min(1).optional(),
  Gravity: z.number().finite().optional()
}).passthrough()

const FLAG_BITS = {
  docked: 0,
  landed: 1,
  landingGearDown: 2,
  shieldsUp: 3,
  supercruise: 4,
  flightAssistOff: 5,
  hardpointsDeployed: 6,
  inWing: 7,
  lightsOn: 8,
  cargoScoopDeployed: 9,
  silentRunning: 10,
  scoopingFuel: 11,
  srvHandbrake: 12,
  srvUsingTurretView: 13,
  srvTurretRetracted: 14,
  srvDriveAssist: 15,
  fsdMassLocked: 16,
  fsdCharging: 17,
  fsdCooldown: 18,
  lowFuel: 19,
  overheating: 20,
  hasLatitudeLongitude: 21,
  inDanger: 22,
  beingInterdicted: 23,
  inMainShip: 24,
  inFighter: 25,
  inSrv: 26,
  hudInAnalysisMode: 27,
  nightVision: 28,
  altitudeFromAverageRadius: 29,
  fsdJump: 30,
  srvHighBeam: 31
} as const satisfies Record<keyof EliteStatusFlags, number>

const FLAG2_BITS = {
  onFoot: 0,
  inTaxi: 1,
  inMulticrew: 2,
  onFootInStation: 3,
  onFootOnPlanet: 4,
  aimDownSight: 5,
  lowOxygen: 6,
  lowHealth: 7,
  cold: 8,
  hot: 9,
  veryCold: 10,
  veryHot: 11,
  glideMode: 12,
  onFootInHangar: 13,
  onFootSocialSpace: 14,
  onFootExterior: 15,
  breathableAtmosphere: 16,
  telepresenceMulticrew: 17,
  physicalMulticrew: 18,
  fsdHyperdriveCharging: 19,
  supercruiseOverdriveActive: 20,
  supercruiseAssistActive: 21
} as const satisfies Record<keyof EliteStatusFlags2, number>

const GUI_FOCUS_LABELS: Record<number, string> = {
  0: 'none',
  1: 'internal_panel',
  2: 'external_panel',
  3: 'comms_panel',
  4: 'role_panel',
  5: 'station_services',
  6: 'galaxy_map',
  7: 'system_map',
  8: 'orrery',
  9: 'fss',
  10: 'saa',
  11: 'codex'
}

export function parseEliteStatus (candidate: unknown): EliteGameStatus {
  const status = EliteStatusFileSchema.parse(candidate)
  return EliteGameStatusSchema.parse({
    timestamp: status.timestamp,
    rawFlags: status.Flags,
    rawFlags2: status.Flags2,
    flags: decodeFlags(status.Flags, FLAG_BITS),
    flags2: decodeFlags(status.Flags2, FLAG2_BITS),
    pips: status.Pips
      ? { systems: status.Pips[0], engines: status.Pips[1], weapons: status.Pips[2] }
      : null,
    fireGroup: status.FireGroup ?? null,
    guiFocus: status.GuiFocus === undefined
      ? null
      : { id: status.GuiFocus, label: GUI_FOCUS_LABELS[status.GuiFocus] ?? 'unknown' },
    fuel: status.Fuel
      ? { main: status.Fuel.FuelMain, reservoir: status.Fuel.FuelReservoir }
      : null,
    cargo: status.Cargo ?? null,
    legalState: status.LegalState ?? null,
    bodyName: status.BodyName ?? null,
    latitude: status.Latitude ?? null,
    longitude: status.Longitude ?? null,
    heading: status.Heading ?? null,
    altitude: status.Altitude ?? null,
    planetRadius: status.PlanetRadius ?? null,
    balance: status.Balance ?? null,
    destination: status.Destination
      ? {
          system: status.Destination.System,
          body: status.Destination.Body,
          name: status.Destination.Name
        }
      : null,
    oxygen: status.Oxygen ?? null,
    health: status.Health ?? null,
    temperature: status.Temperature ?? null,
    selectedWeapon: status.SelectedWeapon ?? null,
    gravity: status.Gravity ?? null
  })
}

function decodeFlags<T extends Record<string, number>> (
  value: number,
  definitions: T
): { [Key in keyof T]: boolean } {
  const bits = BigInt(value)
  return Object.fromEntries(
    Object.entries(definitions).map(([name, bit]) => [name, (bits & (1n << BigInt(bit))) !== 0n])
  ) as { [Key in keyof T]: boolean }
}
