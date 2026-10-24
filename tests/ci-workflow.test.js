import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const verification = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const release = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
function expression(source, key) {
  const value = source.match(new RegExp(`^\\s+${key}: \\$\\{\\{ (.+) \\}\\}$`, 'm'))?.[1]
  if (!value) throw new Error(`Missing CI policy expression: ${key}`)
  return new Function('github', 'inputs', 'fromJSON', `return (${value})`)
}
const buildsInstallers = expression(workflow, 'installers')
const includesWindows = expression(workflow, 'windows')
const runners = expression(verification, 'os')
const gate = workflow.split('\n  gate:\n')[1]
const gateName = expression(gate, 'name')

const cases = [
  ['pull_request', 'dev', {}, ['ubuntu-24.04'], false],
  ['pull_request', 'main', {}, ['ubuntu-24.04', 'windows-2022'], true],
  ['workflow_dispatch', '', { windows: true, installers: false }, ['ubuntu-24.04', 'windows-2022'], false],
  ['workflow_dispatch', '', { windows: false, installers: false }, ['ubuntu-24.04'], false],
  ['workflow_dispatch', '', { windows: false, installers: true }, ['ubuntu-24.04', 'windows-2022'], true],
  ['workflow_dispatch', '', { windows: true, installers: true }, ['ubuntu-24.04', 'windows-2022'], true]
]
test.each(cases)('CI policy for %s targeting %s with %j', (event_name, base_ref, inputs, expectedRunners, installers) => {
  const github = { event_name, base_ref }
  const selected = { windows: includesWindows(github, inputs), installers: buildsInstallers(github, inputs), 'release-assets': false }
  expect(selected.installers).toBe(installers)
  expect(runners(github, selected, JSON.parse)).toEqual(expectedRunners)
  expect(gateName(github, inputs)).toBe(installers ? 'Installers passed' : 'CI passed')
})

test('CI runs on PRs and manual dispatch, without duplicate branch-push checks', () => {
  const events = workflow.split('\npermissions:')[0]
  expect(events).not.toMatch(/^  push:/m)
  expect(events).toMatch(/^  pull_request:\n    branches: \[dev, main\]/m)
  expect(events).toMatch(/^  workflow_dispatch:/m)
  expect(events).toMatch(/windows:[\s\S]*?type: boolean\n        default: true/)
  expect(events).toMatch(/installers:[\s\S]*?type: boolean\n        default: false/)
})

test('tagged releases and installer callers always verify both native platforms', () => {
  expect(release).toMatch(/push:\n    tags:/)
  expect(release).toMatch(/uses: \.\/\.github\/workflows\/verify.yml[\s\S]*?installers: true\n      release-assets: true/)
  for (const inputs of [{ installers: true }, { 'release-assets': true }]) {
    expect(runners({}, inputs, JSON.parse)).toEqual(['ubuntu-24.04', 'windows-2022'])
  }
  expect(verification).toContain('run: npm run check')
})

test.each(['success', 'failure', 'cancelled', 'skipped'])('CI gate accepts only successful native verification: %s', RESULT => {
  expect(gate).toMatch(/^    if: always\(\)$/m)
  expect(gate).toMatch(/^    needs: verify$/m)
  expect(gate).toContain('RESULT: ${{ needs.verify.result }}')
  const command = gate.match(/^\s+run: (.+)$/m)?.[1]
  expect(command).toBeDefined()
  // Execute the gate's actual shell command, including on Windows' Git bash in CI.
  const result = spawnSync('bash', ['-c', command], { env: { ...process.env, RESULT }, encoding: 'utf8' })
  expect(result.error).toBeUndefined()
  expect(result.status).not.toBeNull()
  expect(result.status === 0, result.stderr).toBe(RESULT === 'success')
})
