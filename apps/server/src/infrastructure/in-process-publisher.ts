import type { Publisher, Subscribable, Unsubscribe } from '../domain/publisher.js'

export class InProcessPublisher<T> implements Publisher<T>, Subscribable<T> {
  private readonly listeners = new Set<(message: T) => void>()

  public publish (message: T): void {
    for (const listener of this.listeners) listener(message)
  }

  public subscribe (listener: (message: T) => void): Unsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
