// React's DOM-free renderer still runs client effects. Sonner schedules dismissal on a frame.
export {}
const frames = new Map<number, ReturnType<typeof setTimeout>>()
let nextFrame = 0
globalThis.requestAnimationFrame = callback => {
  const id = ++nextFrame
  frames.set(id, setTimeout(() => { frames.delete(id); callback(performance.now()) }, 0))
  return id
}
globalThis.cancelAnimationFrame = id => {
  clearTimeout(frames.get(id))
  frames.delete(id)
}
