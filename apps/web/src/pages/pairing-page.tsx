import { useState, type FormEvent } from 'react'

export interface PairingPageProps {
  checking: boolean
  error?: string
  onPair(code: string): Promise<void>
}

export function PairingPage ({ checking, error, onPair }: PairingPageProps) {
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!code.trim() || pending) return
    setPending(true)
    try {
      await onPair(code)
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Device pairing failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="pairing-page">
      <section className="pairing-panel">
        <header>
          <span className="pairing-mark">P</span>
          <div><h1>PHOENIX</h1><p>DEVICE AUTHORIZATION</p></div>
        </header>
        {checking
          ? <p className="pairing-status">Establishing secure link…</p>
          : (
              <form onSubmit={event => void submit(event)}>
                <p>Enter the pairing code shown in the PHOENIX server terminal.</p>
                <label htmlFor="pairing-code">Pairing code</label>
                <input
                  id="pairing-code"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  autoFocus
                  spellCheck={false}
                  value={code}
                  onChange={event => setCode(event.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX"
                />
                {(localError ?? error) && <p className="pairing-error" role="alert">{localError ?? error}</p>}
                <button type="submit" disabled={pending || !code.trim()}>
                  {pending ? 'Authorizing…' : 'Pair device'}
                </button>
              </form>
            )}
      </section>
    </main>
  )
}
