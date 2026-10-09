# Personal control decks

Open **CTR → MNG** to manage decks. The supplied decks are editable starting defaults.

- **New deck** creates a blank 4×3 grid. Give it a name, then **Save changes**.
- Use the up/down buttons to change deck order. The left rail and Numpy use the saved order.
- **Delete** asks for confirmation and removes that deck's button assignments when saved.
  It does not delete the macros or saved queries those buttons referenced. Keep at least one deck.
- **Cancel** discards unsaved management edits.
- **Open** takes you to a saved deck for normal use. **Edit** opens its buttons, theme and layout
  editor. Save and finish editing, or **Cancel** to discard the layout draft.

Deck identity is independent of its name and position. Renaming or reordering does not recreate
buttons or change their commands. CTR recalls the last visited deck; otherwise it opens the first
saved deck. If a recalled deck was deleted, it opens the first remaining deck.

Every deck can use the Phoenix Ship layout preset or a custom grid. Shrinking a grid or applying
a preset that would discard configured buttons is refused: move/remove those buttons first.
Empty spacer cells may be removed when resizing.

Management saves use the existing revision-checked configuration endpoint. If another device has
saved changes in the meantime, PHOENIX rejects the stale save rather than overwriting it. Cancel
your draft to pick up the current configuration before editing again.
