export type PrimaryDesktop = 'controls' | 'info' | 'copilot'
export type UtilityDesktop = 'telemetry' | 'macros' | 'journal' | 'developer' | 'settings'
export type WorkspaceDesktop = PrimaryDesktop | UtilityDesktop

export function isWorkspaceDesktop(value: string): value is WorkspaceDesktop {
  return [
    'controls',
    'info',
    'copilot',
    'telemetry',
    'macros',
    'journal',
    'developer',
    'settings'
  ].includes(value)
}
