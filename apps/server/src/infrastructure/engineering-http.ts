import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  EngineeringProjectCreateRequestSchema,
  EngineeringProjectStepCreateRequestSchema,
  EngineeringProjectUpdateRequestSchema
} from '@phoenix/contracts'
import type { EngineeringDataReader } from '../application/engineering-data-service.js'
import type { EngineeringProjects } from '../domain/engineering-projects.js'
import { readValidatedJsonBody, writeJson } from './http-json.js'

export interface EngineeringHttpServices {
  engineering: EngineeringDataReader
  engineeringProjects: EngineeringProjects
}

/** Called only after the server's pairing and delegated Control Deck checks. */
export async function handleEngineeringRequest (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: EngineeringHttpServices
): Promise<boolean> {
  if (request.method === 'GET' && url.pathname === '/api/engineering/engineers') {
    writeJson(response, 200, services.engineering.getEngineers())
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/engineering/materials') {
    const category = url.searchParams.get('category')
    if (category !== null && !isEngineeringMaterialCategory(category)) {
      writeJson(response, 400, {
        error: { code: 'invalid_material_category', message: `Unknown material category: ${category}.` }
      })
      return true
    }
    writeJson(response, 200, services.engineering.getMaterials(category ?? undefined))
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/engineering/blueprints') {
    writeJson(response, 200, services.engineering.getBlueprints())
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/engineering/projects') {
    writeJson(response, 200, services.engineeringProjects.getAll())
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/engineering/projects') {
    const input = await readValidatedJsonBody(request, EngineeringProjectCreateRequestSchema)
    writeJson(response, 201, services.engineeringProjects.create(input))
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/engineering/material-watchlist') {
    writeJson(response, 200, services.engineeringProjects.getMaterialWatchlist())
    return true
  }

  const engineeringProjectMatch = url.pathname.match(/^\/api\/engineering\/projects\/([^/]+)$/u)
  if (engineeringProjectMatch && request.method === 'PUT') {
    const input = await readValidatedJsonBody(request, EngineeringProjectUpdateRequestSchema)
    writeJson(response, 200, services.engineeringProjects.update(decodeURIComponent(engineeringProjectMatch[1]!), input))
    return true
  }

  if (engineeringProjectMatch && request.method === 'DELETE') {
    services.engineeringProjects.delete(decodeURIComponent(engineeringProjectMatch[1]!))
    response.writeHead(204)
    response.end()
    return true
  }

  const engineeringProjectStepsMatch = url.pathname.match(/^\/api\/engineering\/projects\/([^/]+)\/steps$/u)
  if (engineeringProjectStepsMatch && request.method === 'POST') {
    const input = await readValidatedJsonBody(request, EngineeringProjectStepCreateRequestSchema)
    writeJson(response, 201, services.engineeringProjects.addStep(decodeURIComponent(engineeringProjectStepsMatch[1]!), input))
    return true
  }

  const engineeringProjectStepMatch = url.pathname.match(/^\/api\/engineering\/projects\/([^/]+)\/steps\/([^/]+)$/u)
  if (engineeringProjectStepMatch && request.method === 'DELETE') {
    writeJson(response, 200, services.engineeringProjects.deleteStep(
      decodeURIComponent(engineeringProjectStepMatch[1]!),
      decodeURIComponent(engineeringProjectStepMatch[2]!)
    ))
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/engineering/experimental-effects') {
    writeJson(response, 200, services.engineering.getExperimentalEffects())
    return true
  }

  const engineeringBlueprintMatch = url.pathname.match(/^\/api\/engineering\/blueprints\/([^/]+)$/u)
  if (request.method === 'GET' && engineeringBlueprintMatch) {
    const blueprint = services.engineering.getBlueprint(decodeURIComponent(engineeringBlueprintMatch[1]!))
    if (!blueprint) {
      writeJson(response, 404, {
        error: { code: 'blueprint_not_found', message: 'Engineering blueprint not found.' }
      })
      return true
    }
    writeJson(response, 200, blueprint)
    return true
  }

  return false
}

function isEngineeringMaterialCategory (
  candidate: string
): candidate is 'raw' | 'manufactured' | 'encoded' | 'xeno' {
  return ['raw', 'manufactured', 'encoded', 'xeno'].includes(candidate)
}
