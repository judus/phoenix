# Copilot settings commit

The provider, model, installation permissions and constrained profile permissions
belong to one settings document. `CopilotSettingsService` loads one starting
snapshot, asks the capability owner to prepare the permission ceiling, validates
the complete next settings and saves it once. Unrelated settings and profile
identities are retained. Provider selection remains restart-bound; saved selection
and effective runtime selection are not conflated. Provider secrets stay separate.

The JSON repository replaces the complete document with a temporary file and
rename. A failure before replacement retains the previous document. This does not
mean every thrown repository error proves that nothing committed: the existing
writer also adjusts file permissions after replacement.

When persistence returns successfully but change publication fails, the notifying
settings repository raises `SettingsCommittedError` with stage `publication`.
Failure to build the response after a successful save uses stage `response`.
HTTP reports 500 with `error.code=settings_committed`, `committed=true`,
`retryable=false`, the stage and explicit saved/reload guidance. The current browser
client displays that message and does not automatically retry the PUT. The document
is not rolled back, permission reductions are not undone, and notification errors
are not swallowed. Reload observes the committed settings; a deliberate repeated
update is a new idempotent document save.

## Evidence

Before the correction, injected second-save and post-save publication failures
returned a generic internal error while the reopened JSON contained new permissions
and old provider/model. The maintained HTTP regressions exercise one complete save,
a real repository rename failure, notification and response failures, explicit
reload/retry, profile ceilings, unrelated settings and browser error presentation.
Fixtures use temporary JSON files and synthetic settings. No production data,
provider request, game input or deployment is involved.
