import { expect, test } from 'vitest'
import { galaxyMapBindingWarnings } from '../apps/server/src/infrastructure/galaxy-map-binding-diagnostics.js'

const source = {
  resolve: (action: string) => action === 'UI_Up' ? { key: 'W', modifiers: [], display: 'W' } : null
}

test('detects the automated UI key in either Galaxy Map camera slot, ignoring free camera controls', () => {
  const xml = `<Root>
    <CamTranslateForward><Primary Device="Keyboard" Key="Key_W" /></CamTranslateForward>
    <CamPitchUp><Primary Device="Keyboard" Key="Key_T" /><Secondary Device="Keyboard" Key="Key_W" /></CamPitchUp>
    <FreeCamForward><Primary Device="Keyboard" Key="Key_W" /></FreeCamForward>
  </Root>`
  expect(galaxyMapBindingWarnings(xml, source)).toEqual([
    'UI_Up (W) also activates Galaxy Map camera control CamTranslateForward. Assign different keys in Elite.',
    'UI_Up (W) also activates Galaxy Map camera control CamPitchUp. Assign different keys in Elite.'
  ])
})

test('compares modifiers and ignores controller-only bindings and unused UI alternatives', () => {
  const xml = `<Root>
    <UI_Up><Primary Device="Keyboard" Key="Key_W" /><Secondary Device="Keyboard" Key="Key_UpArrow" /></UI_Up>
    <CamTranslateForward><Primary Device="Keyboard" Key="Key_W"><Modifier Device="Keyboard" Key="Key_LeftShift" /></Primary></CamTranslateForward>
    <CamPitchUp><Primary Device="Keyboard" Key="Key_UpArrow" /></CamPitchUp>
    <CamYawLeft><Primary Device="Joystick" Key="Key_W" /></CamYawLeft>
    <CamYawRight><Primary Device="Keyboard" Key="Key_W"><Modifier Device="Joystick" Key="Joy_1" /></Primary></CamYawRight>
  </Root>`
  expect(galaxyMapBindingWarnings(xml, source)).toEqual([])
})

test('matches equivalent modifier order and key case without duplicate warnings', () => {
  const slot = '<Primary Device="Keyboard" Key="Key_W"><Modifier Device="Keyboard" Key="Key_LeftControl" /><Modifier Device="Keyboard" Key="Key_LeftShift" /></Primary>'
  const xml = `<Root><CamTranslateForward>${slot}${slot.replaceAll('Primary', 'Secondary')}</CamTranslateForward></Root>`
  const warnings = galaxyMapBindingWarnings(xml, {
    resolve: action => action === 'UI_Up' ? { key: 'w', modifiers: ['LeftShift', 'LeftControl'], display: 'LeftShift+LeftControl+W' } : null
  })
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('CamTranslateForward')
})

test('rejects malformed or unrelated XML instead of reporting a clean check', () => {
  expect(() => galaxyMapBindingWarnings('<Root><broken>', source)).toThrow()
  expect(() => galaxyMapBindingWarnings('<Other />', source)).toThrow('Invalid Elite bindings file.')
})
