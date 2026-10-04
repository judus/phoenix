import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EngineeringExperimentalEffectsResponse,
  EngineeringBlueprintDetail,
  EngineeringBlueprintsResponse,
  EngineeringEngineersResponse,
  EngineeringMaterialWatchlistResponse,
  EngineeringProject,
  EngineeringProjectCreateRequest,
  EngineeringProjectsResponse,
  EngineeringProjectStepCreateRequest,
  EngineeringProjectUpdateRequest,
  EngineeringMaterialsResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../../application/cache/controller-snapshot-cache.js'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'

export type EngineeringRoute = Extract<InformationRoute, { section: 'engineering' }>
export type EngineeringView = EngineeringRoute['view']

export interface EngineeringControllerActions {
  addStep(projectId: string, input: EngineeringProjectStepCreateRequest): Promise<EngineeringProject>
  createProject(input: EngineeringProjectCreateRequest): Promise<EngineeringProject>
  deleteProject(id: string): Promise<void>
  deleteStep(projectId: string, stepId: string): Promise<EngineeringProject>
  updateProject(id: string, input: EngineeringProjectUpdateRequest): Promise<EngineeringProject>
}

export interface EngineeringControllerSnapshot {
  effects?: EngineeringExperimentalEffectsResponse
  actions?: EngineeringControllerActions
  blueprint?: EngineeringBlueprintDetail
  blueprints?: EngineeringBlueprintsResponse
  engineers?: EngineeringEngineersResponse
  error?: string
  materials?: EngineeringMaterialsResponse
  projects?: EngineeringProjectsResponse
  watchlist?: EngineeringMaterialWatchlistResponse
  status: 'idle' | 'loading' | 'ready' | 'error'
}

export function useEngineeringController(
  api: PhoenixApi,
  route: EngineeringRoute,
  refreshKey?: number | string,
  events?: PhoenixEventHub
): EngineeringControllerSnapshot {
  const { view } = route
  const selectedBlueprintSymbol = route.view === 'blueprints' || route.view === 'project-add-blueprint'
    ? route.selectedBlueprintSymbol
    : undefined
  const selectedProjectId = route.view === 'project-detail' || route.view === 'project-add-blueprint'
    ? route.selectedProjectId
    : undefined
  const cacheKey = `engineering:${view}:${selectedBlueprintSymbol ?? ''}:${selectedProjectId ?? ''}`
  const [projectRevision, setProjectRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const failedRequest = useRef(false)
  const [snapshot, setSnapshot] = useState<EngineeringControllerSnapshot>(() =>
    readControllerSnapshot(api, cacheKey) ?? { status: 'idle' }
  )

  const replaceProject = useCallback((project: EngineeringProject): void => {
    setSnapshot(current => ({
      ...current,
      projects: current.projects
        ? { ...current.projects, projects: current.projects.projects.map(candidate => candidate.id === project.id ? project : candidate) }
        : current.projects,
      status: 'ready'
    }))
  }, [])

  const actions: EngineeringControllerActions = {
    addStep: async (projectId, input) => {
      const project = await api.addEngineeringProjectStep(projectId, input)
      replaceProject(project)
      return project
    },
    createProject: async input => {
      const project = await api.createEngineeringProject(input)
      setSnapshot(current => ({
        ...current,
        projects: current.projects
          ? { ...current.projects, projects: [project, ...current.projects.projects] }
          : { schemaVersion: 1, projects: [project] },
        status: 'ready'
      }))
      return project
    },
    deleteProject: async id => {
      await api.deleteEngineeringProject(id)
      setSnapshot(current => ({
        ...current,
        projects: current.projects
          ? { ...current.projects, projects: current.projects.projects.filter(project => project.id !== id) }
          : current.projects
      }))
    },
    deleteStep: async (projectId, stepId) => {
      const project = await api.deleteEngineeringProjectStep(projectId, stepId)
      replaceProject(project)
      return project
    },
    updateProject: async (id, input) => {
      const project = await api.updateEngineeringProject(id, input)
      replaceProject(project)
      return project
    }
  }

  useEffect(() => events?.subscribe('engineering-projects-changed', () => setProjectRevision(value => value + 1)), [events])
  useEffect(() => events?.subscribe('runtime-state', () => {
    // Preserve recovery on the next live event after a transient failure. Clear
    // synchronously so a burst cannot queue retries while one request is pending.
    if (!failedRequest.current) return
    failedRequest.current = false
    setRetryRevision(value => value + 1)
  }), [events])

  useEffect(() => {
    const abort = new AbortController()
    failedRequest.current = false
    const retained = readControllerSnapshot<EngineeringControllerSnapshot>(api, cacheKey)
    setSnapshot(current => ({ ...(retained ?? current), actions, status: retained?.status ?? (current.status === 'ready' ? 'ready' : 'loading') }))
    const request = loadEngineeringView(api, route, abort.signal)
    void request.then(result => {
      if (!abort.signal.aborted) setSnapshot(storeControllerSnapshot(api, cacheKey, { ...result, status: 'ready' }))
    }).catch(cause => {
      if (!abort.signal.aborted) {
        failedRequest.current = true
        const error = cause instanceof Error ? cause.message : 'Engineering data unavailable.'
        setSnapshot(current => current.status === 'ready' ? { ...current, actions, error } : { actions, error, status: 'error' })
      }
    })
    return () => {
      abort.abort()
      failedRequest.current = false
    }
  // The application supplies a view-specific runtime fingerprint. Project events
  // independently refresh repository-backed data; route/API lifetimes are unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cacheKey, projectRevision, refreshKey, retryRevision, selectedBlueprintSymbol, selectedProjectId, view])

  return { ...snapshot, actions }
}

function loadEngineeringView(
  api: PhoenixApi,
  route: EngineeringRoute,
  signal: AbortSignal
): Promise<Omit<EngineeringControllerSnapshot, 'actions' | 'error' | 'status'>> {
  switch (route.view) {
    case 'projects':
    case 'project-detail': {
      const projects = api.getEngineeringProjects(signal)
      return Promise.all([projects, api.getEngineeringMaterialWatchlist(signal)]).then(([projects, watchlist]) => ({ projects, watchlist }))
    }
    case 'experimental-effects': {
      const projects = api.getEngineeringProjects(signal)
      return Promise.all([api.getEngineeringExperimentalEffects(signal), projects]).then(([effects, projects]) => ({ effects, projects }))
    }
    case 'project-add-blueprint': {
      const projects = api.getEngineeringProjects(signal)
      return Promise.all([api.getEngineeringBlueprint(route.selectedBlueprintSymbol, signal), projects]).then(([blueprint, projects]) => ({ blueprint, projects }))
    }
    case 'project-new': return Promise.resolve({})
    case 'engineers': return api.getEngineeringEngineers(signal).then(engineers => ({ engineers }))
    case 'materials-raw':
    case 'materials-manufactured':
    case 'materials-encoded':
    case 'materials-xeno':
      return api.getEngineeringMaterials(route.view.slice('materials-'.length) as 'raw' | 'manufactured' | 'encoded' | 'xeno', signal).then(materials => ({ materials }))
    case 'blueprints':
      return route.selectedBlueprintSymbol
        ? api.getEngineeringBlueprint(route.selectedBlueprintSymbol, signal).then(blueprint => ({ blueprint }))
        : api.getEngineeringBlueprints(signal).then(blueprints => ({ blueprints }))
  }
}
