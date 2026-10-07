import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Field, Form, FormActions, PageFrame, PageHeader, TextInput } from '@phoenix/ui'
import type { PairingInfo } from '@phoenix/contracts'
import type { PhoenixApi } from '../application/api/phoenix-api.js'
import { PairingAccess } from '../components/pairing-access.js'
type PairingGateState =
  | { status: 'checking' }
  | { status: 'pairing', error?: string, info?: PairingInfo }
  | { status: 'authenticated' }

export function PairingGate({ api, children, initialCode = '', onPairingRequired }: { api: PhoenixApi, children: ReactNode, initialCode?: string, onPairingRequired?: () => void }) {
  const [state, setState] = useState<PairingGateState>({ status: 'checking' })

  useEffect(() => {
    const abort = new AbortController()
    void api.getPairingStatus(abort.signal)
      .then(async status => {
        if (abort.signal.aborted) return
        if (status.authenticated) {
          setState({ status: 'authenticated' })
          return
        }
        if (!status.serverDevice) {
          setState({ status: 'pairing' })
          return
        }
        try {
          const info = await api.getPairingInfo(abort.signal)
          if (!abort.signal.aborted) setState({ status: 'pairing', info })
        } catch (cause) {
          if (!abort.signal.aborted) setState({
            status: 'pairing',
            error: cause instanceof Error ? cause.message : 'PHOENIX pairing information unavailable.'
          })
        }
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

  useEffect(() => {
    if (state.status !== 'authenticated') return
    const abort = new AbortController()
    let checking = false
    const check = async (): Promise<void> => {
      if (checking) return
      checking = true
      try {
        const status = await api.getPairingStatus(abort.signal)
        if (!abort.signal.aborted && !status.authenticated) {
          setState({ status: 'pairing' })
          onPairingRequired?.()
        }
      } catch {
        // Offline/server failures are not revocation. Normal connection feedback still applies.
      } finally { checking = false }
    }
    const visible = (): void => { if (!document.hidden) void check() }
    const timer = setInterval(() => void check(), 5000)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible)
    return () => {
      abort.abort()
      clearInterval(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible)
    }
  }, [api, state.status, onPairingRequired])

  if (state.status === 'authenticated') return children
  return (
    <PairingPage
      initialCode={initialCode}
      checking={state.status === 'checking'}
      error={state.status === 'pairing' ? state.error : undefined}
      info={state.status === 'pairing' ? state.info : undefined}
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
  info,
  initialCode,
  onPair
}: {
  checking: boolean
  error?: string
  info?: PairingInfo
  initialCode: string
  onPair(code: string): Promise<void>
}) {
  const [code, setCode] = useState(initialCode)
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
        <img className="pairing-logo" src="/phoenix.svg" alt="Phoenix" />
        <PageHeader
          context="Device authorization"
          description="Authorize this browser against the local PHOENIX installation."
          title="PHOENIX"
          variant="cockpit"
        />
        {checking
          ? <p className="pairing-status">Establishing secure link…</p>
          : (
              <>
                {info && <PairingAccess info={info} />}
                <Form onSubmit={event => void submit(event)}>
                  <Field
                    error={localError ?? error}
                    hint={initialCode ? 'Confirm the code from your scanned link to pair this device.' : info ? 'Enter the code shown above.' : 'Enter the code shown on the PHOENIX computer.'}
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
              </>
            )}
      </section>
    </PageFrame>
  )
}
