import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateTag (root, tag) {
  const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  // Numeric versions work consistently in Node, Debian and Inno Setup. Preview is a release flag.
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '') || tag !== `v${version}`) {
    throw new Error('Release tag must be v<package.json version>, using three numeric components.')
  }
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
  if (lock.version !== version || lock.packages[''].version !== version) throw new Error('Package lock version does not match.')
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const commit = git('rev-parse', 'HEAD')
  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== commit) throw new Error('Checkout does not match the release tag.')
  git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main')
  return { tag, version, commit }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateTag(process.cwd(), process.env.RELEASE_TAG)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `commit=${result.commit}\ntag=${result.tag}\n`)
  console.log(`Validated ${result.tag} at ${result.commit} on main.`)
}
