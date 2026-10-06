import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const expression = workflow.match(/^\s+installers: \$\{\{ (.+) \}\}$/m)?.[1]
if (!expression) throw new Error('CI must pass an explicit installer policy to native verification')
// This policy uses only boolean operators and event fields, shared by JS and Actions expressions.
const buildsInstallers = new Function('github', `return (${expression})`)
const gate = workflow.split('\n  gate:\n')[1]
const gateNameExpression = gate.match(/^\s+name: \$\{\{ (.+) \}\}$/m)?.[1]
if (!gateNameExpression) throw new Error('CI gate must distinguish installer verification from ordinary checks')
const gateName = new Function('github', `return (${gateNameExpression})`)

test.each([
  ['push', 'refs/heads/dev', '', false],
  ['push', 'refs/heads/main', '', false],
  ['pull_request', 'refs/pull/1/merge', 'dev', false],
  ['pull_request', 'refs/pull/1/merge', 'main', true],
  ['workflow_dispatch', 'refs/heads/dev', '', true],
  ['workflow_dispatch', 'refs/heads/main', '', true]
])('installer policy for %s on %s targeting %s is %s', (event_name, ref, base_ref, expected) => {
  expect(buildsInstallers({ event_name, ref, base_ref })).toBe(expected)
  expect(gateName({ event_name, ref, base_ref })).toBe(expected ? 'Installers passed' : 'CI passed')
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
