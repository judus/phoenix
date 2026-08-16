import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { SystemSearchQuery } from './tool-gateways.js'

export class SystemsSearchTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find community-reported galactic systems near the current or supplied reference system. Filter by maximum distance, population, primary economy, allegiance, government, or security. Results include population, controlling faction, primary-star subtype, permit status, and report time. Primary-star subtype is returned as metadata but is not a supported filter.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        allegiance: { minLength: 1, type: 'string' },
        economy: { minLength: 1, type: 'string' },
        government: { minLength: 1, type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        maxPopulation: { minimum: 0, type: 'integer' },
        minPopulation: { minimum: 0, type: 'integer' },
        population: { enum: ['any', 'inhabited', 'uninhabited'], type: 'string' },
        security: { minLength: 1, type: 'string' },
        systemName: { minLength: 1, type: 'string' }
      },
      type: 'object'
    },
    name: 'systems.search'
  }

  public constructor (private readonly systems: SystemSearchQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.systems.searchSystems(arguments_)
}
