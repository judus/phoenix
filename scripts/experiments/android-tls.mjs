// Opt-in development experiment only. Normal HTTP and APK packaging are unchanged.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, chmodSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const directory = resolve(root, 'data/runtime/android-tls')
const cert = resolve(directory, 'certificate.pem')
const key = resolve(directory, 'private-key.pem')
const command = process.argv[2]
const port = process.env.PHOENIX_EXPERIMENTAL_TLS_PORT ?? '3443'

if (command === 'prepare') {
  if (existsSync(cert) || existsSync(key)) throw new Error('Certificate already exists. Keep it for stable device identity; do not regenerate silently.')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const addresses = new Set(['127.0.0.1', '10.0.2.2'])
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) {
    if (entry.family === 'IPv4' && !entry.internal) addresses.add(entry.address)
  }
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '90',
    '-subj', '/CN=PHOENIX experimental gateway', '-addext', `subjectAltName=DNS:localhost,${[...addresses].map(ip => `IP:${ip}`).join(',')}`,
    '-keyout', key, '-out', cert], { stdio: 'ignore' })
  chmodSync(key, 0o600)
  chmodSync(cert, 0o600)
  console.log('Prepared a private installation certificate in ignored data/runtime/android-tls. Valid for 90 days; rescan after deliberate certificate renewal.')
} else if (command === 'run') {
  if (!existsSync(cert) || !existsSync(key)) throw new Error('Run prepare first.')
  const child = spawn('npm', ['run', 'dev'], { cwd: root, stdio: 'inherit', env: { ...process.env,
    PHOENIX_EXPERIMENTAL_TLS_CERT: cert, PHOENIX_EXPERIMENTAL_TLS_KEY: key, PHOENIX_EXPERIMENTAL_TLS_PORT: port } })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
  child.once('exit', code => { process.exitCode = code ?? 1 })
} else if (command === 'qr') {
  const helperPort = 3444
  const html = `<!doctype html><meta charset="utf-8"><title>PHOENIX TLS experiment</title>
<style>body{background:#09090d;color:#dce6ed;font:18px sans-serif;padding:2rem}section{display:inline-block;margin:1rem;vertical-align:top}img{background:white;padding:1rem}code{display:block;max-width:32rem;overflow-wrap:anywhere}button{padding:1rem}</style>
<h1>PHOENIX TLS experiment</h1><p>Scan a LAN address with the separate TLS experiment APK. The 127.0.0.1 address is for this computer only.</p><main></main>
<script>fetch('/info').then(async r=>{if(!r.ok)throw Error('Start PHOENIX with the experimental TLS listener first.');return r.json()}).then(info=>{for(const item of info.access){const s=document.createElement('section');const h=document.createElement('h2');h.textContent=item.origin;const img=document.createElement('img');img.src=item.qrDataUrl;img.alt='Experimental pairing QR';const pin=document.createElement('code');pin.textContent='SHA-256: '+new URL(item.pairingUrl).searchParams.get('pin');const copy=document.createElement('button');copy.textContent='Copy experimental pairing link';copy.onclick=()=>navigator.clipboard.writeText(item.pairingUrl);s.append(h,img,pin,copy);document.querySelector('main').append(s)}}).catch(e=>document.querySelector('main').textContent=e.message)</script>`
  const server = createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store')
    if (request.headers.host !== `127.0.0.1:${helperPort}` || (request.headers.origin && request.headers.origin !== `http://127.0.0.1:${helperPort}`)) {
      response.writeHead(403).end(); return
    }
    if (request.method !== 'GET') { response.writeHead(405).end(); return }
    if (request.url === '/') { response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(html); return }
    if (request.url !== '/info') { response.writeHead(404).end(); return }
    try {
      const upstream = await fetch('http://127.0.0.1:3400/api/pairing/gateway-info', { signal: AbortSignal.timeout(5000) })
      response.writeHead(upstream.status, { 'content-type': 'application/json' })
      response.end(await upstream.text())
    } catch { response.writeHead(502).end('Experimental TLS server unavailable.') }
  })
  server.listen(helperPort, '127.0.0.1', () => console.log(`Experimental QR display: http://127.0.0.1:${helperPort}`))
} else throw new Error('Usage: node scripts/experiments/android-tls.mjs prepare|run|qr')
