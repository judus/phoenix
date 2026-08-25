import { useState } from 'react'
import type { PairingInfo } from '@phoenix/contracts'

export function PairingAccess ({ info }: { info: PairingInfo }) {
  const [selectedAccess, setSelectedAccess] = useState(0)
  const access = info.access[selectedAccess] ?? info.access[0]
  return (
    <section aria-label="Pair another device" className="pairing-access">
      <div className="pairing-access-copy">
        <h2>Pair another device</h2>
        <p>Connect it to the same network, scan the QR code, then confirm the pairing page.</p>
        <div className="pairing-code">
          <small>Pairing code</small>
          <strong>{info.pairingCode}</strong>
        </div>
        {access
          ? <>
              {info.access.length > 1 && <label className="pairing-address-select">
                <span>Network address</span>
                <select value={selectedAccess} onChange={event => setSelectedAccess(Number(event.target.value))}>
                  {info.access.map((candidate, index) => <option key={candidate.url} value={index}>{candidate.url}</option>)}
                </select>
              </label>}
              <a href={access.url}>{access.url}</a>
            </>
          : <p className="pairing-unavailable">No LAN address detected. Check this computer&apos;s network connection.</p>}
      </div>
      {access && <img alt={`QR code for ${access.url}`} className="pairing-qr" src={access.qrDataUrl} />}
    </section>
  )
}
