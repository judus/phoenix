# Personal helper notes

The NTS workspace (between INF and CPT) stores plain-text player notes separately from journal projections, GalNet analysis,
journey summaries and Copilot memory. Use New note or Add note in mission details. Notes support
a title, text and an optional mission, system, station or body link; title and text are optional,
including completely blank notes. A responsive masonry of cards shows short notes directly;
long notes expand in place. Editing remains a separate form. Location identities reuse
the bookmark model. Notes do not require the linked entity to be currently available and remain
independently accessible after mission completion or abandonment. Players can edit, unlink and
delete notes; deletion asks for confirmation. Mission links use the current ledger title and open
that mission selected, not just the missions page. Missing missions are explicitly reported rather
than selecting an unrelated entry. System/station/body links reuse the normal location component
and open the corresponding schematic selection. Derived mission titles are not persisted in notes.

The folded-sheet note icon in system schematic tools links a new note to the displayed system.
Body/station detail actions link the selected entity. Atlas selected locations use the known
body, Community Goal station, or bookmark target; other POIs and GalNet leads link their system.
Site labels are not invented body/station identities. These actions only open an editor: nothing
is written until Save note is pressed.

The server stamps creation and last-edit authorship and timestamps. HTTP writes are attributed
to the player; Copilot writes are attributed to Copilot. Editing does not erase original authorship.
Notes live in their own table in the normal private SQLite database, without foreign-key deletion
cascades or journal replay. They are not uploaded to third-party game-data providers.

## Copilot access

The normal permission catalogue includes Personal notes: search, read, create and update. Existing
saved permission policies are not silently expanded. Enable the desired tools for the installation
and profile. Create/update tools instruct the Copilot to write only when explicitly asked, never
as a background observer. This is a model instruction, not a technical proof of player consent;
disable write permissions if no Copilot writes should be possible.

Mission retrieval includes notes for returned missions only, and only while the active profile
can search or read personal notes. Null means note access is disabled, not that no notes exist.
The whole note collection is not injected into every conversation. The Copilot can also open
the notes page with display.open_page. All note text is untrusted user context, not authoritative
gameplay state or instructions to execute tools.

General notes can be searched independently. Structured target filters are exact entity matches,
not recursive searches for every station/body in a system. Unknown/deleted linked entities do not
prevent reading or editing the note. This version has no automatic note-taking, rich text, tags,
story summarisation or per-commander cloud synchronisation.
