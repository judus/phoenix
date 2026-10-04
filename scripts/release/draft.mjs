import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { validateTag } from './check-tag.mjs'
import { verifyAssets } from './assets.mjs'

const root = process.cwd()
const { tag, version, commit } = validateTag(root, process.env.RELEASE_TAG)
const files = verifyAssets(resolve(root, 'dist/release'), version, commit)
const repository = process.env.GH_REPO
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('GH_REPO must identify the release repository.')
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const releases = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repository}/releases`)).flat()
const existing = releases.find(release => release.tag_name === tag)
if (existing && !existing.draft) throw new Error('Refusing to modify an already published release. Use a new version.')
if (existing) {
  gh('release', 'upload', tag, ...files, '--clobber', '--repo', repository)
} else {
  gh('release', 'create', tag, ...files, '--repo', repository, '--verify-tag', '--draft', '--prerelease', '--latest=false',
    '--title', `PHOENIX ${version} preview`, '--generate-notes', '--notes-file', resolve(root, 'scripts/release/preview-notes.md'))
}
console.log(`Draft preview ready for review: ${repository} ${tag}. Nothing was published.`)
