# Mission briefs

Activities and Copilot consume the same server-owned mission read model. Journal acceptance,
redirects, startup manifests and terminal events remain owned by MissionDataService.

The stored MissionRecord retains invariant Commodity and TargetType identifiers separately
from display labels. Expected credits come from acceptance; received credits and materials
come only from an observed MissionCompleted event. Missing reward fields remain unknown.
A startup manifest's Complete entry is not evidence that rewards have been claimed.

The response adds a briefing derived from the invariant mission Name and current inventory.
On-foot activity/conditions use a narrow token mapping in the Elite package, based on
[EDDI's mission catalogue](https://github.com/EDCD/EDDI/blob/d3b964ea7c8bb959ad6537f55b308f293a326905/DataDefinitions/MissionType.cs).
Covert, NCD and explicit Legal/Illegal tokens indicate known contract conditions; absence
does not establish legality. A legal contract does not make all player actions legal.
Unknown tokens are retained in the original Name and do not create guessed restrictions.

Backpack and ship-locker snapshots retain MissionID. The brief lists only positive tagged
entries belonging to that mission, with each store's observation timestamp. They are
last-observed items, not live location telemetry, objective completion or a deliverable total.
Missing snapshots are not empty inventories. Untagged items and other missions' items are
not attributed. Inventory changes refresh the Activities brief without storing a duplicate
inventory in the mission repository.

Required kills are contract requirements, not a kill counter. Delivery progress is shown
only where CargoDepot supplies it; a missing delivered count is unknown, not zero.
Acceptance provenance “complete” means acceptance was observed, not that the entire mission
script or all optional details are known.

## Retained data

Database migration 30 adds nullable identifiers/reward fields to existing records and
invalidates journal backfill checkpoints once, allowing the normal idempotent projections
to recover original values from available journal files. No parallel legacy decoder is used.
Missing source history leaves new fields unknown rather than inferring them from translated
labels or the old reward value, whose expected/received provenance was ambiguous.

## Validation limits

Automated coverage exercises classification, persistence, mission-linked snapshots, Copilot
and UI presentation. Real gameplay still needs comparison for delivery/contact collection,
covert/nonviolent data/retrieval, restoration/sabotage and combat contracts, item movement,
reward selection and ready-to-claim behavior. This slice adds no HUD, security/terminal map,
upload timer, inferred objective tree or CAPI dependency.
