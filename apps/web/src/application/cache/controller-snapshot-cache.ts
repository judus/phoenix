import { BoundedCache } from './bounded-cache.js'

const snapshots = new WeakMap<object, BoundedCache<unknown>>()

export function readControllerSnapshot<T>(owner: object, key: string): T | undefined {
  return snapshots.get(owner)?.get(key) as T | undefined
}

export function storeControllerSnapshot<T>(owner: object, key: string, snapshot: T): T {
  const ownerSnapshots = snapshots.get(owner) ?? new BoundedCache<unknown>()
  ownerSnapshots.set(key, snapshot)
  snapshots.set(owner, ownerSnapshots)
  return snapshot
}
