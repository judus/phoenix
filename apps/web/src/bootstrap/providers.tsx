import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import { CopilotVoiceProvider } from '../features/copilot/copilot-voice-provider.js'
import { MacroRuntimeProvider } from '../features/macros/macro-runtime-provider.js'
import type { PhoenixApplicationServices } from './create-application.js'
import { NumpadActivation } from '../features/numpad/numpad-activation.js'

const PhoenixApplicationContext = createContext<PhoenixApplicationServices | undefined>(undefined)

export function PhoenixProviders({
  application,
  children
}: {
  application: PhoenixApplicationServices
  children: ReactNode
}) {
  useEffect(() => {
    const unsubscribeDisplay = application.events.subscribe('display-command', command => {
      if (!application.displayCommands.allowsRemoteCommands()) return
      application.router.push({
        kind: 'information',
        section: 'galaxy',
        view: 'system',
        systemName: command.systemName,
        ...(command.selectedName ? { selectedName: command.selectedName } : {})
      })
    })
    application.runtime.start()
    application.events.start()
    return () => {
      unsubscribeDisplay()
      application.runtime.stop()
      application.events.stop()
    }
  }, [application])

  return (
    <PhoenixApplicationContext.Provider value={application}>
      <NumpadActivation api={application.api} router={application.router} />
      <CopilotVoiceProvider
        api={application.api}
        clientIdentity={application.clientIdentity}
        events={application.events}
      >
        <MacroRuntimeProvider
          api={application.api}
          clientIdentity={application.clientIdentity}
          router={application.router}
        >
          {children}
        </MacroRuntimeProvider>
      </CopilotVoiceProvider>
    </PhoenixApplicationContext.Provider>
  )
}

export function usePhoenixApplication(): PhoenixApplicationServices {
  const application = useContext(PhoenixApplicationContext)
  if (!application) throw new Error('PhoenixProviders is missing from the application tree.')
  return application
}
