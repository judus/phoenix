import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const expression = workflow.match(/^\s+installers: \$\{\{ (.+) \}\}$/m)?.[1]
if (!expression) throw new Error('CI must pass an explicit installer policy to native verification')
// This policy uses only boolean operators and event fields, shared by JS and Actions expressions.
const buildsInstallers = new Function('github', `return (${expression})`)

test.each([
  ['push', 'refs/heads/dev', '', false],
  ['push', 'refs/heads/main', '', false],
  ['pull_request', 'refs/pull/1/merge', 'dev', false],
  ['pull_request', 'refs/pull/1/merge', 'main', true],
  ['workflow_dispatch', 'refs/heads/dev', '', true],
  ['workflow_dispatch', 'refs/heads/main', '', true]
])('installer policy for %s on %s targeting %s is %s', (event_name, ref, base_ref, expected) => {
  expect(buildsInstallers({ event_name, ref, base_ref })).toBe(expected)
})
