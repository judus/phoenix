import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { expect, test } from 'vitest'
import { CopilotPermissionEditor } from '../apps/web/src/components/copilot-permission-editor.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { NavigationPlotRouteTool } from '../apps/server/src/application/mcp-tools/navigation-plot-route-tool.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'

test('route-plotting permission is presented as a game control, not read-only data', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const tool = new NavigationPlotRouteTool({ plot: async () => { throw new Error('No input in UI test') } })
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(() => [tool.definition], {
    find: () => undefined, getCatalog: () => ({ commands: [] })
  }, settings).catalogue()
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(<CopilotPermissionEditor capabilities={capabilities}
    permissions={{ version: 2, enabledCapabilityIds: [] }} onChange={() => {}} />) })
  try {
    await act(async () => renderer.root.findByType('details').props.onToggle({ currentTarget: { open: true } }))
    const rendered = JSON.stringify(renderer.toJSON())
    expect(rendered).toContain('Game control')
    expect(rendered).not.toContain('Read only')
    expect(rendered).toContain('Plot Route')
  } finally { await act(async () => renderer.unmount()) }
})
