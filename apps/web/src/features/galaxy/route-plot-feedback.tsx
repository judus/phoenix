import { useEffect, useId, useRef } from 'react'
import type { PlotEliteDestinationResult } from '@phoenix/contracts'
import { Button, Status } from '@phoenix/ui'

export function RoutePlotFeedback({ result }: { result: PlotEliteDestinationResult }) {
  const id = useId()
  const popover = useRef<HTMLDivElement>(null)
  const failed = result.status !== 'confirmed'
  const warnings = result.bindingWarnings ?? []
  useEffect(() => {
    if (failed) popover.current?.showPopover()
  }, [result, failed])

  if (!failed) return <Status className="system-query__status" tone="positive" wrap>{result.message}</Status>
  return <>
    <Button type="button" variant="danger" size="sm" popoverTarget={id}>Route plotting failed</Button>
    <div className="route-plot-error" id={id} popover="auto" ref={popover} role="dialog" aria-labelledby={`${id}-title`}>
      <header>
        <h2 id={`${id}-title`}>Route plotting failed</h2>
        <Button type="button" size="sm" popoverTarget={id} popoverTargetAction="hide" aria-label="Close route plotting error">Close</Button>
      </header>
      <div role="alert">
        <p>PHOENIX could not complete route plotting to <strong>{result.requestedSystem}</strong>.</p>
        <p>{destinationPhaseLabel(result.phase)}: {result.message}</p>
        {warnings.length > 0 && <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        <p>Check that UI navigation keys do not also move the Galaxy Map camera. In the Galaxy Map route options, select <strong>Fastest routes</strong>; Economical routes can result in “Route unavailable”.</p>
        <p><a href="#/settings/help?topic=route-plotting">Settings → Help: Route plotting setup</a></p>
      </div>
    </div>
  </>
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
