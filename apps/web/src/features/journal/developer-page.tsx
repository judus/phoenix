import { useEffect, useState } from 'react'
import type { CopilotInjectedTool, CopilotToolDiagnosticsResponse } from '@phoenix/contracts'
import {
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  PageFrame,
  PageHeader,
  Status
} from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'

export function DeveloperPage ({ api }: { api: PhoenixApi }) {
  const [diagnostics, setDiagnostics] = useState<CopilotToolDiagnosticsResponse>()
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const abort = new AbortController()
    void api.getCopilotToolDiagnostics(abort.signal)
      .then(snapshot => {
        setDiagnostics(snapshot)
        setSelectedId(current => snapshot.tools.some(tool => tool.id === current) ? current : snapshot.tools[0]?.id)
      })
      .catch(cause => { if (!abort.signal.aborted) setError(message(cause)) })
    return () => abort.abort()
  }, [api])

  const selected = diagnostics?.tools.find(tool => tool.id === selectedId) ?? diagnostics?.tools[0]

  return <PageFrame className="developer-page" layout="fit">
    <PageHeader
      context={<Breadcrumbs items={[{ label: 'Log' }, { label: 'Developer tools' }]} />}
      description="Inspect live PHOENIX runtime diagnostics."
      title="Developer tools"
      variant="cockpit"
    />
    {error
      ? <Status tone="danger">{error}</Status>
      : !diagnostics
          ? <Status tone="muted">Loading Copilot tool injection…</Status>
          : <div className="developer-tools-workspace">
              <DataTableGroup className="developer-tool-list" fill meta={`${diagnostics.tools.length} enabled`} title="Copilot tool injection">
                {diagnostics.tools.length === 0
                  ? <Status tone="muted">No tools are currently exposed to Copilot.</Status>
                  : <DataTable density="compact" label="Injected Copilot tools" narrow="priority" scheme="surface" stickyHeader>
                      <thead><tr><th>Tool identifier</th></tr></thead>
                      <tbody>{diagnostics.tools.map(tool => <ToolRow
                        active={tool.id === selected?.id}
                        key={tool.id}
                        tool={tool}
                        onSelect={() => setSelectedId(tool.id)}
                      />)}</tbody>
                    </DataTable>}
              </DataTableGroup>
              <DataTableGroup className="developer-tool-payload" contentGap="sm" fill meta={selected?.id} title="Injected schema">
                {selected
                  ? <div className="developer-tool-projections">
                      <ToolProjection
                        description="Exact tool object served through MCP for text Copilot discovery."
                        payload={selected.mcp}
                        title="Text Copilot · MCP"
                      />
                      <ToolProjection
                        description="Exact function tool object included in the Realtime voice session request."
                        payload={selected.realtime}
                        title="Voice Copilot · Realtime"
                      />
                    </div>
                  : <Status tone="muted">Select an injected tool.</Status>}
              </DataTableGroup>
            </div>}
  </PageFrame>
}

function ToolRow ({ active, onSelect, tool }: { active: boolean, onSelect(): void, tool: CopilotInjectedTool }) {
  return <tr
    aria-selected={active || undefined}
    className={active ? 'active' : undefined}
    onClick={onSelect}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect()
      }
    }}
    tabIndex={0}
  ><td><code>{tool.id}</code></td></tr>
}

function ToolProjection ({ description, payload, title }: { description: string, payload: Record<string, unknown>, title: string }) {
  return <section>
    <header>
      <h3>{title}</h3>
      <p>{description}</p>
    </header>
    <pre>{JSON.stringify(payload, null, 2)}</pre>
  </section>
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load Copilot tool diagnostics.'
}
