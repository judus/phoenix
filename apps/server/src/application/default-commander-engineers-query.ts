import type { JsonObject } from '@judus/llm-client'
import type { CommanderEngineersQuery } from './mcp-tools/tool-gateways.js'
import type { EngineeringDataReader } from './engineering-data-service.js'
import { json, output } from './mcp-tools/tool-support.js'

export class DefaultCommanderEngineersQuery implements CommanderEngineersQuery {
  public constructor (private readonly engineering: EngineeringDataReader) {}

  public listEngineers (_arguments: JsonObject) {
    const engineers = this.engineering.getEngineers().engineers
    return output(
      engineers.map(engineer => (
        `${engineer.name}: ${engineer.progress.status ?? 'locked'}; ${engineer.system.name}${engineer.distanceLy === null ? '' : `; ${engineer.distanceLy.toFixed(0)} Ly`}`
      )).join('\n'),
      json({ engineers })
    )
  }
}
