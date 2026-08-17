import type { PhoenixApplicationServices } from '../../bootstrap/create-application.js'
import { CopilotPage } from './copilot-page.js'

export function CopilotFeature({ application, view }: { application: PhoenixApplicationServices, view: 'chat' | 'profiles' }) {
  return <CopilotPage api={application.api} clientIdentity={application.clientIdentity} events={application.events} view={view} />
}
