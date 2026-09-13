import { randomUUID } from 'node:crypto'
import {
  EngineeringMaterialWatchlistResponseSchema,
  EngineeringProjectCreateRequestSchema,
  EngineeringProjectSchema,
  EngineeringProjectsChangedSchema,
  EngineeringProjectsResponseSchema,
  EngineeringProjectStepCreateRequestSchema,
  EngineeringProjectUpdateRequestSchema,
  type EngineeringMaterial,
  type EngineeringMaterialWatchItem,
  type EngineeringMaterialWatchlistResponse,
  type EngineeringProject,
  type EngineeringProjectCreateRequest,
  type EngineeringProjectsChanged,
  type EngineeringProjectsResponse,
  type EngineeringProjectStepCreateRequest,
  type EngineeringProjectUpdateRequest
} from '@phoenix/contracts'
import type { EngineeringCatalogue } from '@phoenix/elite'
import type { EngineeringProjectRepository, EngineeringProjects } from '../domain/engineering-projects.js'
import type { Publisher } from '../domain/publisher.js'
import type { EngineeringDataReader } from './engineering-data-service.js'

const priorityRank = { high: 0, normal: 1, low: 2 } as const

export class EngineeringProjectService implements EngineeringProjects {
  public constructor (
    private readonly repository: EngineeringProjectRepository,
    private readonly catalogue: EngineeringCatalogue,
    private readonly engineeringData: EngineeringDataReader,
    private readonly updates: Publisher<EngineeringProjectsChanged> & { subscribe: EngineeringProjects['subscribe'] },
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  public create (input: EngineeringProjectCreateRequest): EngineeringProject {
    const validated = EngineeringProjectCreateRequestSchema.parse(input)
    const timestamp = this.now().toISOString()
    const project = EngineeringProjectSchema.parse({
      schemaVersion: 1,
      id: this.createId(),
      ...validated,
      note: validated.note || null,
      status: 'active',
      steps: [],
      createdAt: timestamp,
      updatedAt: timestamp
    })
    return this.save(project)
  }

  public update (id: string, input: EngineeringProjectUpdateRequest): EngineeringProject {
    const existing = this.requiredProject(id)
    const validated = EngineeringProjectUpdateRequestSchema.parse(input)
    return this.save(EngineeringProjectSchema.parse({
      ...existing,
      ...validated,
      note: validated.note || null,
      updatedAt: this.now().toISOString()
    }))
  }

  public delete (id: string): void {
    if (!this.repository.getProject(id)) return
    this.repository.deleteProject(id)
    this.publishChange()
  }

  public addStep (projectId: string, input: EngineeringProjectStepCreateRequest): EngineeringProject {
    const project = this.requiredProject(projectId)
    const validated = EngineeringProjectStepCreateRequestSchema.parse(input)
    const blueprint = this.catalogue.getBlueprint(validated.blueprintSymbol)
    if (!blueprint) throw new Error(`Engineering blueprint ${validated.blueprintSymbol} does not exist.`)
    const grade = blueprint.grades.find(candidate => candidate.grade === validated.targetGrade)
    if (!grade) throw new Error(`${blueprint.displayName} does not have grade ${validated.targetGrade}.`)
    const materials = materialIndex(this.engineeringData.getMaterials().materials)
    const step = {
      id: this.createId(),
      kind: 'blueprint' as const,
      blueprintSymbol: blueprint.symbol,
      blueprintName: blueprint.displayName,
      moduleNames: blueprint.moduleNames,
      targetGrade: validated.targetGrade,
      plannedRolls: validated.plannedRolls,
      note: validated.note || null,
      requirements: grade.components.map(component => {
        const material = materials.get(normalize(component.name))
        return {
          materialId: material?.id ?? normalize(component.name),
          materialName: component.name,
          category: material?.category ?? null,
          grade: material?.grade ?? null,
          unitCost: component.cost,
          required: component.cost * validated.plannedRolls
        }
      }),
      createdAt: this.now().toISOString()
    }
    return this.save(EngineeringProjectSchema.parse({
      ...project,
      steps: [...project.steps, step],
      updatedAt: this.now().toISOString()
    }))
  }

  public deleteStep (projectId: string, stepId: string): EngineeringProject {
    const project = this.requiredProject(projectId)
    if (!project.steps.some(step => step.id === stepId)) throw new Error(`Engineering project step ${stepId} does not exist.`)
    return this.save(EngineeringProjectSchema.parse({
      ...project,
      steps: project.steps.filter(step => step.id !== stepId),
      updatedAt: this.now().toISOString()
    }))
  }

  public getAll (): EngineeringProjectsResponse {
    return EngineeringProjectsResponseSchema.parse({ schemaVersion: 1, projects: this.repository.listProjects() })
  }

  public getMaterialWatchlist (): EngineeringMaterialWatchlistResponse {
    const projects = this.repository.listProjects().filter(project => project.status === 'active')
    const observed = this.engineeringData.getMaterials()
    const owned = new Map(observed.materials.map(material => [normalize(material.id), material.count]))
    const aggregate = new Map<string, EngineeringMaterialWatchItem>()
    for (const project of projects) {
      for (const step of project.steps) {
        for (const requirement of step.requirements) {
          const key = normalize(requirement.materialId)
          const current = aggregate.get(key)
          const projectsById = new Map((current?.projects ?? []).map(item => [item.id, item]))
          projectsById.set(project.id, { id: project.id, name: project.name })
          aggregate.set(key, {
            materialId: requirement.materialId,
            materialName: requirement.materialName,
            category: requirement.category,
            grade: requirement.grade,
            owned: owned.get(key) ?? 0,
            required: (current?.required ?? 0) + requirement.required,
            missing: 1,
            projectCount: projectsById.size,
            stepCount: (current?.stepCount ?? 0) + 1,
            highestPriority: !current || priorityRank[project.priority] < priorityRank[current.highestPriority]
              ? project.priority
              : current.highestPriority,
            projects: [...projectsById.values()]
          })
        }
      }
    }
    const materials = [...aggregate.values()]
      .map(material => ({ ...material, missing: Math.max(0, material.required - material.owned) }))
      .filter((material): material is EngineeringMaterialWatchItem => material.missing > 0)
      .sort((left, right) => priorityRank[left.highestPriority] - priorityRank[right.highestPriority] ||
        right.projectCount - left.projectCount || right.missing - left.missing || left.materialName.localeCompare(right.materialName))
    return EngineeringMaterialWatchlistResponseSchema.parse({
      schemaVersion: 1,
      observedAt: observed.updatedAt,
      activeProjectCount: projects.length,
      materials
    })
  }

  public subscribe (listener: (message: EngineeringProjectsChanged) => void): () => void {
    return this.updates.subscribe(listener)
  }

  private requiredProject (id: string): EngineeringProject {
    const project = this.repository.getProject(id)
    if (!project) throw new Error(`Engineering project ${id} does not exist.`)
    return project
  }

  private save (project: EngineeringProject): EngineeringProject {
    this.repository.putProject(project)
    this.publishChange()
    return project
  }

  private publishChange (): void {
    this.updates.publish(EngineeringProjectsChangedSchema.parse({ schemaVersion: 1, changedAt: this.now().toISOString() }))
  }
}

function materialIndex (materials: EngineeringMaterial[]): Map<string, EngineeringMaterial> {
  return new Map(materials.flatMap(material => [
    [normalize(material.id), material] as const,
    [normalize(material.name), material] as const
  ]))
}

function normalize (value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
}
