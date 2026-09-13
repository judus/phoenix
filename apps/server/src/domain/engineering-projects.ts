import type {
  EngineeringMaterialWatchlistResponse,
  EngineeringProject,
  EngineeringProjectCreateRequest,
  EngineeringProjectsChanged,
  EngineeringProjectsResponse,
  EngineeringProjectStepCreateRequest,
  EngineeringProjectUpdateRequest
} from '@phoenix/contracts'
import type { Subscribable } from './publisher.js'

export interface EngineeringProjectRepository {
  deleteProject(id: string): void
  getProject(id: string): EngineeringProject | null
  listProjects(): EngineeringProject[]
  putProject(project: EngineeringProject): void
}

export interface EngineeringProjects extends Subscribable<EngineeringProjectsChanged> {
  addStep(projectId: string, input: EngineeringProjectStepCreateRequest): EngineeringProject
  create(input: EngineeringProjectCreateRequest): EngineeringProject
  delete(id: string): void
  deleteStep(projectId: string, stepId: string): EngineeringProject
  getAll(): EngineeringProjectsResponse
  getMaterialWatchlist(): EngineeringMaterialWatchlistResponse
  update(id: string, input: EngineeringProjectUpdateRequest): EngineeringProject
}
