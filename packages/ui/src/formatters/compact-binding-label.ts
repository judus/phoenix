const COMPACT_MODIFIERS: Readonly<Record<string, string>> = {
  leftalt: 'LA',
  leftcontrol: 'LC',
  leftmeta: 'LM',
  leftshift: 'LS',
  rightalt: 'RA',
  rightcontrol: 'RC',
  rightmeta: 'RM',
  rightshift: 'RS'
}

export function compactBindingLabel(binding: string): string {
  return binding.split('+').map(part => {
    const token = part.trim()
    return COMPACT_MODIFIERS[token.toLowerCase()] ?? token.replace(/^Numpad_/iu, 'NP_')
  }).join('+')
}
