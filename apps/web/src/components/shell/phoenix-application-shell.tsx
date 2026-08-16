import type { ReactNode } from 'react'
import { ApplicationShell, BottomBar, Navigation, TopBar } from '@phoenix/ui'
import { DesktopWorkspace } from './desktop-workspace.js'
import { PhoenixBrand } from './phoenix-brand.js'
import { utilityItems, workspaceItems } from './navigation-model.js'
import {
  isWorkspaceDesktop,
  type PrimaryDesktop,
  type WorkspaceDesktop
} from './workspace-desktop.js'

export interface PhoenixApplicationShellProps {
  activeDesktop: WorkspaceDesktop
  controls: ReactNode
  copilot: ReactNode
  developer: ReactNode
  information: ReactNode
  journal: ReactNode
  macros: ReactNode
  onNavigate: (desktop: WorkspaceDesktop) => void
  settings: ReactNode
  telemetry: ReactNode
}

export function PhoenixApplicationShell({
  activeDesktop,
  controls,
  copilot,
  developer,
  information,
  journal,
  macros,
  onNavigate,
  settings,
  telemetry
}: PhoenixApplicationShellProps) {
  return (
    <ApplicationShell>
      <TopBar
        brand={<PhoenixBrand />}
        utilities={
          <Navigation
            variant="compact"
            label="Utilities"
            current={activeDesktop}
            items={utilityItems}
            onItemSelect={(item) => {
              if (item.id === 'fullscreen') {
                void toggleFullscreen()
                return
              }
              if (isWorkspaceDesktop(item.id)) onNavigate(item.id)
            }}
          />
        }
      />
      <DesktopWorkspace
        activeDesktop={activeDesktop}
        controls={controls}
        copilot={copilot}
        developer={developer}
        information={information}
        journal={journal}
        macros={macros}
        onNavigate={onNavigate}
        settings={settings}
        telemetry={telemetry}
      />
      <BottomBar>
        <Navigation
          variant="workspace"
          selection="subtle"
          label="Workspaces"
          current={activeDesktop}
          items={workspaceItems}
          onItemSelect={(item) => {
            if (isPrimaryDesktop(item.id)) onNavigate(item.id)
          }}
        />
      </BottomBar>
    </ApplicationShell>
  )
}

function isPrimaryDesktop(value: string): value is PrimaryDesktop {
  return value === 'controls' || value === 'info' || value === 'copilot'
}

async function toggleFullscreen(): Promise<void> {
  if (!document.fullscreenEnabled) return
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
}
