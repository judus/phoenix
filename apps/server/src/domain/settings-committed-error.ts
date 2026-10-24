/** Persistence succeeded; a later step failed. Never imply that retry would undo the save. */
export class SettingsCommittedError extends Error {
  public constructor (public readonly stage: 'publication' | 'response', cause: unknown) {
    const detail = cause instanceof Error ? cause.message : 'Unknown error.'
    super(`Settings were saved, but ${stage === 'publication' ? 'notifying connected screens' : 'building the response'} failed. Reload the page to read the saved settings. ${detail}`, { cause })
  }
}
