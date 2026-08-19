import { expect, test } from 'vitest'
import {
  LinuxXdotoolKeyboardOutput,
  WindowsSendInputKeyboardOutput,
  createPlatformKeyboardOutput
} from '@jdu/control-deck-adapter-keyboard'

test('standalone keyboard output selects the native implementation by operating system', () => {
  expect(createPlatformKeyboardOutput({ platform: 'linux' })).toBeInstanceOf(LinuxXdotoolKeyboardOutput)
  expect(createPlatformKeyboardOutput({ platform: 'win32' })).toBeInstanceOf(WindowsSendInputKeyboardOutput)

  const unsupported = createPlatformKeyboardOutput({ platform: 'darwin' })
  expect(unsupported.getStatus()).toMatchObject({ available: false, simulated: false })
  expect(unsupported.getStatus().detail).toContain('darwin')
})
