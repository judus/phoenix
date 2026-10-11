import type { PlotEliteDestinationResult } from '@phoenix/contracts'
import { Notification } from '@phoenix/ui'

export function RoutePlotFeedback({ result }: { result: PlotEliteDestinationResult }) {
  const failed = result.status !== 'confirmed'
  const warnings = result.bindingWarnings ?? []
  return <Notification tone={failed ? 'danger' : 'warning'}
    messages={failed ? [`Route plotting to ${result.requestedSystem} failed.`, `${destinationPhaseLabel(result.phase)}: ${result.message}`, ...warnings] : [result.message]}>
    {failed && <div>
      <p>Check that UI navigation keys do not also move the Galaxy Map camera. Select <strong>Fastest routes</strong>; Economical routes can result in “Route unavailable”.</p>
      <a href="#/settings/help?topic=route-plotting">Settings → Help: Route plotting setup</a>
    </div>}
  </Notification>
}

function destinationPhaseLabel (phase: PlotEliteDestinationResult['phase']): string {
  return {
    preflight: 'Preflight',
    open_map: 'Opening Galaxy Map',
    zoom_out: 'Zooming out',
    focus_search: 'Opening search',
    enter_destination: 'Entering destination',
    select_result: 'Selecting result',
    zoom_in: 'Zooming in',
    plot_route: 'Plotting route',
    confirm_route: 'Confirming route',
    close_map: 'Closing Galaxy Map'
  }[phase]
}
