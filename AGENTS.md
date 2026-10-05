# Working on PHOENIX

- Read [CONTRIB.md](CONTRIB.md) and inspect the current Git state before changing files. Keep
  unrelated work intact; use feature branches from `dev`. Publishing, pushing and merging need
  explicit authorization.
- Keep changes with their owner. Control Deck is a separate dependency, not source to copy into
  PHOENIX. Bundled in-game Copilot profiles live in `resources/copilots/`, not in this file.
- Use [.agents/skills/codebase-audit/SKILL.md](.agents/skills/codebase-audit/SKILL.md) for systematic
  complexity, defensive-programming and maintainability audits. Ordinary edits do not require a
  whole-codebase audit.
- Run focused regression tests and `npm run check` for code changes. Report unverified behavior;
  production typechecks do not typecheck every test, and CI is not proof of real Elite input.
- If available, `.context/index.md` and `.context/codex-handoff.md` provide local working context.
  Keep `.context` ignored; never force-add it or put player data and credentials in tracked files.
