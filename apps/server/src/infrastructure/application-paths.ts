import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

export interface ApplicationPathEnvironment {
  PHOENIX_AGENTS_PATH?: string
  PHOENIX_CACHE_PATH?: string
  PHOENIX_CONFIG_PATH?: string
  PHOENIX_DATA_PATH?: string
  PHOENIX_LOGS_PATH?: string
  PHOENIX_WEB_ROOT?: string
  XDG_CACHE_HOME?: string
  XDG_CONFIG_HOME?: string
  XDG_DATA_HOME?: string
  XDG_STATE_HOME?: string
  LOCALAPPDATA?: string
}

export interface ApplicationPathsOptions {
  environment?: ApplicationPathEnvironment
  homeDirectory?: string
  installRoot: string
  platform?: NodeJS.Platform
  userRoot?: string
}

/** Authoritative boundary between immutable installation resources and writable user state. */
export class ApplicationPaths {
  public readonly installRoot: string
  public readonly resources: Readonly<{
    agents: string
    web: string
  }>
  public readonly user: Readonly<{
    cache: string
    config: string
    data: string
    logs: string
  }>

  public constructor (options: ApplicationPathsOptions) {
    const environment = options.environment ?? process.env
    const platform = options.platform ?? process.platform
    const homeDirectory = options.homeDirectory ?? homedir()
    this.installRoot = resolve(options.installRoot)

    const defaults = options.userRoot
      ? repositoryLocalRoots(resolve(options.userRoot))
      : platformRoots(platform, homeDirectory, environment)

    this.resources = Object.freeze({
      agents: resolvePath(this.installRoot, environment.PHOENIX_AGENTS_PATH ?? 'agents'),
      web: resolvePath(this.installRoot, environment.PHOENIX_WEB_ROOT ?? 'apps/web/dist')
    })
    this.user = Object.freeze({
      cache: resolvePath(this.installRoot, environment.PHOENIX_CACHE_PATH ?? defaults.cache),
      config: resolvePath(this.installRoot, environment.PHOENIX_CONFIG_PATH ?? defaults.config),
      data: resolvePath(this.installRoot, environment.PHOENIX_DATA_PATH ?? defaults.data),
      logs: resolvePath(this.installRoot, environment.PHOENIX_LOGS_PATH ?? defaults.logs)
    })
  }

  public static development (installRoot: string, environment: ApplicationPathEnvironment = process.env): ApplicationPaths {
    return new ApplicationPaths({ environment, installRoot, userRoot: resolve(installRoot, 'data') })
  }
}

function repositoryLocalRoots (root: string) {
  return {
    cache: resolve(root, 'cache'),
    config: root,
    data: root,
    logs: resolve(root, 'runtime', 'logs')
  }
}

function platformRoots (
  platform: NodeJS.Platform,
  homeDirectory: string,
  environment: ApplicationPathEnvironment
) {
  if (platform === 'win32') {
    const local = environment.LOCALAPPDATA ?? resolve(homeDirectory, 'AppData', 'Local')
    const root = resolve(local, 'PHOENIX')
    return { cache: resolve(root, 'Cache'), config: resolve(root, 'Config'), data: resolve(root, 'Data'), logs: resolve(root, 'Logs') }
  }

  return {
    cache: resolve(environment.XDG_CACHE_HOME ?? resolve(homeDirectory, '.cache'), 'phoenix'),
    config: resolve(environment.XDG_CONFIG_HOME ?? resolve(homeDirectory, '.config'), 'phoenix'),
    data: resolve(environment.XDG_DATA_HOME ?? resolve(homeDirectory, '.local', 'share'), 'phoenix'),
    logs: resolve(environment.XDG_STATE_HOME ?? resolve(homeDirectory, '.local', 'state'), 'phoenix', 'logs')
  }
}

function resolvePath (installRoot: string, path: string): string {
  return isAbsolute(path) ? path : resolve(installRoot, path)
}
