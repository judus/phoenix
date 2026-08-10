const LETTER_CODES: Record<string, number> = {
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23,
  J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19,
  S: 31, T: 20, U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44
}

const DIGIT_CODES: Record<string, number> = {
  '0': 11, '1': 2, '2': 3, '3': 4, '4': 5,
  '5': 6, '6': 7, '7': 8, '8': 9, '9': 10
}

const FUNCTION_CODES: Record<string, number> = {
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88
}

const SPECIAL_CODES: Record<string, number> = {
  Apostrophe: 40,
  BackSlash: 43,
  Backspace: 14,
  BackSpace: 14,
  CapsLock: 58,
  Comma: 51,
  Delete: 111,
  DownArrow: 108,
  End: 107,
  Enter: 28,
  Equals: 13,
  Escape: 1,
  ForwardSlash: 53,
  Home: 102,
  Insert: 110,
  LeftBracket: 26,
  LeftAlt: 56,
  LeftArrow: 105,
  LeftControl: 29,
  LeftShift: 42,
  Minus: 12,
  Numpad_0: 82,
  Numpad_1: 79,
  Numpad_2: 80,
  Numpad_3: 81,
  Numpad_4: 75,
  Numpad_5: 76,
  Numpad_6: 77,
  Numpad_7: 71,
  Numpad_8: 72,
  Numpad_9: 73,
  Numpad_Add: 78,
  Numpad_Decimal: 83,
  Numpad_Divide: 98,
  Numpad_Enter: 96,
  Numpad_Multiply: 55,
  Numpad_Subtract: 74,
  NumLock: 69,
  PageDown: 109,
  PageUp: 104,
  Period: 52,
  RightAlt: 100,
  RightBracket: 27,
  RightArrow: 106,
  RightControl: 97,
  RightShift: 54,
  ScrollLock: 70,
  SemiColon: 39,
  Space: 57,
  Tab: 15,
  UpArrow: 103
}

const ELITE_KEY_CODES: Record<string, number> = {
  ...LETTER_CODES,
  ...DIGIT_CODES,
  ...FUNCTION_CODES,
  ...SPECIAL_CODES
}

export function eliteKeyToLinuxCode (eliteKey: string): number {
  const code = ELITE_KEY_CODES[eliteKey]
  if (code === undefined) throw new Error(`Unsupported Elite keyboard key: ${eliteKey}.`)
  return code
}
