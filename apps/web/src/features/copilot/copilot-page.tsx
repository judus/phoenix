import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { CopilotHistoryMessage, CopilotProfileCapabilitySettings, CopilotProfileDocument, CopilotPermissionPolicy } from '@phoenix/contracts'
import { Breadcrumbs, Button, CommandTile, DataTable, DescriptionItem, DescriptionList, Field, Form, FormActions, FormGrid, Identity, PageFrame, PageHeader, Select, Status, Tabs, Textarea, TextInput, Widget } from '@phoenix/ui'
import type { PhoenixApi, CopilotStreamEvent } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import type { ClientIdentity } from '../../application/identity/client-identity.js'
import { LatestRequest } from '../../application/requests/latest-request.js'
import { CopilotMarkdown } from './copilot-markdown.js'
import { CopilotPermissionEditor } from '../../components/copilot-permission-editor.js'
import { CopilotVoiceToggle } from './copilot-voice-toggle.js'
import { useCopilotVoice } from './copilot-voice-provider.js'

const CONVERSATION_ID = 'phoenix-copilot'
const VOICES = ['alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'marin', 'sage', 'shimmer', 'verse']
type CopilotView = 'chat' | 'profiles'
interface RemoteTurn { assistantText: string, id: string, userText: string }
interface ProfileDraft { characterSpeech: string, characterText: string, description: string, id: string, mark: string, name: string, templateProfileId?: string, voice: string }

export function CopilotPage({ api, clientIdentity, events, view }: { api: PhoenixApi, clientIdentity: ClientIdentity, events: PhoenixEventHub, view: CopilotView }) {
  const voice = useCopilotVoice()
  const [messages, setMessages] = useState<readonly CopilotHistoryMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const [remoteTurns, setRemoteTurns] = useState<Record<string, RemoteTurn>>({})
  const [draft, setDraft] = useState<ProfileDraft>()
  const [profileCapabilities, setProfileCapabilities] = useState<CopilotProfileCapabilitySettings>()
  const [permissionsPending, setPermissionsPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [composer, setComposer] = useState('')
  const clientId = useRef(clientIdentity.forScope('copilot'))
  const historyRequest = useRef<AbortController | undefined>(undefined)
  const streamRequest = useRef<AbortController | undefined>(undefined)
  const [profileRequest] = useState(() => new LatestRequest())
  const lifetime = useRef<{ api: PhoenixApi, abort: AbortController } | undefined>(undefined)
  const profileRevision = useRef(0)
  const draftRef = useRef<ProfileDraft | undefined>(undefined)
  const manualProfileSelection = useRef(false)
  const updateDraft = useCallback((next: ProfileDraft): void => { draftRef.current = next; setDraft(next) }, [])
  useEffect(() => {
    const abort = new AbortController()
    lifetime.current = { api, abort }
    manualProfileSelection.current = false
    profileRevision.current += 1
    setSaving(false)
    setPermissionsPending(false)
    setPending(false)
    setToolStatus(undefined)
    return () => { abort.abort(); profileRequest.cancel() }
  }, [api, profileRequest])
  const loadHistory = useCallback(async () => {
    historyRequest.current?.abort()
    const abort = new AbortController()
    historyRequest.current = abort
    try {
      const result = await api.getCopilotHistory(CONVERSATION_ID, abort.signal)
      if (!abort.signal.aborted && historyRequest.current === abort) setMessages(result.messages)
    } catch (cause) {
      if (!abort.signal.aborted && historyRequest.current === abort) throw cause
    } finally {
      if (historyRequest.current === abort) historyRequest.current = undefined
    }
  }, [api])

  useEffect(() => {
    void loadHistory().catch(cause => {
      setError(message(cause, 'Conversation history unavailable.'))
    })
    return () => historyRequest.current?.abort()
  }, [loadHistory, voice.historyVersion])
  useEffect(() => () => streamRequest.current?.abort(), [api])
  useEffect(() => events.subscribe('conversation-event', event => {
    if (event.clientId === clientId.current || event.conversationId !== CONVERSATION_ID) return
    if (event.type === 'turn.started') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: '', id: event.turnId, userText: event.userText } }))
    else if (event.type === 'user.transcript') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: turns[event.turnId]?.assistantText ?? '', id: event.turnId, userText: event.text } }))
    else if (event.type === 'assistant.transcript') setRemoteTurns(turns => ({ ...turns, [event.turnId]: { assistantText: event.text, id: event.turnId, userText: turns[event.turnId]?.userText ?? '' } }))
    else if (event.type === 'tool.status') setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
    else if (event.type === 'turn.failed') { setRemoteTurns(turns => without(turns, event.turnId)); setError(event.message) }
    else if (event.type === 'turn.cancelled' || event.type === 'turn.completed') { setRemoteTurns(turns => without(turns, event.turnId)); setToolStatus(undefined); if (event.type === 'turn.completed') void loadHistory().catch(cause => setError(message(cause, 'Conversation history unavailable.'))) }
  }), [events, loadHistory])

  const submit = async (candidate: string) => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    const text = candidate.trim()
    if (!text || pending) return
    if (voice.canSendRealtimeText) { try { voice.sendText(text); setError(undefined) } catch (cause) { setError(message(cause, 'Realtime message failed.')) }; return }
    const turnId = `text-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const userId = `pending-user-${turnId}`
    const assistantId = `pending-assistant-${turnId}`
    setPending(true); setError(undefined); setToolStatus(undefined)
    setMessages(current => [...current, temporary(userId, 'user', text), temporary(assistantId, 'assistant', '')])
    const abort = new AbortController()
    streamRequest.current = abort
    try {
      await api.streamCopilotMessage({ clientId: clientId.current, conversationId: CONVERSATION_ID, message: text, turnId }, event => {
        if (!abort.signal.aborted && streamRequest.current === abort) applyStream(event, assistantId, setMessages, setToolStatus)
      }, abort.signal)
      if (!abort.signal.aborted && streamRequest.current === abort) await loadHistory()
    } catch (cause) { if (!abort.signal.aborted) { setMessages(current => current.filter(item => item.id !== assistantId || item.text)); setError(message(cause, 'Copilot request failed.')) } }
    finally { if (streamRequest.current === abort) streamRequest.current = undefined; if (!abort.signal.aborted) { setPending(false); setToolStatus(undefined) } }
  }
  const edit = useCallback(async (id: string, manual = true) => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    if (manual) manualProfileSelection.current = true
    const signal = profileRequest.start()
    profileRevision.current += 1
    setSaving(false)
    setPermissionsPending(false)
    try {
      const [document, capabilities] = await Promise.all([
        api.getCopilotProfile(id, signal),
        api.getCopilotProfileCapabilities(id, signal)
      ])
      if (!profileRequest.isCurrent(signal)) return
      profileRevision.current += 1
      setSaving(false)
      setPermissionsPending(false)
      updateDraft(toDraft(document))
      setProfileCapabilities(capabilities)
      setError(undefined)
    } catch (cause) {
      if (profileRequest.isCurrent(signal)) setError(message(cause, 'Unable to load Copilot profile.'))
    }
  }, [api, profileRequest, updateDraft])
  useEffect(() => {
    if (view === 'profiles' && !manualProfileSelection.current) void edit(voice.activeProfile.id, false)
  }, [edit, view, voice.activeProfile.id])
  const create = async () => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    manualProfileSelection.current = true
    const signal = profileRequest.start()
    profileRevision.current += 1
    setSaving(false)
    setPermissionsPending(false)
    try {
      const [source, capabilities] = await Promise.all([
        api.getCopilotProfile(voice.activeProfile.id, signal),
        api.getCopilotProfileCapabilities(voice.activeProfile.id, signal)
      ])
      if (!profileRequest.isCurrent(signal)) return
      profileRevision.current += 1
      setSaving(false)
      setPermissionsPending(false)
      updateDraft({ ...toDraft(source), id: '', mark: '?', name: '', description: '', templateProfileId: source.profile.id })
      setProfileCapabilities(capabilities)
      setError(undefined)
    } catch (cause) {
      if (profileRequest.isCurrent(signal)) setError(message(cause, 'Unable to prepare a new profile.'))
    }
  }
  const save = async (next: ProfileDraft) => {
    const owner = lifetime.current
    if (!owner || owner.api !== api || owner.abort.signal.aborted) return
    const revision = profileRevision.current
    const ownsSelection = (): boolean => !owner.abort.signal.aborted && revision === profileRevision.current
    setSaving(true)
    try {
      const creating = next.templateProfileId !== undefined
      const input = { characterSpeech: next.characterSpeech, characterText: next.characterText, profile: { description: next.description, id: creating ? profileId(next.name) : next.id, mark: creating ? next.name.trim().charAt(0).toUpperCase() || '?' : next.mark, name: next.name, voice: next.voice }, ...(next.templateProfileId ? { templateProfileId: next.templateProfileId } : {}) }
      const document = creating ? await api.createCopilotProfile(input) : await api.updateCopilotProfile(next.id, input)
      if (!ownsSelection()) return
      let savedDraft = toDraft(document)
      if (draftRef.current !== next) {
        if (!creating || !draftRef.current) return
        savedDraft = { ...draftRef.current, id: document.profile.id, mark: document.profile.mark }
        delete savedDraft.templateProfileId
      }
      updateDraft(savedDraft)
      if (creating) {
        const capabilities = await api.getCopilotProfileCapabilities(document.profile.id, owner.abort.signal)
        if (!ownsSelection()) return
        setProfileCapabilities(capabilities)
      }
      setError(undefined)
    } catch (cause) {
      if (ownsSelection()) setError(message(cause, 'Unable to save Copilot profile.'))
    } finally {
      if (ownsSelection()) setSaving(false)
    }
  }
  const saveProfilePermissions = async (permissions: CopilotPermissionPolicy): Promise<void> => {
    const owner = lifetime.current
    if (!draft || draft.templateProfileId !== undefined || !owner || owner.api !== api || owner.abort.signal.aborted) return
    const revision = profileRevision.current
    const ownsSelection = (): boolean => !owner.abort.signal.aborted && revision === profileRevision.current
    setPermissionsPending(true)
    setError(undefined)
    try {
      const capabilities = await api.updateCopilotProfileCapabilities(draft.id, permissions)
      if (!ownsSelection()) return
      setProfileCapabilities(capabilities)
      setError(undefined)
    } catch (cause) {
      if (ownsSelection()) setError(message(cause, 'Unable to save profile permissions.'))
    } finally {
      if (ownsSelection()) setPermissionsPending(false)
    }
  }

  return <PageFrame className={`copilot-page copilot-page-${view}`} layout="fit">
    {view === 'profiles'
      ? <PageHeader context={<Breadcrumbs items={[{ label: 'Copilot' }, { label: 'Profiles' }]} />} title="Profiles" variant="cockpit" status={error ?? voice.error ?? 'Select, create, and tune Copilot characters.'} />
      : null}
    {view === 'chat'
      ? <div className="copilot-workspace">
          <div className="copilot-profile-column">
            <Widget className="copilot-switch-widget" aria-label="Quick switch">
              <Field htmlFor="copilot-quick-profile" label="Profile">
                <Select value={voice.activeProfile.id} disabled={voice.connected || voice.transitioning} onChange={event => void voice.selectProfile(event.target.value).catch(cause => setError(message(cause, 'Unable to change Copilot profile.')))}>
                  {voice.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                </Select>
              </Field>
            </Widget>
            <Widget className="copilot-profile-widget" aria-label="Active Copilot profile">
              <div className="copilot-identity-panel" aria-label="Active Copilot profile">
                <div className="copilot-portrait" aria-hidden="true">{voice.activeProfile.mark}</div>
                <Identity title={voice.activeProfile.name.toUpperCase()} detail={voice.activeProfile.description} />
                <DescriptionList columns="one" density="compact">
                  <DescriptionItem label="Voice" value={voice.activeProfile.voice} />
                  <DescriptionItem label="Channel" value={voice.connected ? 'Realtime' : 'Text'} />
                  <DescriptionItem label="Host" value={voice.hostLocation} />
                </DescriptionList>
              </div>
            </Widget>
            <CopilotVoiceToggle voice={voice} />
          </div>
          <div className="copilot-conversation-column">
            <Widget className="copilot-conversation-widget" aria-label="Conversation history">
              <section className="copilot-chat" aria-label="Copilot conversation">
                <CopilotMessages messages={messages} remoteTurns={remoteTurns} activeTurn={voice.activeTurn} pending={pending} profileName={voice.activeProfile.name} />
                {toolStatus || voice.toolStatus ? <Status tone="muted">{toolStatus ?? voice.toolStatus}</Status> : null}
                {error || voice.error ? <Status tone="danger">{error ?? voice.error}</Status> : null}
              </section>
            </Widget>
            <div className="copilot-composer-row">
              <Widget className="copilot-composer-widget" aria-label="Message Copilot">
                <CopilotComposer pending={pending} profileName={voice.activeProfile.name} text={composer} onTextChange={setComposer} onSubmit={submit} />
              </Widget>
              <CommandTile form="copilot-composer-form" label="Send" binding="ENTER" meta={pending ? 'Transmitting' : 'Submit'} unavailable={pending || !composer.trim()} />
            </div>
          </div>
        </div>
      : <div className="copilot-profiles">
          <aside>
            <DataTable density="compact" label="Profiles to edit" narrow="priority" scheme="surface">
              <tbody>{voice.profiles.map(profile => <tr
                aria-label={profile.name}
                aria-selected={profile.id === draft?.id}
                className={profile.id === draft?.id ? 'active' : undefined}
                key={profile.id}
                tabIndex={0}
                onClick={() => void edit(profile.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void edit(profile.id)
                  }
                }}
              >
                <th scope="row"><strong>{profile.name}</strong>{profile.description && <small>{profile.description}</small>}</th>
              </tr>)}</tbody>
            </DataTable>
            <CommandTile aria-label="New profile" compact details={false} label="New profile" onClick={() => void create()} />
          </aside>
          {draft ? <ProfileEditor key={draft.id} capabilities={profileCapabilities} draft={draft} error={error} permissionsPending={permissionsPending} saving={saving} onChange={updateDraft} onSave={save} onSavePermissions={saveProfilePermissions} /> : <Status tone="muted">Select a profile to inspect its character prompts.</Status>}
        </div>}
  </PageFrame>
}

const CopilotMessages = memo(function CopilotMessages({ activeTurn, messages, pending, profileName, remoteTurns }: { activeTurn?: { assistantText: string, userText: string }, messages: readonly CopilotHistoryMessage[], pending: boolean, profileName: string, remoteTurns: Record<string, RemoteTurn> }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [activeTurn, messages, remoteTurns])
  const turns = Object.values(remoteTurns)
  return <div className="copilot-messages" aria-live="polite">{messages.length === 0 && !activeTurn && turns.length === 0 ? <Status tone="muted">No conversation yet. {profileName} is standing by.</Status> : null}{messages.map(item => <Message key={item.id} role={item.role} text={item.text || (pending ? '…' : '')} />)}{activeTurn?.userText ? <Message role="user" text={activeTurn.userText} live /> : null}{activeTurn ? <Message role="assistant" text={activeTurn.assistantText || '…'} live /> : null}{turns.flatMap(turn => [turn.userText ? <Message key={`${turn.id}-user`} role="user" text={turn.userText} live /> : null, <Message key={`${turn.id}-assistant`} role="assistant" text={turn.assistantText || '…'} live />])}<div ref={end} /></div>
})
function Message({ live = false, role, text }: { live?: boolean, role: CopilotHistoryMessage['role'], text: string }) { return <article className={`copilot-message copilot-message-${role}${live ? ' live' : ''}`}><small>{role === 'user' ? 'Commander' : role === 'assistant' ? 'Copilot' : 'System'}{live ? ' · live' : ''}</small><div>{role === 'assistant' ? <CopilotMarkdown>{text}</CopilotMarkdown> : text}</div></article> }
function CopilotComposer({ onSubmit, onTextChange, pending, profileName, text }: { onSubmit(text: string): Promise<void>, onTextChange(text: string): void, pending: boolean, profileName: string, text: string }) { const submit = (event: FormEvent) => { event.preventDefault(); const value = text.trim(); if (!value) return; onTextChange(''); void onSubmit(value) }; return <Form id="copilot-composer-form" className="copilot-composer" onSubmit={submit}><Field htmlFor="copilot-message" label="Message Copilot"><Textarea value={text} rows={2} disabled={pending} placeholder={`Ask ${profileName}…`} onChange={event => onTextChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} /></Field></Form> }
function ProfileEditor({ capabilities, draft, error, onChange, onSave, onSavePermissions, permissionsPending, saving }: {
  capabilities?: CopilotProfileCapabilitySettings
  draft: ProfileDraft
  error?: string
  onChange(value: ProfileDraft): void
  onSave(value: ProfileDraft): Promise<void>
  onSavePermissions(value: CopilotPermissionPolicy): Promise<void>
  permissionsPending: boolean
  saving: boolean
}) {
  const [tab, setTab] = useState('profile-tab')
  const update = (field: keyof ProfileDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, [field]: event.target.value })
  return <div className="copilot-profile-editor">
    <Tabs current={tab} label="Profile editor" onSelect={setTab} items={[
      { id: 'profile-tab', label: 'Profile', panelId: 'profile-panel' },
      { id: 'permissions-tab', label: 'Permissions', panelId: 'permissions-panel' }
    ]} />
    <Form className="copilot-profile-panel" id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" hidden={tab !== 'profile-tab'} onSubmit={event => { event.preventDefault(); void onSave(draft) }}>
      <div className="copilot-profile-fields">
        <FormGrid>
          <Field htmlFor="profile-name" label="Name" required><TextInput value={draft.name} maxLength={48} required onChange={update('name')} /></Field>
          <Field htmlFor="profile-voice" label="Realtime voice" required>
            <Select value={draft.voice} onChange={event => onChange({ ...draft, voice: event.target.value })}>
              {Array.from(new Set([...VOICES, draft.voice])).sort().map(value => <option key={value}>{value}</option>)}
            </Select>
          </Field>
        </FormGrid>
        <Field htmlFor="profile-description" label="Description"><TextInput value={draft.description} maxLength={240} onChange={update('description')} /></Field>
        <Field htmlFor="profile-text" label="Text character prompt" required><Textarea value={draft.characterText} required rows={7} onChange={update('characterText')} /></Field>
        <Field htmlFor="profile-speech" label="Speech character prompt" required><Textarea value={draft.characterSpeech} required rows={7} onChange={update('characterSpeech')} /></Field>
      </div>
      <FormActions message={error}><Button variant="primary" busy={saving}>{draft.templateProfileId ? 'Create profile' : 'Save profile'}</Button></FormActions>
    </Form>
    <section className="copilot-profile-panel" id="permissions-panel" role="tabpanel" aria-labelledby="permissions-tab" hidden={tab !== 'permissions-tab'}>
      {capabilities && <CopilotPermissionEditor
        layout="fit"
        capabilities={capabilities.capabilities}
        disabled={permissionsPending || draft.templateProfileId !== undefined}
        permissions={capabilities.permissions}
        profileLoad={capabilities.capabilities.load}
        visibleCapabilityIds={capabilities.installationPermissions.enabledCapabilityIds}
        onChange={permissions => void onSavePermissions(permissions)}
      />}
      <Status role="status" tone={error ? 'danger' : 'muted'} wrap>
        {error ?? (permissionsPending ? 'Saving permissions…' : draft.templateProfileId
          ? 'Template permissions are inherited. Create the profile before changing them.'
          : 'Permission changes save immediately.')}
      </Status>
    </section>
  </div>
}
function applyStream(event: CopilotStreamEvent, assistantId: string, setMessages: (update: (messages: readonly CopilotHistoryMessage[]) => readonly CopilotHistoryMessage[]) => void, setTool: (value: string | undefined) => void) { if (event.type === 'delta') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: `${item.text}${event.delta}` } : item)); else if (event.type === 'reset') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: '' } : item)); else if (event.type === 'retrying') setTool(`Provider stream retry ${event.attempt}…`); else if (event.type === 'tool') setTool(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`) }
function temporary(id: string, role: CopilotHistoryMessage['role'], text: string): CopilotHistoryMessage { return { createdAt: new Date().toISOString(), id, role, text } }
function without(turns: Record<string, RemoteTurn>, id: string) { const next = { ...turns }; delete next[id]; return next }
function toDraft(document: CopilotProfileDocument): ProfileDraft { return { characterSpeech: document.characterSpeech, characterText: document.characterText, description: document.profile.description, id: document.profile.id, mark: document.profile.mark, name: document.profile.name, voice: document.profile.voice } }
function profileId(name: string) { const id = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, ''); return /^[a-z]/u.test(id) ? id : `copilot-${id || 'profile'}` }
function message(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback }
