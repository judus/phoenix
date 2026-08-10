import { z } from 'zod'

const nullableNumber = z.number().finite().nullable()

export const EliteStatusFlagsSchema = z.object({
  docked: z.boolean(),
  landed: z.boolean(),
  landingGearDown: z.boolean(),
  shieldsUp: z.boolean(),
  supercruise: z.boolean(),
  flightAssistOff: z.boolean(),
  hardpointsDeployed: z.boolean(),
  inWing: z.boolean(),
  lightsOn: z.boolean(),
  cargoScoopDeployed: z.boolean(),
  silentRunning: z.boolean(),
  scoopingFuel: z.boolean(),
  srvHandbrake: z.boolean(),
  srvUsingTurretView: z.boolean(),
  srvTurretRetracted: z.boolean(),
  srvDriveAssist: z.boolean(),
  fsdMassLocked: z.boolean(),
  fsdCharging: z.boolean(),
  fsdCooldown: z.boolean(),
  lowFuel: z.boolean(),
  overheating: z.boolean(),
  hasLatitudeLongitude: z.boolean(),
  inDanger: z.boolean(),
  beingInterdicted: z.boolean(),
  inMainShip: z.boolean(),
  inFighter: z.boolean(),
  inSrv: z.boolean(),
  hudInAnalysisMode: z.boolean(),
  nightVision: z.boolean(),
  altitudeFromAverageRadius: z.boolean(),
  fsdJump: z.boolean(),
  srvHighBeam: z.boolean()
})

export const EliteStatusFlags2Schema = z.object({
  onFoot: z.boolean(),
  inTaxi: z.boolean(),
  inMulticrew: z.boolean(),
  onFootInStation: z.boolean(),
  onFootOnPlanet: z.boolean(),
  aimDownSight: z.boolean(),
  lowOxygen: z.boolean(),
  lowHealth: z.boolean(),
  cold: z.boolean(),
  hot: z.boolean(),
  veryCold: z.boolean(),
  veryHot: z.boolean(),
  glideMode: z.boolean(),
  onFootInHangar: z.boolean(),
  onFootSocialSpace: z.boolean(),
  onFootExterior: z.boolean(),
  breathableAtmosphere: z.boolean(),
  telepresenceMulticrew: z.boolean(),
  physicalMulticrew: z.boolean(),
  fsdHyperdriveCharging: z.boolean(),
  supercruiseOverdriveActive: z.boolean(),
  supercruiseAssistActive: z.boolean()
})

export const EliteGameStatusSchema = z.object({
  timestamp: z.iso.datetime(),
  rawFlags: z.number().int().nonnegative(),
  rawFlags2: z.number().int().nonnegative(),
  flags: EliteStatusFlagsSchema,
  flags2: EliteStatusFlags2Schema,
  pips: z.object({
    systems: z.number().int().min(0).max(8),
    engines: z.number().int().min(0).max(8),
    weapons: z.number().int().min(0).max(8)
  }).nullable(),
  fireGroup: z.number().int().nonnegative().nullable(),
  guiFocus: z.object({
    id: z.number().int().nonnegative(),
    label: z.string().min(1)
  }).nullable(),
  fuel: z.object({
    main: z.number().finite().nonnegative(),
    reservoir: z.number().finite().nonnegative()
  }).nullable(),
  cargo: nullableNumber,
  legalState: z.string().min(1).nullable(),
  bodyName: z.string().min(1).nullable(),
  latitude: nullableNumber,
  longitude: nullableNumber,
  heading: nullableNumber,
  altitude: nullableNumber,
  planetRadius: nullableNumber,
  balance: nullableNumber,
  destination: z.object({
    system: z.number().int().nonnegative(),
    body: z.number().int().nonnegative(),
    name: z.string()
  }).nullable(),
  oxygen: nullableNumber,
  health: nullableNumber,
  temperature: nullableNumber,
  selectedWeapon: z.string().min(1).nullable(),
  gravity: nullableNumber
})

export const EliteStatusSourceDiagnosticsSchema = z.object({
  directory: z.string().min(1).nullable(),
  filePath: z.string().min(1).nullable(),
  watching: z.boolean(),
  fileAvailable: z.boolean(),
  lastReadAt: z.iso.datetime().nullable(),
  lastGameTimestamp: z.iso.datetime().nullable(),
  error: z.string().min(1).nullable()
})

export type EliteGameStatus = z.infer<typeof EliteGameStatusSchema>
export type EliteStatusFlags = z.infer<typeof EliteStatusFlagsSchema>
export type EliteStatusFlags2 = z.infer<typeof EliteStatusFlags2Schema>
export type EliteStatusSourceDiagnostics = z.infer<typeof EliteStatusSourceDiagnosticsSchema>
