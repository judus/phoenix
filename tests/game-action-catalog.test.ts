import { expect, test } from 'vitest'
import {
  GameActionBindingSourceDiagnosticsSchema,
  type LogicalInputChord,
  type ResolvedGameActionBinding
} from '@phoenix/contracts'
import type { GameActionBindingResolver } from '../apps/server/src/domain/game-actions.js'
import { DefaultGameActionCatalog } from '../apps/server/src/infrastructure/default-game-action-catalog.js'

test('the action catalogue discovers dashboard commands including unbound controls', () => {
  const catalog = new DefaultGameActionCatalog(new StubBindings([
    'ShipSpotLightToggle',
    'FireChaffLauncher',
    'EjectAllCargo',
    'HumanoidForwardButton',
    'YawAxisRaw',
    'VanityCameraOne'
  ], {
    ShipSpotLightToggle: chord('L'),
    HumanoidForwardButton: chord('W')
  }))

  expect(catalog.list().map(action => action.eliteBinding)).toEqual([
    'ShipSpotLightToggle',
    'FireChaffLauncher',
    'EjectAllCargo',
    'HumanoidForwardButton'
  ])
  expect(catalog.find('elite.ShipSpotLightToggle')).toMatchObject({
    label: 'Ship Lights',
    category: 'ship',
    telemetryKey: 'lightsOn'
  })
  expect(catalog.find('elite.FireChaffLauncher')).toMatchObject({
    label: 'Chaff',
    category: 'combat',
    inputMode: 'tap'
  })
  expect(catalog.find('elite.EjectAllCargo')).toMatchObject({ risk: 'dangerous' })
  expect(catalog.find('elite.HumanoidForwardButton')).toMatchObject({
    category: 'on_foot',
    inputMode: 'hold'
  })
})

test('the action catalogue describes GalNet Audio commands as radio controls', () => {
  const catalogue = new DefaultGameActionCatalog(new StubBindings([
    'GalnetAudio_Play_Pause',
    'GalnetAudio_SkipForward',
    'GalnetAudio_SkipBackward',
    'GalnetAudio_ClearQueue'
  ], {}))

  expect(catalogue.list()).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'elite.GalnetAudio_Play_Pause', label: 'GalNet Audio Play / Pause', category: 'radio' }),
    expect.objectContaining({ id: 'elite.GalnetAudio_SkipForward', label: 'GalNet Audio Next', category: 'radio' }),
    expect.objectContaining({ id: 'elite.GalnetAudio_SkipBackward', label: 'GalNet Audio Previous', category: 'radio' }),
    expect.objectContaining({ id: 'elite.GalnetAudio_ClearQueue', label: 'GalNet Audio Clear Queue', category: 'radio' })
  ]))
})

test('the action catalogue describes map bindings as state-unknown toggles', () => {
  const catalogue = new DefaultGameActionCatalog(new StubBindings([
    'GalaxyMapOpen',
    'SystemMapOpen'
  ], {}))

  expect(catalogue.find('elite.GalaxyMapOpen')).toMatchObject({
    label: 'Toggle Elite Galaxy Map',
    description: expect.stringContaining('does not navigate PHOENIX')
  })
  expect(catalogue.find('elite.SystemMapOpen')).toMatchObject({
    label: 'Toggle Elite System Map',
    description: expect.stringContaining('PHOENIX system schematic')
  })
})

class StubBindings implements GameActionBindingResolver {
  public constructor (
    private readonly commands: string[],
    private readonly bindings: Record<string, LogicalInputChord>
  ) {}

  public resolve (eliteBinding: string): LogicalInputChord | null {
    return this.bindings[eliteBinding] ?? null
  }

  public listBindings (): ResolvedGameActionBinding[] {
    return Object.entries(this.bindings).map(([eliteBinding, binding]) => ({ eliteBinding, binding }))
  }

  public listCommands (): string[] {
    return [...this.commands]
  }

  public getDiagnostics () {
    return GameActionBindingSourceDiagnosticsSchema.parse({
      directory: null,
      filePath: null,
      presetNames: [],
      available: true,
      bindingCount: this.commands.length,
      keyboardBindingCount: Object.keys(this.bindings).length,
      loadedAt: null,
      error: null
    })
  }
}

function chord (key: string): LogicalInputChord {
  return { key, modifiers: [], display: key }
}
