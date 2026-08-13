import {
  GameActionDefinitionSchema,
  type GameActionDefinition
} from '@phoenix/contracts'
import type { GameActionBindingResolver, GameActionCatalog } from '../domain/game-actions.js'

type ActionMetadata = Partial<Omit<GameActionDefinition, 'id' | 'eliteBinding'>>

const ACTION_METADATA: Readonly<Record<string, ActionMetadata>> = {
  ShipSpotLightToggle: {
    label: 'Ship Lights',
    description: 'Toggle the ship exterior lights.',
    telemetryKey: 'lightsOn'
  },
  NightVisionToggle: {
    label: 'Night Vision',
    description: 'Toggle ship night vision.',
    telemetryKey: 'nightVision'
  },
  ToggleCargoScoop: {
    label: 'Cargo Hatch',
    description: 'Toggle the ship cargo scoop.',
    telemetryKey: 'cargoScoopDeployed'
  },
  LandingGearToggle: {
    label: 'Landing Gear',
    description: 'Toggle the ship landing gear.',
    telemetryKey: 'landingGearDown'
  },
  DeployHardpointToggle: {
    label: 'Hardpoints',
    description: 'Deploy or retract the ship hardpoints.',
    category: 'combat',
    telemetryKey: 'hardpointsDeployed'
  },
  GalaxyMapOpen: { label: 'Galaxy Map', category: 'navigation' },
  SystemMapOpen: { label: 'System Map', category: 'navigation' },
  GalnetAudio_Play_Pause: {
    label: 'GalNet Audio Play / Pause',
    description: 'Toggle playback in the Elite Dangerous GalNet Audio player.',
    category: 'radio'
  },
  GalnetAudio_SkipForward: {
    label: 'GalNet Audio Next',
    description: 'Skip to the next item in the Elite Dangerous GalNet Audio queue.',
    category: 'radio'
  },
  GalnetAudio_SkipBackward: {
    label: 'GalNet Audio Previous',
    description: 'Return to the previous item in the Elite Dangerous GalNet Audio queue.',
    category: 'radio'
  },
  GalnetAudio_ClearQueue: {
    label: 'GalNet Audio Clear Queue',
    description: 'Clear the Elite Dangerous GalNet Audio playback queue.',
    category: 'radio'
  },
  TargetNextRouteSystem: { label: 'Next Route System', category: 'navigation' },
  CycleNextTarget: { label: 'Next Target', category: 'combat' },
  CyclePreviousTarget: { label: 'Previous Target', category: 'combat' },
  FireChaffLauncher: { label: 'Chaff', category: 'combat' },
  RecallDismissShip: { label: 'Recall / Dismiss Ship', category: 'vessel' },
  EjectAllCargo: { risk: 'dangerous' },
  EjectAllCargo_Buggy: { risk: 'dangerous', category: 'srv' },
  ChargeECM: { inputMode: 'hold', category: 'combat' },
  PrimaryFire: { inputMode: 'hold', category: 'combat' },
  SecondaryFire: { inputMode: 'hold', category: 'combat' },
  BuggyPrimaryFireButton: { inputMode: 'hold', category: 'srv' },
  BuggySecondaryFireButton: { inputMode: 'hold', category: 'srv' },
  HumanoidPrimaryFireButton: { inputMode: 'hold', category: 'on_foot' },
  HumanoidZoomButton: { inputMode: 'hold', category: 'on_foot' },
  ToggleDriveAssist: { label: 'Drive Assist', category: 'srv', telemetryKey: 'srvDriveAssist' },
  HumanoidToggleNightVisionButton: { label: 'Night Vision', category: 'on_foot' },
  HumanoidToggleFlashlightButton: { label: 'Flashlight', category: 'on_foot' }
}

export class DefaultGameActionCatalog implements GameActionCatalog {
  public constructor (private readonly bindings: GameActionBindingResolver) {}

  public find (actionId: string): GameActionDefinition | undefined {
    return this.actions().get(actionId)
  }

  public list (): GameActionDefinition[] {
    return [...this.actions().values()]
  }

  private actions (): Map<string, GameActionDefinition> {
    return new Map(this.bindings.listCommands().filter(isDashboardCommand).map(eliteBinding => {
      const action = discoveredAction(eliteBinding)
      return [action.id, action]
    }))
  }
}

function discoveredAction (eliteBinding: string): GameActionDefinition {
  const metadata = ACTION_METADATA[eliteBinding] ?? {}
  const label = metadata.label ?? formatActionLabel(eliteBinding)
  return GameActionDefinitionSchema.parse({
    id: `elite.${eliteBinding}`,
    label,
    description: metadata.description ?? `Execute the Elite Dangerous ${label} command.`,
    category: metadata.category ?? inferCategory(eliteBinding),
    inputMode: metadata.inputMode ?? inferInputMode(eliteBinding),
    risk: metadata.risk ?? inferRisk(eliteBinding),
    eliteBinding,
    telemetryKey: metadata.telemetryKey ?? null
  })
}

function inferCategory (name: string): GameActionDefinition['category'] {
  if (/Emote/.test(name)) return 'emote'
  if (/^MultiCrew|^Order|^TargetWingman|^WingNavLock/.test(name)) return 'vessel'
  if (/^GalnetAudio_|Comms|Microphone|FriendsMenu/.test(name)) return 'radio'
  if (/Humanoid|Store|Settlement|CommanderCreator/.test(name)) return 'on_foot'
  if (/Buggy|Vehicle|_Buggy$/.test(name)) return 'srv'
  if (/GalaxyMap|SystemMap|Route|Hyperspace|Supercruise|ExplorationFSS|ExplorationSAA/.test(name)) {
    return 'navigation'
  }
  if (/Fire|Weapon|Target|Hardpoint|Chaff|HeatSink|ShieldCell|ECM|SilentRunning/.test(name)) {
    return 'combat'
  }
  if (/Mouse|Camera|^Cam|HeadLook|UI_|Panel|HMD|Pause/.test(name)) return 'misc'
  return 'ship'
}

function inferInputMode (name: string): GameActionDefinition['inputMode'] {
  return /(?:Forward|Backward|StrafeLeft|StrafeRight|PitchUp|PitchDown|YawLeft|YawRight|RollLeft|RollRight|Thrust)Button(?:_Landing)?$/.test(name) ||
    /^(?:Cam|StoreCam).*(?:Up|Down|Left|Right|Forward|Backward|ZoomIn|ZoomOut)$/.test(name) ||
    /^(?:HumanoidSprintButton|HumanoidZoomButton|PrimaryFire|SecondaryFire)$/.test(name)
    ? 'hold'
    : 'tap'
}

function inferRisk (name: string): GameActionDefinition['risk'] {
  return /SelfDestruct|EjectAllCargo/.test(name) ? 'dangerous' : 'routine'
}

function formatActionLabel (name: string): string {
  return name
    .replace(/_Buggy$/, '')
    .replace(/^Humanoid/, '')
    .replace(/^Vehicle/, 'SRV ')
    .replace(/^Toggle/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bButton\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const STEERING_COMMAND_PATTERNS = [
  /Axis/,
  /Raw$/,
  /HeadLook/,
  /Headlook/i,
  /Camera/,
  /^Cam/,
  /^EnableCamera/,
  /^FixCamera/,
  /^FreeCam/,
  /^MoveFreeCam/,
  /^MovePlacementCam/,
  /^PhotoCamera/,
  /^PlacementCam/,
  /^PitchCamera/,
  /^PitchPlacementCamera/,
  /^QuitCamera/,
  /^RollCamera/,
  /^StoreCam/,
  /^StorePitchCamera/,
  /^StoreYawCamera/,
  /^ThrottleRangeFreeCam/,
  /^ToggleFreeCam/,
  /^ToggleReverseThrottleInputFreeCam/,
  /^VanityCamera/,
  /^YawCamera/,
  /^YawPlacementCamera/,
  /^CommanderCreator_Rotation/,
  /^SAAThirdPerson/,
  /^ExplorationFSSCamera/,
  /^ExplorationFSSRadioTuning/
]

function isDashboardCommand (name: string): boolean {
  return name !== '$' && !STEERING_COMMAND_PATTERNS.some(pattern => pattern.test(name))
}
