# ISSUES

Issues and the PRD for this repo live as local markdown files under
`.scratch/manga-shop/`:

- PRD: `.scratch/manga-shop/PRD.md`
- Issues: `.scratch/manga-shop/issues/<NN>-<slug>.md`, numbered from `01`

Read the PRD first, then read every issue file. Each issue has a `Status:` line
near the top recording its triage state (see `docs/agents/triage-labels.md`):

- `ready-for-agent` — fully specified, an AFK agent may implement it. **You work on these.**
- `ready-for-human` — needs a human. **Do not touch these.**
- `needs-triage` / `needs-info` — not ready. Skip.
- `done` — already finished. Skip.

You've also been passed a file containing the last few commits. Review these to
understand what work has been done.

If every `ready-for-agent` issue is `done` (or the only ones left are blocked by
unfinished issues), output <promise>NO MORE TASKS</promise>.

# TASK SELECTION

Pick the next task from the `ready-for-agent` issues that are not yet `done`.

Respect each issue's `Blocked by` section: do not start an issue while any issue
it is blocked by is still unfinished. Among the unblocked candidates, prioritize
in this order:

1. Critical bugfixes
2. Development infrastructure

Getting development infrastructure like tests, types, and dev scripts ready is an
important precursor to building features.

3. Tracer bullets for new features

Tracer bullets are small slices of functionality that go through all layers of
the system, allowing you to test and validate your approach early. This helps in
identifying potential issues and ensures that the overall architecture is sound
before investing significant time in development.

TL;DR — build a tiny, end-to-end slice of the feature first, then expand it out.

4. Polish and quick wins
5. Refactors

The issues are roughly ordered so that earlier numbers unblock later ones; when
priorities tie, prefer the lowest-numbered unblocked issue.

# EXPLORATION

Explore the repo. Before writing code, read the domain docs that cover the area
you're about to work in (per `docs/agents/domain.md`):

- `CONTEXT.md` at the repo root — the glossary / ubiquitous language.
- The ADRs under `docs/adr/` that the issue references (each issue lists the ADRs
  it respects).

Use the glossary's vocabulary in code, tests, and commit messages. If your work
would contradict an ADR, surface it in the issue comments rather than silently
overriding it.

# BRANCH

Before writing any code, create a fresh working branch off `develop` for this
task — never commit the work directly on `develop` or `master`:

```
git checkout develop
git pull --ff-only        # if a remote is configured; ignore if it fails offline
git checkout -b <type>/<NN>-<slug>
```

Name it after the issue: `<type>` is `feat` for features, `fix` for bugfixes,
`chore` for infrastructure/refactors; `<NN>-<slug>` matches the issue file
(e.g. `feat/03-catalog-browse-search`). Do all of this task's work on this
branch.

# IMPLEMENTATION

Use /tdd to complete the task.

This is a pnpm + turborepo monorepo (`apps/*`, `packages/*`). Add code in the
right workspace and wire it through the workspace, not as a standalone project.

# FEEDBACK LOOPS

Before committing, run the feedback loops from the repo root:

- `pnpm typecheck` — type checker
- `pnpm lint` — linter
- `pnpm test` — tests (if no root `test` task is wired yet, wire one as
  `"test": "turbo test"` in the root `package.json`, or run the affected app's
  own test command)

Everything must pass before you commit.

# COMMIT & MERGE

Commit your work on the task branch. The commit message must:

1. Include key decisions made
2. Include files changed
3. Include blockers or notes for next iteration

Then integrate the branch into `develop` only — **never merge a task branch
straight into `master`**:

```
git checkout develop
git merge --no-ff <type>/<NN>-<slug>
```

`master` is a separate promotion step that only ever happens by merging
`develop` into it, and only after the work is already on `develop`. Do not touch
`master` from this loop; promoting `develop` → `master` is a deliberate action
left to the human. The invariant: every change reaches `master` through
`develop` first, never directly from a task branch.

# THE ISSUE

Update the issue file you worked on:

- If the task is complete: set its `Status:` line to `done` and append a note
  under a `## Comments` heading (create it if absent) summarizing what was built
  and any follow-ups.
- If the task is not complete: leave `Status:` as `ready-for-agent` and append a
  `## Comments` note describing what was done and what remains.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
