import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  EliteBindingsDirectoryLocator,
  EliteKeyboardBindingResolver
} from '@phoenix/elite'

test('the binding resolver selects the active latest preset and resolves keyboard chords', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-bindings-'))
  writeFileSync(join(directory, 'StartPreset.4.start'), 'ControllerPreset\nCustom\n')
  writeFileSync(join(directory, 'Custom.4.1.binds'), bindingsXml('Key_F1'))
  writeFileSync(join(directory, 'Custom.4.2.binds'), bindingsXml('Key_Numpad_9'))
  const resolver = new EliteKeyboardBindingResolver(directory)

  try {
    expect(resolver.getDiagnostics()).toMatchObject({
      directory,
      filePath: join(directory, 'Custom.4.2.binds'),
      presetNames: ['Custom', 'ControllerPreset'],
      available: true,
      bindingCount: 3,
      keyboardBindingCount: 2,
      error: null
    })
    expect(resolver.resolve('NightVisionToggle')).toEqual({
      key: 'Numpad_9',
      modifiers: [],
      display: 'Numpad_9'
    })
    expect(resolver.resolve('LandingGearToggle')).toEqual({
      key: 'G',
      modifiers: ['LeftShift', 'RightAlt'],
      display: 'LeftShift+RightAlt+G'
    })
    expect(resolver.resolve('FireChaffLauncher')).toBeNull()
    expect(resolver.listCommands()).toEqual([
      'FireChaffLauncher',
      'LandingGearToggle',
      'NightVisionToggle'
    ])
    expect(resolver.listBindings()).toEqual([
      {
        eliteBinding: 'LandingGearToggle',
        binding: { key: 'G', modifiers: ['LeftShift', 'RightAlt'], display: 'LeftShift+RightAlt+G' }
      },
      {
        eliteBinding: 'NightVisionToggle',
        binding: { key: 'Numpad_9', modifiers: [], display: 'Numpad_9' }
      }
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the bindings locator derives the options directory from the Elite data directory', () => {
  const profile = mkdtempSync(join(tmpdir(), 'phoenix-elite-profile-'))
  const eliteDataDirectory = join(profile, 'Saved Games', 'Frontier Developments', 'Elite Dangerous')
  const bindingsDirectory = join(
    profile,
    'AppData',
    'Local',
    'Frontier Developments',
    'Elite Dangerous',
    'Options',
    'Bindings'
  )
  mkdirSync(eliteDataDirectory, { recursive: true })
  mkdirSync(bindingsDirectory, { recursive: true })

  try {
    expect(new EliteBindingsDirectoryLocator({ eliteDataDirectory }).locate()).toBe(bindingsDirectory)
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
})

function bindingsXml (nightVisionKey: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Root PresetName="Custom" MajorVersion="4" MinorVersion="2">
  <NightVisionToggle>
    <Primary Device="Controller" Key="Joy_1" />
    <Secondary Device="Keyboard" Key="${nightVisionKey}" />
  </NightVisionToggle>
  <LandingGearToggle>
    <Primary Device="Keyboard" Key="Key_G">
      <Modifier Device="Keyboard" Key="Key_LeftShift" />
      <Modifier Device="Keyboard" Key="Key_RightAlt" />
    </Primary>
    <Secondary Device="{NoDevice}" Key="" />
  </LandingGearToggle>
  <FireChaffLauncher>
    <Primary Device="Controller" Key="Joy_2" />
    <Secondary Device="{NoDevice}" Key="" />
  </FireChaffLauncher>
</Root>`
}
