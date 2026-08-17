import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { CopilotHistoryMessage, CopilotProfileDocument } from '@phoenix/contracts'
import { Button, CommandTile, DescriptionItem, DescriptionList, Field, Form, FormActions, FormGrid, Identity, PageFrame, PageHeader, Select, Status, Textarea, TextInput, Widget } from '@phoenix/ui'
import type { PhoenixApi, CopilotStreamEvent } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import type { ClientIdentity } from '../../application/identity/client-identity.js'
import { CopilotMarkdown } from './copilot-markdown.js'
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
  const [saving, setSaving] = useState(false)
  const [composer, setComposer] = useState('')
  const clientId = useRef(clientIdentity.forScope('copilot'))
  const loadHistory = useCallback(async () => setMessages((await api.getCopilotHistory(CONVERSATION_ID)).messages), [api])

  useEffect(() => { const abort = new AbortController(); void api.getCopilotHistory(CONVERSATION_ID, abort.signal).then(result => setMessages(result.messages)).catch(cause => { if (!abort.signal.aborted) setError(message(cause, 'Conversation history unavailable.')) }); return () => abort.abort() }, [api, voice.historyVersion])
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
    const text = candidate.trim()
    if (!text || pending) return
    if (voice.canSendRealtimeText) { try { voice.sendText(text); setError(undefined) } catch (cause) { setError(message(cause, 'Realtime message failed.')) }; return }
    const turnId = `text-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const userId = `pending-user-${turnId}`
    const assistantId = `pending-assistant-${turnId}`
    setPending(true); setError(undefined); setToolStatus(undefined)
    setMessages(current => [...current, temporary(userId, 'user', text), temporary(assistantId, 'assistant', '')])
    try {
      await api.streamCopilotMessage({ clientId: clientId.current, conversationId: CONVERSATION_ID, message: text, turnId }, event => applyStream(event, assistantId, setMessages, setToolStatus))
      await loadHistory()
    } catch (cause) { setMessages(current => current.filter(item => item.id !== assistantId || item.text)); setError(message(cause, 'Copilot request failed.')) }
    finally { setPending(false); setToolStatus(undefined) }
  }
  const edit = async (id: string) => { try { setDraft(toDraft(await api.getCopilotProfile(id))); setError(undefined) } catch (cause) { setError(message(cause, 'Unable to load Copilot profile.')) } }
  const create = async () => { try { const source = await api.getCopilotProfile(voice.activeProfile.id); setDraft({ ...toDraft(source), id: '', mark: '?', name: '', description: '', templateProfileId: source.profile.id }); setError(undefined) } catch (cause) { setError(message(cause, 'Unable to prepare a new profile.')) } }
  const save = async (next: ProfileDraft) => { setSaving(true); try { const creating = next.templateProfileId !== undefined; const input = { characterSpeech: next.characterSpeech, characterText: next.characterText, profile: { description: next.description, id: creating ? profileId(next.name) : next.id, mark: creating ? next.name.trim().charAt(0).toUpperCase() || '?' : next.mark, name: next.name, voice: next.voice }, ...(next.templateProfileId ? { templateProfileId: next.templateProfileId } : {}) }; setDraft(toDraft(creating ? await api.createCopilotProfile(input) : await api.updateCopilotProfile(next.id, input))); setError(undefined) } catch (cause) { setError(message(cause, 'Unable to save Copilot profile.')) } finally { setSaving(false) } }

  return <PageFrame className={`copilot-page copilot-page-${view}`} layout="fit">
    {view === 'profiles'
      ? <PageHeader context="Copilot" title="Profiles" description="Select, create, and tune Copilot characters." status={error ?? voice.error} />
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
      : <div className="copilot-profiles"><aside><ul>{voice.profiles.map(profile => <li key={profile.id}><Button alignment="start" variant={profile.id === voice.activeProfile.id ? 'accent' : 'quiet'} onClick={() => void edit(profile.id)}>{profile.name}</Button></li>)}</ul><Button variant="outline" onClick={() => void create()}>New profile</Button></aside>{draft ? <ProfileEditor draft={draft} saving={saving} onChange={setDraft} onSave={save} /> : <Status tone="muted">Select a profile to inspect its character prompts.</Status>}</div>}
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
function ProfileEditor({ draft, onChange, onSave, saving }: { draft: ProfileDraft, onChange(value: ProfileDraft): void, onSave(value: ProfileDraft): Promise<void>, saving: boolean }) { const update = (field: keyof ProfileDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, [field]: event.target.value }); return <Form className="copilot-profile-editor" onSubmit={event => { event.preventDefault(); void onSave(draft) }}><FormGrid><Field htmlFor="profile-name" label="Name" required><TextInput value={draft.name} maxLength={48} required onChange={update('name')} /></Field><Field htmlFor="profile-voice" label="Realtime voice" required><Select value={draft.voice} onChange={event => onChange({ ...draft, voice: event.target.value })}>{Array.from(new Set([...VOICES, draft.voice])).sort().map(value => <option key={value}>{value}</option>)}</Select></Field></FormGrid><Field htmlFor="profile-description" label="Description"><TextInput value={draft.description} maxLength={240} onChange={update('description')} /></Field><Field htmlFor="profile-text" label="Text character prompt" required><Textarea value={draft.characterText} required rows={7} onChange={update('characterText')} /></Field><Field htmlFor="profile-speech" label="Speech character prompt" required><Textarea value={draft.characterSpeech} required rows={7} onChange={update('characterSpeech')} /></Field><FormActions><Button variant="primary" busy={saving}>{draft.templateProfileId ? 'Create profile' : 'Save profile'}</Button></FormActions></Form> }
function applyStream(event: CopilotStreamEvent, assistantId: string, setMessages: (update: (messages: readonly CopilotHistoryMessage[]) => readonly CopilotHistoryMessage[]) => void, setTool: (value: string | undefined) => void) { if (event.type === 'delta') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: `${item.text}${event.delta}` } : item)); else if (event.type === 'reset') setMessages(items => items.map(item => item.id === assistantId ? { ...item, text: '' } : item)); else if (event.type === 'retrying') setTool(`Provider stream retry ${event.attempt}…`); else if (event.type === 'tool') setTool(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`) }
function temporary(id: string, role: CopilotHistoryMessage['role'], text: string): CopilotHistoryMessage { return { createdAt: new Date().toISOString(), id, role, text } }
function without(turns: Record<string, RemoteTurn>, id: string) { const next = { ...turns }; delete next[id]; return next }
function toDraft(document: CopilotProfileDocument): ProfileDraft { return { characterSpeech: document.characterSpeech, characterText: document.characterText, description: document.profile.description, id: document.profile.id, mark: document.profile.mark, name: document.profile.name, voice: document.profile.voice } }
function profileId(name: string) { const id = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, ''); return /^[a-z]/u.test(id) ? id : `copilot-${id || 'profile'}` }
function message(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback }
