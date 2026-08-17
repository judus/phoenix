import { useEffect, useState } from 'react'
import type { MacroRecording } from '@phoenix/contracts'
import { Button, DataTable, Field, NumberInput, PageFrame, PageHeader, Section, Status, TextInput, Widget } from '@phoenix/ui'
import type { MacroRuntime } from './macro-runtime-provider.js'

export function MacrosPage({ runtime }: { runtime: MacroRuntime }) {
  const [name, setName] = useState('')
  useEffect(() => { if (!runtime.draft) setName('') }, [runtime.draft])
  const successful = runtime.draft?.entries.filter(entry => isSuccessful(entry.status)).length ?? 0

  return <PageFrame className="macros-page" layout="fit">
    <PageHeader
      actions={<Button variant="primary" onClick={() => void runtime.startRecording()}>Start recording</Button>}
      context="Utilities"
      description="Record semantic PHOENIX commands while watching Elite respond. Playback completion does not prove the game outcome."
      title="Macros"
    />
    {runtime.error && <Status tone="danger">{runtime.error}</Status>}
    {runtime.playback && <Widget title="Playback" meta={`${runtime.playback.completedSteps} / ${runtime.playback.totalSteps}`}>
      <div className="macro-playback-status">
        <Status tone={runtime.playback.status === 'failed' ? 'danger' : runtime.playback.status === 'running' ? 'information' : 'muted'}>{runtime.playback.message}</Status>
        {runtime.playback.status === 'running' && <Button variant="danger" onClick={() => void runtime.abort()}>Abort</Button>}
      </div>
    </Widget>}
    {runtime.draft && <MacroDraft
      draft={runtime.draft}
      name={name}
      onChange={runtime.setDraft}
      onNameChange={setName}
      onSave={() => void runtime.save(name.trim())}
      successful={successful}
    />}
    <Section className="macro-library" title="Saved macros" description={`${runtime.library.macros.length} retained`}>
      {runtime.library.macros.length === 0
        ? <Status tone="muted">No macros saved. Start a recording, then operate commands from the Controls workspace.</Status>
        : <DataTable density="compact" label="Saved macros" minimum="wide" scheme="surface" stickyHeader>
            <thead><tr><th>Name</th><th>Risk</th><th className="numeric">Steps</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>{runtime.library.macros.map(macro => <tr key={macro.id}>
              <th scope="row">{macro.name}</th>
              <td>{macro.risk}</td>
              <td className="numeric">{macro.steps.length}</td>
              <td>{macro.description || '—'}</td>
              <td><div className="macro-row-actions"><Button disabled={runtime.playback?.status === 'running' || !macro.enabled} variant="outline" onClick={() => void runtime.play(macro)}>Run</Button><Button variant="danger" onClick={() => void runtime.deleteMacro(macro.id)}>Delete</Button></div></td>
            </tr>)}</tbody>
          </DataTable>}
    </Section>
  </PageFrame>
}

function MacroDraft({ draft, name, onChange, onNameChange, onSave, successful }: {
  draft: MacroRecording
  name: string
  onChange(draft: MacroRecording): void
  onNameChange(name: string): void
  onSave(): void
  successful: number
}) {
  return <Section className="macro-draft" title="Recorded draft" description={`${successful} usable commands`} actions={<><Button variant="quiet" onClick={() => onChange({ ...draft, entries: draft.entries.map(entry => ({ ...entry, delayBeforeMs: 0 })) })}>Remove pauses</Button><Field htmlFor="macro-name" label="Macro name"><TextInput value={name} onChange={event => onNameChange(event.target.value)} /></Field><Button disabled={!name.trim() || successful === 0} variant="primary" onClick={onSave}>Save macro</Button></>}>
    <DataTable density="compact" label="Recorded macro steps" minimum="wide" scheme="surface" stickyHeader>
      <thead><tr><th className="numeric">Step</th><th>Command</th><th>Operation</th><th>Status</th><th>Wait before</th></tr></thead>
      <tbody>{draft.entries.map((entry, index) => <tr key={`${entry.actionId}:${index}`}>
        <td className="numeric">{index + 1}</td>
        <th scope="row">{entry.actionId.replace(/^elite\./u, '')}</th>
        <td>{entry.operation}</td>
        <td>{entry.status}</td>
        <td>{index === 0 ? '—' : <NumberInput aria-label={`Wait before step ${index + 1}`} min="0" max="30000" step="50" value={entry.delayBeforeMs} onChange={event => updateDelay(draft, index, event.target.value, onChange)} />}</td>
      </tr>)}</tbody>
    </DataTable>
  </Section>
}

function isSuccessful(status: MacroRecording['entries'][number]['status']): boolean {
  return ['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(status)
}

function updateDelay(draft: MacroRecording, index: number, value: string, onChange: (draft: MacroRecording) => void): void {
  const delayBeforeMs = Math.max(0, Math.min(30_000, Number(value) || 0))
  onChange({
    ...draft,
    entries: draft.entries.map((entry, candidateIndex) => candidateIndex === index ? { ...entry, delayBeforeMs } : entry)
  })
}
