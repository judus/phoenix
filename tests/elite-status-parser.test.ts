import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { parseEliteStatus } from '@phoenix/elite'

const fixturePath = fileURLToPath(new URL('./fixtures/elite/status-docked.json', import.meta.url))

test('Status.json is normalized with complete unsigned flag decoding', () => {
  const status = parseEliteStatus(JSON.parse(readFileSync(fixturePath, 'utf8')))

  expect(status).toMatchObject({
    timestamp: '2026-08-10T14:00:00Z',
    flags: {
      docked: true,
      landingGearDown: true,
      shieldsUp: true,
      hardpointsDeployed: true,
      lightsOn: true,
      cargoScoopDeployed: true,
      inMainShip: true,
      nightVision: true,
      srvHighBeam: false
    },
    pips: { systems: 4, engines: 6, weapons: 2 },
    guiFocus: { id: 0, label: 'none' },
    fuel: { main: 27.5, reservoir: 0.63 },
    cargo: 96
  })
})

test('the highest Flags and current Flags2 bits are decoded without signed overflow', () => {
  const status = parseEliteStatus({
    timestamp: '2026-08-10T14:01:00Z',
    event: 'Status',
    Flags: 2147483648,
    Flags2: 3670016
  })

  expect(status.flags.srvHighBeam).toBe(true)
  expect(status.flags2).toMatchObject({
    fsdHyperdriveCharging: true,
    supercruiseOverdriveActive: true,
    supercruiseAssistActive: true
  })
})
