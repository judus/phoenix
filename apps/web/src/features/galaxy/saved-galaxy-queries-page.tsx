import { useEffect, useMemo, useState } from 'react'
import {
  Breadcrumbs,
  Button,
  DataTableGroup,
  IconButton,
  PageFrame,
  PageHeader,
  PencilIcon,
  SortableDataTable,
  Status,
  TrashIcon,
  type SortableDataTableColumn
} from '@phoenix/ui'
import type { SavedGalaxyQuery } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { createClientId } from '../../application/identity/client-identity.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { GALAXY_QUERY_CATALOGUE } from './galaxy-query-catalogue.js'

export function SavedGalaxyQueriesPage({ api, onNavigate }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
}) {
  const [queries, setQueries] = useState<SavedGalaxyQuery[]>()
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    void api.getSavedGalaxyQueries(controller.signal)
      .then(response => setQueries(response.queries))
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Saved queries unavailable.')
      })
    return () => controller.abort()
  }, [api])

  const columns = useMemo<readonly SortableDataTableColumn<SavedGalaxyQuery>[]>(() => [
    {
      cell: query => query.name,
      heading: 'Name',
      id: 'name',
      rowHeader: true,
      sortValue: query => query.name
    },
    {
      cell: query => queryDefinition(query).title,
      heading: 'Query',
      id: 'query',
      sortValue: query => queryDefinition(query).title
    },
    {
      cell: query => scalar(query.parameters.origin) || '—',
      heading: 'Origin',
      id: 'origin',
      sortValue: query => scalar(query.parameters.origin) || null
    },
    {
      cell: query => query.useOnDashboard ? 'Active' : '—',
      heading: 'Dashboard',
      id: 'dashboard',
      sortValue: query => query.useOnDashboard ? 1 : 0
    },
    {
      cell: query => <div className="saved-query-actions">
        <Button size="sm" variant="accent" onClick={() => onNavigate(savedQueryRoute(query, true))}>Run</Button>
        <IconButton label={`Edit ${query.name}`} size="sm" variant="outline" onClick={() => onNavigate(savedQueryRoute(query, false))}><PencilIcon /></IconButton>
        <IconButton busy={deleting === query.id} label={`Delete ${query.name}`} size="sm" variant="danger" onClick={() => {
          setDeleting(query.id)
          setError(undefined)
          void api.deleteGalaxyQuery(query.id)
            .then(() => setQueries(current => current?.filter(candidate => candidate.id !== query.id)))
            .catch(cause => setError(cause instanceof Error ? cause.message : 'Saved query could not be deleted.'))
            .finally(() => setDeleting(undefined))
        }}><TrashIcon /></IconButton>
      </div>,
      className: 'col-fit',
      heading: 'Actions',
      id: 'actions'
    }
  ], [api, deleting, onNavigate])

  return (
    <PageFrame layout="fit">
      <div className="saved-galaxy-queries">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'Query console', href: '#/galaxy/database' }, { label: 'Saved queries' }]} />}
          title="Saved queries"
        />
        <DataTableGroup fill meta={queries ? `${queries.length} saved` : undefined} title="Query library">
          {error && <Status tone="danger" wrap>{error}</Status>}
          {queries
            ? <SortableDataTable
                columns={columns}
                density="compact"
                empty="No saved queries."
                label="Saved galaxy queries"
                minimum="wide"
                rowKey={query => query.id}
                rows={queries}
                scheme="surface"
                stickyHeader
              />
            : !error && <Status tone="muted">Loading saved queries…</Status>}
        </DataTableGroup>
      </div>
    </PageFrame>
  )
}

export function savedQueryRoute(query: SavedGalaxyQuery, runSavedQuery: boolean): PhoenixRoute {
  return {
    kind: 'information',
    section: 'galaxy',
    view: 'database',
    ...(runSavedQuery ? { savedQueryRunId: createClientId() } : {}),
    savedQueryId: query.id,
    selectedQueryId: query.queryId
  }
}

function queryDefinition(query: SavedGalaxyQuery) {
  return GALAXY_QUERY_CATALOGUE.find(candidate => candidate.id === query.queryId)!
}

function scalar(value: SavedGalaxyQuery['parameters'][string]): string {
  return typeof value === 'string' ? value : ''
}
