---
name: shipit
description: Review changes, check test coverage, simplify, update docs/memory, commit, push
allowed-tools: Bash(npx *), Bash(npm *), Bash(pnpm *), Bash(bun *), Bash(git *), Bash(gh *), Read, Glob, Grep, Edit, Write, Agent
---

# Ship It

Full pre-commit workflow: review, test coverage, simplify, document, commit, push.

## Step 1: Review changes

Run `git status --short` first — `git diff` alone shows nothing for untracked files, so status is the source of truth for whether there is work to ship.

- **Tracked changes:** `git diff` (or `git diff HEAD` if staged changes exist).
- **Untracked files:** run `git add -N .` so they appear in `git diff`, or read them directly. Never conclude "nothing to commit" while `git status` lists untracked files.
- **Truly clean tree** (status empty): review the **last commit** instead — `git diff HEAD~1` — and use that diff for steps 3-4. Skip step 6 since it's already pushed. (If the repo has fewer than 2 commits, diff against the empty tree: `git diff $(git hash-object -t tree /dev/null) HEAD`.)

Understand what changed and why before proceeding.

## Step 2: Build and test

1. Run the project's build command (e.g., `npx tsc --noEmit`, `npm run build`) — abort if errors.
2. Run the project's test command (e.g., `npm run test:unit`, `npm test`) — abort if failures. Report pass count.
3. Use the project's actual package manager (npm/pnpm/bun) — check the lockfile.

**No build/test infrastructure yet** (no package.json, or scripts not wired): that is absence, not failure — note it in the summary and continue. Do not abort.

**Re-run rule:** any fix made in steps 3 or 4 invalidates this step — re-run build and tests after fixes, before committing. What gets committed must be the exact state that passed.

## Step 3: Test coverage check

Review the diff from Step 1 and identify new or changed functions, classes, and logic branches. For each:
- Check if corresponding tests exist (search test files for references to the new code).
- If new code lacks test coverage, write tests for it before continuing.
- Focus on non-trivial logic: calculations, conditionals, error handling, parsing. Skip simple getters/setters/config.

## Step 4: Simplify (/simplify)

**Scale the review to the diff.** If the diff is small (< ~50 changed lines) or contains no code (docs/config only), do a single inline review pass yourself — check consistency, duplication, and clarity — instead of spawning agents.

For substantial code diffs, launch three review agents in parallel:

1. **Code Reuse**: Search for existing utilities that could replace new code. Flag duplicated functionality.
2. **Code Quality**: Check for redundant state, copy-paste, leaky abstractions, stringly-typed code.
3. **Efficiency**: Check for unnecessary work, missed concurrency, unbounded data structures, missing cleanup.

Fix any real issues found. Skip false positives. Then apply the Step 2 re-run rule.

## Step 5: Update docs and memory

- Update project docs (AGENTS.md, README.md, etc.) if: test count changed, new files added, architecture changed, new features.
- Update MEMORY.md if: new lessons learned, bug patterns, parameter changes, key decisions.
- Keep both concise — MEMORY.md especially must stay under 200 lines.

## Step 6: Commit and push

1. `git status` and `git diff --stat` to confirm what's being committed.
2. **Secrets gate:** scan the staged diff before committing — `git diff --cached | grep -nE '(sk-[A-Za-z0-9]|ghp_|gho_|whsec_|AKIA[0-9A-Z]|-----BEGIN|api[_-]?key[^s]|ANTHROPIC_API_KEY=)'` — and verify no `.env` or credential files are staged. Any hit: stop and resolve before continuing. This matters most when the remote is public.
3. `git log --oneline -3` to match commit message style.
4. Stage specific files (not `git add -A`).
5. Commit with a clear message describing the "why".
6. `git push`. **No remote configured:** stop and ask whether to create one (and public vs private) — don't invent a remote silently.

If any step fails, stop and fix the issue before continuing.
