import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { PhoenixApplicationServices } from './create-application.js'

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
      {children}
    </PhoenixApplicationContext.Provider>
  )
}

export function usePhoenixApplication(): PhoenixApplicationServices {
  const application = useContext(PhoenixApplicationContext)
  if (!application) throw new Error('PhoenixProviders is missing from the application tree.')
  return application
}
