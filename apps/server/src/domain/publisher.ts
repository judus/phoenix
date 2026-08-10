export type Unsubscribe = () => void

export interface Publisher<T> {
  publish(message: T): void
}

export interface Subscribable<T> {
  subscribe(listener: (message: T) => void): Unsubscribe
}
