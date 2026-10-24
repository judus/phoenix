import { execFileSync } from 'node:child_process'
import { createPrivateKey, X509Certificate } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'

export function certificateFiles(directory) {
  return { cert: join(directory, 'certificate.pem'), key: join(directory, 'private-key.pem') }
}

/** Validate the retained identity before starting a listener or displaying its QR. */
export function inspectCertificate(directory, now = new Date()) {
  const { cert, key } = certificateFiles(directory)
  if (!existsSync(cert) || !existsSync(key)) throw new Error('TLS identity is incomplete. Restore both certificate and private key, or deliberately renew and re-pair devices.')
  const certificate = new X509Certificate(readFileSync(cert))
  if (!certificate.checkPrivateKey(createPrivateKey(readFileSync(key)))) throw new Error('TLS certificate and private key do not match. Restore the installation identity or deliberately renew and re-pair devices.')
  if (now < new Date(certificate.validFrom) || now >= new Date(certificate.validTo)) {
    throw new Error('TLS certificate is not currently valid. Check the computer clock or run the explicit renew command, then scan the new QR on paired devices.')
  }
  return { ...certificateFiles(directory), fingerprint: certificate.fingerprint256.replaceAll(':', '').toLowerCase(), validTo: certificate.validTo }
}

/** Creation/rotation is deliberate; valid identities are reused by startup. */
export function prepareCertificate(directory, addresses, { renew = false } = {}) {
  const { cert, key } = certificateFiles(directory)
  if (!renew && (existsSync(cert) || existsSync(key))) throw new Error('TLS identity already exists. Keep it for stable device identity; use explicit renew only when re-pairing devices is intended.')
  if (!addresses.length || addresses.some(address => !isIP(address))) throw new Error('TLS certificate addresses must be literal IP addresses.')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temporary = mkdtempSync(join(directory, '.prepare-'))
  try {
    const prepared = certificateFiles(temporary)
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '90',
      '-subj', '/CN=PHOENIX experimental gateway', '-addext', `subjectAltName=DNS:localhost,${[...new Set(addresses)].map(ip => `IP:${ip}`).join(',')}`,
      '-keyout', prepared.key, '-out', prepared.cert], { stdio: 'ignore' })
    chmodSync(prepared.key, 0o600)
    chmodSync(prepared.cert, 0o600)
    inspectCertificate(temporary)
    renameSync(prepared.key, key)
    renameSync(prepared.cert, cert)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
  return inspectCertificate(directory)
}

export function ensureCertificate(directory, addresses) {
  const { cert, key } = certificateFiles(directory)
  if (!existsSync(cert) && !existsSync(key)) return prepareCertificate(directory, addresses)
  return inspectCertificate(directory)
}
