import type { LocalTool } from '@judus/llm-client'
import type { GameActions } from '../game-action-service.js'
import { emptyObjectSchema, json, output } from './tool-support.js'

export class ControlsGetStatusTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return configured Elite Dangerous actions, keyboard bindings, input modes, risk, and availability. Prefer controls.find_actions when only a few relevant actions are needed.',
    inputSchema: emptyObjectSchema(),
    name: 'controls.get_status'
  }

  public constructor (private readonly gameActions: GameActions) {}

  public readonly execute = () => {
    const catalogue = this.gameActions.getCatalog()
    return output(`Control catalogue: ${catalogue.actions.length} actions; ${catalogue.actions.filter(action => action.available).length} available.`, json(catalogue))
  }
}
