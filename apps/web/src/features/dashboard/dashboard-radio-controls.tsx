import { Metric, Stack } from '@phoenix/ui'
import type { GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'
import { GalnetRadioControls } from '../../components/galnet-radio-controls.js'

export function DashboardRadioControls({
  actionCatalog,
  onExecute
}: {
  actionCatalog?: GameActionCatalogResponse
  onExecute(actionId: string): Promise<GameActionResult>
}) {
  return (
    <Stack gap="sm" fill justify="space-between">
      <Metric value="GALNET RADIO" />
      <GalnetRadioControls actionCatalog={actionCatalog} onExecute={onExecute} />
    </Stack>
  )
}
