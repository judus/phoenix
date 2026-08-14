import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  CopilotConversationEventSchema,
  type CopilotProfileDocument,
  type CopilotHistoryMessage,
  type HealthResponse
} from '@phoenix/contracts'
import {
  PhoenixApiClient,
  type CopilotStreamEvent
} from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { useCopilotVoice } from '../features/copilot/copilot-voice-provider.js'
import { CopilotVoiceToggle } from '../features/copilot/copilot-voice-toggle.js'
import { CopilotMarkdown } from '../features/copilot/copilot-markdown.js'
import {
  copilotClientId,
  createCopilotId
} from '../features/copilot/copilot-client-identity.js'

const DEFAULT_CONVERSATION_ID = 'phoenix-copilot'
const navigation: NavigationItem[] = [
  { href: '#/copilot/chat', icon: '◈', id: 'chat', label: 'Chat' },
  { href: '#/copilot/profiles', icon: '◇', id: 'profiles', label: 'Profiles' }
]

export type CopilotView = 'chat' | 'profiles'

export interface CopilotPageProps {
  api: PhoenixApiClient
  error?: string
  health?: HealthResponse
  view?: CopilotView
}

interface RemoteTurn {
  assistantText: string
  id: string
  userText: string
}

interface ProfileDraft {
  characterSpeech: string
  characterText: string
  description: string
  id: string
  mark: string
  name: string
  templateProfileId?: string
  voice: string
}

export function CopilotPage ({ api, error, health, view = 'chat' }: CopilotPageProps) {
  const voice = useCopilotVoice()
  const [messages, setMessages] = useState<readonly CopilotHistoryMessage[]>([])
  const [pending, setPending] = useState(false)
  const [chatError, setChatError] = useState<string>()
  const [toolStatus, setToolStatus] = useState<string>()
  const [remoteTurns, setRemoteTurns] = useState<Record<string, RemoteTurn>>({})
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>()
  const [profileSaving, setProfileSaving] = useState(false)
  const clientIdRef = useRef(copilotClientId())

  const loadHistory = async (): Promise<void> => {
    const history = await api.getCopilotHistory(DEFAULT_CONVERSATION_ID)
    setMessages(history.messages)
  }

  useEffect(() => {
    void loadHistory().catch(cause => {
      setChatError(cause instanceof Error ? cause.message : 'Conversation history unavailable.')
    })
  }, [voice.historyVersion])

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const unsubscribe = subscribePhoenixEvent(api, 'conversation-event', rawEvent => {
      try {
        const event = CopilotConversationEventSchema.parse(JSON.parse((rawEvent as MessageEvent).data))
        if (event.clientId === clientIdRef.current) return
        if (event.type === 'turn.started') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: { assistantText: '', id: event.turnId, userText: event.userText }
          }))
        } else if (event.type === 'user.transcript') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: {
              assistantText: turns[event.turnId]?.assistantText ?? '',
              id: event.turnId,
              userText: event.text
            }
          }))
        } else if (event.type === 'assistant.transcript') {
          setRemoteTurns(turns => ({
            ...turns,
            [event.turnId]: {
              assistantText: event.text,
              id: event.turnId,
              userText: turns[event.turnId]?.userText ?? ''
            }
          }))
        } else if (event.type === 'tool.status') {
          setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
        } else if (event.type === 'turn.cancelled') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setToolStatus(undefined)
        } else if (event.type === 'turn.completed') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setToolStatus(undefined)
          void loadHistory().catch(cause => setChatError(
            cause instanceof Error ? cause.message : 'Conversation history unavailable.'
          ))
        } else if (event.type === 'turn.failed') {
          setRemoteTurns(turns => withoutTurn(turns, event.turnId))
          setChatError(event.message)
        }
      } catch {
        setChatError('Received an invalid live Copilot event.')
      }
    })
    return unsubscribe
  }, [api])

  const submit = useCallback(async (candidate: string): Promise<void> => {
    const text = candidate.trim()
    if (!text || pending) return
    if (voice.canSendRealtimeText) {
      try {
        voice.sendText(text)
        setChatError(undefined)
      } catch (cause) {
        setChatError(cause instanceof Error ? cause.message : 'Realtime message failed.')
      }
      return
    }
    const turnId = createCopilotId()
    const userId = `pending-user-${turnId}`
    const assistantId = `pending-assistant-${turnId}`
    setChatError(undefined)
    setToolStatus(undefined)
    setPending(true)
    setMessages(previous => [
      ...previous,
      temporaryMessage(userId, 'user', text),
      temporaryMessage(assistantId, 'assistant', '')
    ])

    try {
      await api.streamCopilotMessage({
        clientId: clientIdRef.current,
        conversationId: DEFAULT_CONVERSATION_ID,
        message: text,
        turnId
      }, event => applyStreamEvent(event, assistantId, setMessages, setToolStatus))
      await loadHistory()
    } catch (cause) {
      setMessages(previous => previous.filter(message => message.id !== assistantId || message.text))
      setChatError(cause instanceof Error ? cause.message : 'Copilot request failed.')
    } finally {
      setPending(false)
      setToolStatus(undefined)
    }
  }, [api, pending, voice])

  const editProfile = async (profileId: string): Promise<void> => {
    try {
      setChatError(undefined)
      setProfileDraft(toProfileDraft(await api.getCopilotProfile(profileId)))
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Unable to load Copilot profile.')
    }
  }

  const createProfile = async (): Promise<void> => {
    try {
      setChatError(undefined)
      const source = await api.getCopilotProfile(voice.activeProfile.id)
      setProfileDraft({
        characterSpeech: source.characterSpeech,
        characterText: source.characterText,
        description: '',
        id: '',
        mark: '?',
        name: '',
        templateProfileId: source.profile.id,
        voice: source.profile.voice
      })
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Unable to prepare a new Copilot profile.')
    }
  }

  const saveProfile = async (draft: ProfileDraft): Promise<void> => {
    setProfileSaving(true)
    setChatError(undefined)
    try {
      const input = {
        characterSpeech: draft.characterSpeech,
        characterText: draft.characterText,
        profile: {
          description: draft.description,
          id: draft.id,
          mark: draft.mark,
          name: draft.name,
          voice: draft.voice
        },
        ...(draft.templateProfileId === undefined ? {} : { templateProfileId: draft.templateProfileId })
      }
      const saved = draft.templateProfileId === undefined
        ? await api.updateCopilotProfile(draft.id, input)
        : await api.createCopilotProfile(input)
      setProfileDraft(toProfileDraft(saved))
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Unable to save Copilot profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <PhoenixShell
      activePrimaryItemId="copilot"
      activeSecondaryItemId={view}
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="copilot-page">
        <PageHeader
          title={view === 'chat' ? 'Copilot' : 'Profiles'}
          eyebrow={view === 'chat' ? 'Text channel' : 'Characters'}
          description={view === 'chat'
            ? 'Persistent shipboard conversation with current PHOENIX telemetry.'
            : 'Select, create, and tune Copilot characters.'}
        />
        <PageContent>
          <div className={`copilot-workspace copilot-workspace--${view}`}>
            <aside className="copilot-sidebar" aria-label="Copilot profile">
              <h2>Copilot profile</h2>
              {view === 'chat'
                ? <>
                    <article className="copilot-identity-card">
                      <div className="copilot-identity-card__portrait" aria-hidden="true">
                        {voice.activeProfile.mark}
                      </div>
                      <div className="copilot-identity-card__name">
                        <strong>{voice.activeProfile.name.toUpperCase()}</strong>
                        <span>{voice.connected ? 'Voice online' : 'Standing by'}</span>
                      </div>
                      <p>{voice.activeProfile.description}</p>
                      <dl>
                        <div><dt>Voice</dt><dd>{voice.activeProfile.voice}</dd></div>
                        <div><dt>Channel</dt><dd>{voice.connected ? 'Realtime' : 'Text'}</dd></div>
                      </dl>
                    </article>
                    <label className="copilot-profile-select">
                      Quick switch
                      <select
                        value={voice.activeProfile.id}
                        disabled={voice.connected || voice.transitioning}
                        onChange={event => void voice.selectProfile(event.target.value).catch(cause => setChatError(
                          cause instanceof Error ? cause.message : 'Unable to change Copilot profile.'
                        ))}
                      >
                        {voice.profiles.map(profile => (
                          <option key={profile.id} value={profile.id}>{profile.name}</option>
                        ))}
                      </select>
                    </label>
                  </>
                : <>
                    {voice.profiles.map(profile => (
                      <button
                        className="copilot-profile"
                        type="button"
                        key={profile.id}
                        aria-pressed={profile.id === voice.activeProfile.id}
                        disabled={voice.connected || voice.transitioning}
                        title={profile.description}
                        onClick={() => { void editProfile(profile.id) }}
                      >
                        <span className="copilot-profile__mark">{profile.mark}</span>
                        <span>
                          <strong>{profile.name.toUpperCase()}</strong>
                          <small>{profile.id === voice.activeProfile.id ? 'Active profile' : profile.description}</small>
                        </span>
                      </button>
                    ))}
                    <div className="copilot-profile-actions">
                      <button type="button" onClick={() => { void editProfile(voice.activeProfile.id) }}>Edit active</button>
                      <button type="button" onClick={() => { void createProfile() }}>New profile</button>
                    </div>
                  </>}
            </aside>

            {view === 'profiles'
              ? (profileDraft
              ? <CopilotProfileEditor
                  draft={profileDraft}
                  saving={profileSaving}
                  onCancel={() => setProfileDraft(undefined)}
                  onChange={setProfileDraft}
                  onSave={saveProfile}
                />
              : <section className="copilot-profile-placeholder">
                  <strong>Select a profile</strong>
                  <span>Choose a character to edit, or create a new Copilot profile.</span>
                </section>)
              : <section className="copilot-chat" aria-label="Copilot conversation">
              <CopilotMessageHistory
                activeTurn={voice.activeTurn}
                messages={messages}
                pending={pending}
                profileName={voice.activeProfile.name}
                remoteTurns={remoteTurns}
              />
              {(toolStatus ?? voice.toolStatus) && (
                <p className="copilot-tool-status">{toolStatus ?? voice.toolStatus}</p>
              )}
              {(chatError ?? voice.error) && (
                <p className="copilot-error" role="alert">{chatError ?? voice.error}</p>
              )}
              <CopilotComposer
                disabled={pending}
                profileName={voice.activeProfile.name}
                voice={voice}
                onSubmitText={submit}
              />
                </section>}
          </div>
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function CopilotProfileEditor ({
  draft,
  onCancel,
  onChange,
  onSave,
  saving
}: {
  draft: ProfileDraft
  onCancel: () => void
  onChange: (draft: ProfileDraft) => void
  onSave: (draft: ProfileDraft) => Promise<void>
  saving: boolean
}) {
  const update = (field: keyof ProfileDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...draft, [field]: event.target.value })
  }
  const creating = draft.templateProfileId !== undefined
  return (
    <form className="copilot-profile-editor" onSubmit={event => {
      event.preventDefault()
      void onSave(draft)
    }}>
      <header>
        <div><span>Copilot profile</span><h2>{creating ? 'Create character' : `Edit ${draft.name}`}</h2></div>
        <button type="button" onClick={onCancel}>Return to channel</button>
      </header>
      <div className="copilot-profile-editor__metadata">
        <label>Profile ID<input value={draft.id} disabled={!creating} pattern="[a-z][a-z0-9_-]*" onChange={update('id')} /></label>
        <label>Name<input value={draft.name} maxLength={48} required onChange={update('name')} /></label>
        <label>Mark<input value={draft.mark} maxLength={3} required onChange={update('mark')} /></label>
        <label>Realtime voice<input value={draft.voice} required onChange={update('voice')} /></label>
      </div>
      <label>Description<input value={draft.description} maxLength={240} onChange={update('description')} /></label>
      <label>Text character prompt<textarea value={draft.characterText} required onChange={update('characterText')} /></label>
      <label>Speech character prompt<textarea value={draft.characterSpeech} required onChange={update('characterSpeech')} /></label>
      <footer>
        <span>Operational rules and agent composition are protected.</span>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : creating ? 'Create profile' : 'Save profile'}</button>
      </footer>
    </form>
  )
}

function toProfileDraft (document: CopilotProfileDocument): ProfileDraft {
  return {
    characterSpeech: document.characterSpeech,
    characterText: document.characterText,
    description: document.profile.description,
    id: document.profile.id,
    mark: document.profile.mark,
    name: document.profile.name,
    voice: document.profile.voice
  }
}

interface CopilotMessageHistoryProps {
  activeTurn?: { assistantText: string, userText: string }
  messages: readonly CopilotHistoryMessage[]
  pending: boolean
  profileName: string
  remoteTurns: Record<string, RemoteTurn>
}

const CopilotMessageHistory = memo(function CopilotMessageHistory ({
  activeTurn,
  messages,
  pending,
  profileName,
  remoteTurns
}: CopilotMessageHistoryProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [activeTurn, messages, remoteTurns])

  return (
    <div className="copilot-messages" aria-live="polite">
      {messages.length === 0 && <p className="copilot-empty">No conversation yet. {profileName} is standing by.</p>}
      {messages.map(message => (
        <article key={message.id} className={`copilot-message copilot-message--${message.role}`}>
          <span>{message.role === 'user' ? 'Commander' : 'Copilot'}</span>
          <div className="copilot-message__text">
            {message.role === 'assistant'
              ? <CopilotMarkdown>{message.text || (pending ? '…' : '')}</CopilotMarkdown>
              : message.text}
          </div>
        </article>
      ))}
      {activeTurn?.userText && (
        <article className="copilot-message copilot-message--user copilot-message--live">
          <span>Commander · live</span>
          <div className="copilot-message__text">{activeTurn.userText}</div>
        </article>
      )}
      {activeTurn && (
        <article className="copilot-message copilot-message--assistant copilot-message--live">
          <span>Copilot · live</span>
          <div className="copilot-message__text"><CopilotMarkdown>{activeTurn.assistantText || '…'}</CopilotMarkdown></div>
        </article>
      )}
      {Object.values(remoteTurns).map(turn => (
        <div key={turn.id} className="copilot-live-turn">
          {turn.userText && (
            <article className="copilot-message copilot-message--user copilot-message--live">
              <span>Commander · live</span>
              <div className="copilot-message__text">{turn.userText}</div>
            </article>
          )}
          <article className="copilot-message copilot-message--assistant copilot-message--live">
            <span>Copilot · live</span>
            <div className="copilot-message__text"><CopilotMarkdown>{turn.assistantText || '…'}</CopilotMarkdown></div>
          </article>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
})

const CopilotComposer = memo(function CopilotComposer ({
  disabled,
  profileName,
  voice,
  onSubmitText
}: {
  disabled: boolean
  profileName: string
  voice: ReturnType<typeof useCopilotVoice>
  onSubmitText: (text: string) => Promise<void>
}) {
  const [composer, setComposer] = useState('')

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const text = composer.trim()
    if (!text || disabled) return
    setComposer('')
    void onSubmitText(text)
  }

  return (
    <form className="copilot-composer" onSubmit={submit}>
      <label htmlFor="copilot-message">Message Copilot</label>
      <textarea
        id="copilot-message"
        value={composer}
        disabled={disabled}
        placeholder={`Ask ${profileName}…`}
        rows={3}
        onChange={event => setComposer(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button type="submit" disabled={disabled || !composer.trim()}>
        {disabled ? 'Transmitting…' : 'Send'}
      </button>
      <CopilotVoiceToggle iconOnly voice={voice} />
    </form>
  )
})

function withoutTurn (
  turns: Record<string, RemoteTurn>,
  turnId: string
): Record<string, RemoteTurn> {
  const next = { ...turns }
  delete next[turnId]
  return next
}

function applyStreamEvent (
  event: CopilotStreamEvent,
  assistantId: string,
  setMessages: (update: (messages: readonly CopilotHistoryMessage[]) => readonly CopilotHistoryMessage[]) => void,
  setToolStatus: (status: string | undefined) => void
): void {
  if (event.type === 'delta') {
    setMessages(messages => messages.map(message => message.id === assistantId
      ? { ...message, text: `${message.text}${event.delta}` }
      : message))
  } else if (event.type === 'reset') {
    setMessages(messages => messages.map(message => message.id === assistantId
      ? { ...message, text: '' }
      : message))
  } else if (event.type === 'retrying') {
    setToolStatus(`Provider stream retry ${event.attempt}…`)
  } else if (event.type === 'tool') {
    setToolStatus(event.name ? `${event.name}: ${event.status}` : `Tool: ${event.status}`)
  }
}

function temporaryMessage (
  id: string,
  role: CopilotHistoryMessage['role'],
  text: string
): CopilotHistoryMessage {
  return {
    createdAt: new Date().toISOString(),
    id,
    role,
    text
  }
}
