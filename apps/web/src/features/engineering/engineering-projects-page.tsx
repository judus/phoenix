import type { EngineeringMaterialWatchlistResponse, EngineeringProject } from '@phoenix/contracts'
import { Button, DataTable, DataTableGroup, PageFrame, Stack, Status } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import { formatPhoenixDateTime } from '../../components/phoenix-date-time.js'
import { EngineeringHeader } from './engineering-header.js'
import { engineeringProjectRoutes } from './engineering-navigation.js'

export function EngineeringProjectsPage ({ onNavigate, projects, watchlist }: {
  onNavigate(route: PhoenixRoute): void
  projects: EngineeringProject[]
  watchlist?: EngineeringMaterialWatchlistResponse
}) {
  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <EngineeringHeader title="Engineering projects" trail={[{ label: 'Projects' }]} />
        <Stack className="engineering-scroll-content" gap="sm">
          <DataTableGroup
            actions={<Button size="sm" variant="outline" onClick={() => onNavigate(engineeringProjectRoutes.new())}>New project</Button>}
            title="Project ledger"
          >
            {projects.length > 0
              ? (
                  <DataTable density="compact" label="Engineering projects" minimum="wide" narrow="priority" scheme="surface">
                    <thead><tr><th>Project</th><th>Status</th><th>Priority</th><th>Plan</th><th>Still needed</th><th>Updated</th></tr></thead>
                    <tbody>{projects.map(project => {
                      const missing = missingForProject(project, watchlist)
                      return (
                        <tr key={project.id}>
                          <td className="wrap"><a href={phoenixRouteHash(engineeringProjectRoutes.detail(project.id))}><strong>{project.name}</strong></a>{project.note ? <small>{project.note}</small> : null}</td>
                          <td>{capitalize(project.status)}</td>
                          <td>{capitalize(project.priority)}</td>
                          <td>{project.steps.length} {project.steps.length === 1 ? 'step' : 'steps'}</td>
                          <td>{project.status !== 'active'
                            ? '—'
                            : missing.units > 0
                              ? <><strong>{missing.units} units</strong><small>{missing.materials} {missing.materials === 1 ? 'material' : 'materials'}</small></>
                              : 'Ready'}</td>
                          <td>{formatPhoenixDateTime(project.updatedAt)}</td>
                        </tr>
                      )
                    })}</tbody>
                  </DataTable>
                )
              : <Status tone="muted">No engineering projects. Create one, then add blueprints from the catalogue.</Status>}
          </DataTableGroup>
        </Stack>
      </Stack>
    </PageFrame>
  )
}

function missingForProject (project: EngineeringProject, watchlist?: EngineeringMaterialWatchlistResponse): { materials: number, units: number } {
  if (!watchlist || project.status !== 'active') return { materials: 0, units: 0 }
  const required = new Map<string, number>()
  for (const step of project.steps) {
    for (const material of step.requirements) required.set(material.materialId, (required.get(material.materialId) ?? 0) + material.required)
  }
  let materials = 0
  let units = 0
  for (const [materialId, quantity] of required) {
    const watched = watchlist.materials.find(material => material.materialId === materialId && material.projects.some(candidate => candidate.id === project.id))
    const missing = watched ? Math.max(0, quantity - watched.owned) : 0
    if (missing > 0) materials += 1
    units += missing
  }
  return { materials, units }
}

function capitalize (value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
