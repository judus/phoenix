import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { FileAgentProfileRepository } from '@phoenix/copilot'
import { expect, test } from 'vitest'
import { prepareWritableAgentProfiles } from '../apps/server/src/infrastructure/writable-agent-profiles.js'
import { ApplicationPaths } from '../apps/server/src/infrastructure/application-paths.js'

test('relocated bundled Copilots preserve existing customized and user-created profiles', () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-copilot-upgrade-'))
  const paths = new ApplicationPaths({ environment: {}, installRoot: resolve('.'), userRoot: root })
  const userProfiles = join(paths.user.data, 'copilot/agents')

  try {
    cpSync(paths.resources.copilots, userProfiles, { recursive: true })
    const repository = new FileAgentProfileRepository(userProfiles)
    const original = repository.getEditable('marin')
    const edited = {
      ...original,
      characterText: 'MY TEXT',
      characterSpeech: 'MY VOICE',
      descriptor: { ...original.descriptor, name: 'My Marin' }
    }
    repository.update(edited)
    repository.create({ ...edited, descriptor: { ...edited.descriptor, id: 'custom', name: 'Custom' } }, 'marin')

    for (let start = 0; start < 2; start++) {
      expect(prepareWritableAgentProfiles(paths.resources.copilots, userProfiles)).toBe(userProfiles)
      expect(repository.getEditable('marin')).toMatchObject(edited)
      expect(repository.getEditable('custom')).toMatchObject({ descriptor: { id: 'custom', name: 'Custom' } })
    }
    expect(new FileAgentProfileRepository(paths.resources.copilots).getEditable('marin')).toEqual(original)
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

test.skipIf(process.platform === 'win32')('agent resources seed an independently writable user profile repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'phoenix-agent-profiles-'))
  const resources = join(root, 'resources')
  const resourceProfile = join(resources, 'marin')
  const userProfiles = join(root, 'user/profiles')
  mkdirSync(resourceProfile, { recursive: true })
  const files = {
    'agent.md': 'AGENT',
    'audio.json': '{}',
    'character.speech.md': 'SPEECH',
    'character.text.md': 'TEXT',
    'operational.md': 'OPERATIONS',
    'profile.json': JSON.stringify({ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }),
    'prologue.md': 'PROLOGUE'
  }
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(resourceProfile, file), contents)
    chmodSync(join(resourceProfile, file), 0o444)
  }
  chmodSync(resourceProfile, 0o555)
  chmodSync(resources, 0o555)

  try {
    const repository = new FileAgentProfileRepository(prepareWritableAgentProfiles(resources, userProfiles))
    const profile = repository.getEditable('marin')
    repository.update({ ...profile, characterText: 'UPDATED' })

    expect(readFileSync(join(userProfiles, 'marin/character.text.md'), 'utf8')).toBe('UPDATED\n')
    expect(readFileSync(join(resourceProfile, 'character.text.md'), 'utf8')).toBe('TEXT')
  } finally {
    chmodSync(resources, 0o755)
    chmodSync(resourceProfile, 0o755)
    rmSync(root, { force: true, recursive: true })
  }
})
