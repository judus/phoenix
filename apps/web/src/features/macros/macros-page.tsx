import { useEffect, useMemo, useRef, useState } from 'react'
import type { MacroDefinition, MacroStep } from '@phoenix/contracts'
import {
  Button,
  DataTable,
  DataTableGroup,
  Field,
  IconButton,
  NumberInput,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  TextInput
} from '@phoenix/ui'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'

export function MacrosPage({ runtime }: { runtime: MacroRuntime }) {
  const [selectedId, setSelectedId] = useState<string>()
  const appliedSavedId = useRef<string | undefined>(undefined)
  const selected = useMemo(
    () => runtime.library.macros.find(macro => macro.id === selectedId) ?? runtime.library.macros[0],
    [runtime.library.macros, selectedId]
  )

  useEffect(() => {
    if (
      runtime.lastSavedMacroId &&
      runtime.lastSavedMacroId !== appliedSavedId.current &&
      runtime.library.macros.some(macro => macro.id === runtime.lastSavedMacroId)
    ) {
      appliedSavedId.current = runtime.lastSavedMacroId
      setSelectedId(runtime.lastSavedMacroId)
      return
    }
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
    if (!selected && selectedId) setSelectedId(undefined)
  }, [runtime.lastSavedMacroId, runtime.library.macros, selected, selectedId])

  return <PageFrame className="macros-page" layout="fit">
    <PageHeader context="Utilities · Automation" title="Macros" />
    {runtime.error && <Status tone="danger">{runtime.error}</Status>}
    {runtime.playback && <PlaybackStatus runtime={runtime} />}
    <div className="macro-workspace">
      <DataTableGroup
        className="macro-library"
        contentGap="sm"
        fill
        meta={`${runtime.library.macros.length} retained`}
        title="Macros"
      >
        <Stack fill gap="sm">
          {runtime.library.macros.length === 0
            ? <Status tone="muted">No macros saved.</Status>
            : <DataTable density="compact" label="Saved macros" narrow="priority" scheme="surface" stickyHeader>
                <thead><tr><th className="col-fill">Name</th><th className="col-fit numeric">Steps</th><th className="col-fit">Risk</th></tr></thead>
                <tbody>{runtime.library.macros.map(macro => <tr
                  aria-selected={macro.id === selected?.id || undefined}
                  className={macro.id === selected?.id ? 'active' : undefined}
                  key={macro.id}
                  onClick={() => setSelectedId(macro.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(macro.id)
                    }
                  }}
                  tabIndex={0}
                >
                  <th className="col-fill" scope="row"><strong>{macro.name}</strong><small>{macro.description || 'No description'}</small></th>
                  <td className="col-fit numeric">{macro.steps.length}</td>
                  <td className="col-fit">{titleCase(macro.risk)}</td>
                </tr>)}</tbody>
              </DataTable>}
          <div className="macro-library-actions">
            <Button variant="outline" onClick={() => void runtime.startRecording()}>Add macro</Button>
            <Button disabled={!selected} variant="danger" onClick={() => selected && void runtime.deleteMacro(selected.id)}>Delete macro</Button>
          </div>
        </Stack>
      </DataTableGroup>
      <MacroEditor
        key={selected?.id ?? 'empty'}
        macro={selected}
        onSave={runtime.save}
      />
    </div>
  </PageFrame>
}

function PlaybackStatus({ runtime }: { runtime: MacroRuntime }) {
  const playback = runtime.playback!
  return <div className="macro-playback-status">
    <Status tone={playback.status === 'failed' ? 'danger' : playback.status === 'running' ? 'information' : 'muted'}>
      Playback · {playback.message} · {playback.completedSteps} / {playback.totalSteps}
    </Status>
    {playback.status === 'running' && <Button variant="danger" onClick={() => void runtime.abort()}>Abort</Button>}
  </div>
}

function MacroEditor({ macro, onSave }: {
  macro?: MacroDefinition
  onSave(macro: MacroDefinition): Promise<void>
}) {
  const [draft, setDraft] = useState(macro)
  const [steps, setSteps] = useState(() => editorSteps(macro))
  const onSaveRef = useRef(onSave)
  const saveQueue = useRef(Promise.resolve())
  const savedFingerprint = useRef(macro ? macroFingerprint(macro) : '')

  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  useEffect(() => {
    if (!draft || !draft.name.trim() || steps.length === 0) return
    const normalized = normalizeMacro(draft, steps)
    const fingerprint = macroFingerprint(normalized)
    if (fingerprint === savedFingerprint.current) return

    const timeout = globalThis.setTimeout(() => {
      const save = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          await onSaveRef.current(normalized)
          savedFingerprint.current = fingerprint
        })
      saveQueue.current = save
      void save.catch(() => undefined)
    }, 400)

    return () => globalThis.clearTimeout(timeout)
  }, [draft, steps])

  if (!draft) {
    return <DataTableGroup className="macro-editor" contentGap="sm" fill title="Macro editor">
      <Status tone="muted">Select a saved macro or add a new one.</Status>
    </DataTableGroup>
  }

  const updateStep = (index: number, step: EditorStep) => setSteps(current => current.map((candidate, candidateIndex) => candidateIndex === index ? step : candidate))
  const deleteStep = (index: number) => setSteps(current => current.filter((_, candidateIndex) => candidateIndex !== index))
  const usableSteps = steps.filter(step => step.usable).length

  return <DataTableGroup
    className="macro-editor"
    contentGap="sm"
    fill
    meta={`${usableSteps} usable · ${steps.length} recorded`}
    title="Macro steps"
  >
    <Stack className="macro-editor-content" fill gap="sm">
      <div className="macro-fields">
        <Field htmlFor="macro-name" label="Name" required>
          <TextInput id="macro-name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field htmlFor="macro-description" label="Description">
          <TextInput id="macro-description" placeholder="Optional" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} />
        </Field>
      </div>
      <DataTable className="macro-step-table" density="compact" label={`${draft.name} steps`} narrow="priority" scheme="surface" stickyHeader>
        <thead><tr><th className="col-fit">Step</th><th className="col-fill">Action</th><th className="col-fit">Operation</th><th className="col-fit">Status</th><th className="col-fit">Duration ms</th><th className="col-fit" aria-label="Step actions" /></tr></thead>
        <tbody>{steps.map((step, index) => <tr className={step.usable ? undefined : 'disabled'} key={`${index}:${editorStepKey(step)}`}>
          <td className="col-fit">{index + 1}</td>
          <th className="col-fill" scope="row">{step.type === 'wait' ? 'Wait' : actionLabel(step.actionId)}</th>
          <td className="col-fit">{step.type === 'wait' ? 'Delay' : titleCase(step.operation)}</td>
          <td className="col-fit">Ready</td>
          <td className="col-fit">{step.type === 'wait'
            ? <DurationInput index={index} value={step.durationMs} onChange={durationMs => updateStep(index, { ...step, durationMs })} />
            : step.recorded
              ? <DurationInput index={index} value={step.delayBeforeMs} onChange={delayBeforeMs => updateStep(index, { ...step, delayBeforeMs })} />
              : '—'}</td>
          <td className="col-fit macro-step-action"><IconButton label={`Delete step ${index + 1}`} size="sm" variant="danger" onClick={() => deleteStep(index)}><DeleteIcon /></IconButton></td>
        </tr>)}</tbody>
      </DataTable>
    </Stack>
  </DataTableGroup>
}

function actionLabel(actionId: string): string {
  return actionId.replace(/^elite\./u, '').replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
}

function boundedMilliseconds(value: string): number {
  return Math.max(0, Math.min(30_000, Number(value) || 0))
}

type EditorStep =
  | { type: 'wait', durationMs: number, usable: true }
  | {
      type: 'command'
      actionId: string
      delayBeforeMs: number
      operation: 'tap' | 'press' | 'release'
      recorded: boolean
      usable: boolean
    }

function DurationInput({ index, onChange, value }: { index: number, onChange(value: number): void, value: number }) {
  return <NumberInput aria-label={`Step ${index + 1} duration in milliseconds`} className="form-mini" max="30000" min="0" step="50" value={value} onChange={event => onChange(boundedMilliseconds(event.target.value))} />
}

function editorSteps(macro?: MacroDefinition): EditorStep[] {
  return macro?.steps.map(step => step.type === 'wait'
    ? { ...step, usable: true }
    : { type: 'command', actionId: step.actionId, operation: step.operation, delayBeforeMs: 0, recorded: false, usable: true }) ?? []
}

function normalizeMacro(macro: MacroDefinition, editorSteps: EditorStep[]): MacroDefinition {
  const name = macro.name.trim()
  const steps: MacroStep[] = []
  editorSteps.filter(step => step.usable).forEach(step => {
    if (step.type === 'wait') {
      steps.push({ type: 'wait', durationMs: step.durationMs })
      return
    }
    if (step.recorded && step.delayBeforeMs > 0 && steps.length > 0) {
      steps.push({ type: 'wait', durationMs: step.delayBeforeMs })
    }
    steps.push({ type: 'game-action', actionId: step.actionId, operation: step.operation })
  })
  return {
    ...macro,
    description: macro.description.trim(),
    name,
    steps
  }
}

function editorStepKey(step: EditorStep): string {
  return step.type === 'wait' ? `wait:${step.durationMs}` : `${step.actionId}:${step.operation}`
}

function macroFingerprint(macro: MacroDefinition): string {
  return JSON.stringify(macro)
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./u, first => first.toUpperCase())
}

function DeleteIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
}
