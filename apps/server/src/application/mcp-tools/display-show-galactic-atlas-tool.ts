import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { DisplayAtlasService } from '../display-atlas-service.js'

export class DisplayShowGalacticAtlasTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: true, readOnly: false },
    description: 'Show a system on the PHOENIX Galactic Atlas: centre the map and open its location details on connected PHOENIX displays. Use systemName from a Community Goal, GalNet lead, bookmark or other known destination; omit it for the commander’s current system. Coordinates are resolved by PHOENIX, not supplied by you. This is PHOENIX navigation, not the in-game Elite Dangerous Galaxy Map. Use display.open_page with page="galaxy.atlas" to open the Atlas without selecting a destination.',
    inputSchema: { additionalProperties: false, properties: { systemName: { type: 'string', minLength: 1 } }, type: 'object' },
    name: 'display.show_galactic_atlas'
  }
  public constructor (private readonly atlas: Pick<DisplayAtlasService, 'show'>) {}
  public readonly execute = (arguments_: JsonObject) => this.atlas.show(arguments_)
}
