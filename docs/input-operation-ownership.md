# Game-input operation ownership

PHOENIX coordinates its own input. It cannot prevent physical keyboard/controller input
from the player or another program. Control Deck remains responsible for bindings, key
execution, lease ownership, renewal, expiry and release.

## Producer inventory

| Producer | Input path | Operation lifetime |
| --- | --- | --- |
| Direct HTTP game action | GameActionService → runtime → Elite gateway/Control Deck | In-flight action; accepted press retains its existing origin/lease hold |
| Command HTTP / numpad | DefaultCommandDispatcher → GameActionService or MacroService | Same action/hold or complete macro |
| Control Deck host buttons | PhoenixControlDeckCommandAdapter → dispatcher → GameActionService/MacroService | Host retains its existing lease; same shared action/hold boundary |
| Copilot / MCP / realtime tools | permission adapters → dispatcher or stateful actions → GameActionService; destination tool → route service | Same input ownership; permissions and result contracts remain independent |
| Stateful switch | StatefulGameActionService → GameActionService | Physical tap; independent telemetry reads remain available |
| Macro playback | MacroService → GameActionService | Entire sequence, waits and final held-action cleanup |
| Macro recording | MacroService.recordAction → GameActionService | Each recorded action; accepted holds retain their original lease |
| Route plotting | EliteDestinationService → ControlDeckEliteDestinationInput → KeyboardOutput | Entire map operation, including final map-close cleanup |
| Hold renewal / expiry / release | Existing CommandExecutionRuntime and macro renewal callbacks | Existing leases; release remains allowed during busy/stopping state |
| Shutdown | application operation stop → existing action/Control Deck stop | Cancel and drain semantic operations before releasing holds/stopping the backend |

Production output has two entry points: EliteDangerousCommandAdapter, constructed only
behind the Elite game-action gateway, and ControlDeckEliteDestinationInput. Both receive
the same application operation coordinator through their owning services. No separate
host keyboard backend or numpad output bypass exists in this assembly.

## Admission and cleanup contract

Route plotting and macro playback acquire one exclusive semantic owner before any input.
Acquisition rejects an existing operation, in-flight action or accepted hold. Unrelated
new actions are rejected before dispatch while an exclusive operation owns input. Nothing
is queued for later replay. Nested steps inherit their operation owner through the server's
async context, so a macro cannot reject its own steps.
An expired or cancelled inherited context cannot start another operation or dispatch new
input. A genuinely fresh request can acquire after the previous operation finishes.

Normal actions retain their existing concurrency and Control Deck lease/idempotency rules.
Their admission is captured when submitted, before the runtime's lease-transition queue;
a busy request cannot become valid merely because the exclusive operation ends later.
The runtime remains authoritative for cached idempotent results and lease authorization.
Only actual accepted dispatches add/remove hold reservations; renewals and cached results
do not invent additional holds. Failed releases retain their reservation.

Authorized releases bypass busy/stopping admission, including expiry and shutdown release.
Operation ownership remains live through awaited failure/cancellation cleanup. Final map
close failure is included in the route result instead of swallowed. Stopping rejects new
input, aborts semantic operations and waits for their cleanup before backend shutdown.
Rejection and unknown outcomes never trigger automatic resubmission.

Busy route/action requests use their existing rejected result. A macro that cannot acquire
input uses its existing failed playback result with zero completed steps and an explicit
busy diagnostic; no public result format or permission is widened.

Validation uses synthetic bindings/state and Control Deck RecordingKeyboardOutput, covering
both start orders, existing holds, nested steps, recording, host/numpad/tool entry paths,
cancellation, cleanup, expiry and shutdown. It is not real Elite or OS-input acceptance.
