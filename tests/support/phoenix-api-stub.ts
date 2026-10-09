import type { PhoenixApi } from '../../apps/web/src/application/api/phoenix-api.js'

/** Validate provided methods; fail immediately if a test reaches an unstubbed API method. */
export function phoenixApiStub(methods: Partial<PhoenixApi>): PhoenixApi {
  return new Proxy(methods, {
    get(target, property) {
      if (!Object.hasOwn(target, property)) throw new Error(`Unstubbed PhoenixApi method: ${String(property)}`)
      return Reflect.get(target, property)
    }
  }) as PhoenixApi
}
