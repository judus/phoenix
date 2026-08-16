import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Field, Form, FormActions, PageFrame, PageHeader, TextInput } from '@phoenix/ui'
import type { PhoenixApi } from '../application/api/phoenix-api.js'
type PairingGateState =
  | { status: 'checking' }
  | { status: 'pairing', error?: string }
  | { status: 'authenticated' }

export function PairingGate({ api, children }: { api: PhoenixApi, children: ReactNode }) {
  const [state, setState] = useState<PairingGateState>({ status: 'checking' })

  useEffect(() => {
    const abort = new AbortController()
    void api.getPairingStatus(abort.signal)
      .then(status => {
        if (abort.signal.aborted) return
        setState(status.authenticated
          ? { status: 'authenticated' }
          : { status: 'pairing' })
      })
      .catch(cause => {
        if (abort.signal.aborted) return
        setState({
          status: 'pairing',
          error: cause instanceof Error ? cause.message : 'PHOENIX pairing unavailable.'
        })
      })
    return () => abort.abort()
  }, [api])

  if (state.status === 'authenticated') return children
  return (
    <PairingPage
      checking={state.status === 'checking'}
      error={state.status === 'pairing' ? state.error : undefined}
      onPair={async code => {
        const status = await api.claimPairing(code)
        if (!status.authenticated) throw new Error('PHOENIX did not authorize this device.')
        setState({ status: 'authenticated' })
      }}
    />
  )
}

function PairingPage({
  checking,
  error,
  onPair
}: {
  checking: boolean
  error?: string
  onPair(code: string): Promise<void>
}) {
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const candidate = code.trim()
    if (!candidate || pending) return
    setPending(true)
    try {
      await onPair(candidate)
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Device pairing failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <PageFrame className="pairing-gate" layout="fit">
      <section>
        <PageHeader
          context="Device authorization"
          description="Authorize this browser against the local PHOENIX installation."
          title="PHOENIX"
          variant="cockpit"
        />
        {checking
          ? <p className="pairing-status">Establishing secure link…</p>
          : (
              <Form onSubmit={event => void submit(event)}>
                <Field
                  error={localError ?? error}
                  hint="Enter the code shown in the PHOENIX server terminal."
                  htmlFor="pairing-code"
                  label="Pairing code"
                  required
                >
                  <TextInput
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    autoFocus
                    name="pairing-code"
                    placeholder="XXXXX-XXXXX"
                    spellCheck={false}
                    value={code}
                    onChange={event => setCode(event.target.value.toUpperCase())}
                  />
                </Field>
                <FormActions>
                  <Button busy={pending} disabled={!code.trim()} type="submit" variant="primary">
                    Pair device
                  </Button>
                </FormActions>
              </Form>
            )}
      </section>
    </PageFrame>
  )
}
