# AGENTS.md — operating manual for AI coding agents in this repo

You are working in a take-home for an *Agentic Harness Engineer* role. This file is both your instructions and part of the submission: it demonstrates how the author runs agents. Follow it exactly; where it's silent, prefer the smallest change that keeps everything below true.

## What this repo is

A test/eval harness for AI agents, demonstrated on a small payments-support agent. Read `SPEC.md` (scope), `DESIGN.md` (architecture + decisions), `GUARDRAILS.md` (safety model) before writing code. `TODO.md` is the plan of record — work the current phase, don't jump ahead.

## Ground rules

1. **Test-first, always.** New behaviour lands as a failing test, then the implementation, in the same change. No logic-bearing code without a test. `npm test` must be green at every commit.
2. **Offline by default.** Tests must pass with no `ANTHROPIC_API_KEY` and no network. Anything touching the model goes through `ModelClient`; tests use `ReplayClient` (cassettes) or hand-built fakes. If you find yourself mocking the Anthropic SDK directly, you're on the wrong side of the seam — stop.
3. **Determinism is load-bearing.** No `Date.now()`, `Math.random()`, or generated UUIDs in anything that feeds a model request or a fingerprint. Clock and ID generation are injected (`src/harness/determinism.ts`). Violating this silently breaks cassette matching — treat it like a type error.
4. **Cassettes and baselines are reviewed fixtures.** Never hand-edit a cassette; re-record with `npm run record` and include the diff in the commit. Never update `evals/baseline.json` to make a red run green without a one-line justification in the commit message saying what changed and why it's an improvement.
5. **Small and sharp.** No new dependencies without strong cause (current set: `@anthropic-ai/sdk`, `zod`, `vitest`, `tsx`, TypeScript). No abstractions for hypothetical futures — extension points are documented in DESIGN.md, not pre-built. If a change grows past ~300 lines, stop and split it.
6. **Scope discipline.** SPEC.md's non-goals are binding. If a task seems to require breaking one, stop and ask rather than quietly expanding scope.

## Commands

| Command | What | When |
|---|---|---|
| `npm test` | Unit + eval suite, replay mode, offline | Before and after every change |
| `npm run typecheck` | `tsc --noEmit` | With every test run |
| `npm run demo` | One live scenario end-to-end (needs API key) | Manual smoke only — never in CI |
| `npm run record` | Re-record cassettes (needs API key) | Only after intentional prompt/tool/schema changes |
| `npm run eval` | Eval suite + report + baseline diff | Before declaring a phase done |

## Conventions

- TypeScript strict mode; no `any` (use `unknown` + narrowing). ESM.
- Use SDK types (`Anthropic.MessageParam`, `Anthropic.Tool`, …) — never redefine equivalents.
- Errors that cross a boundary (guardrail denials, replay misses) are structured objects with a discriminant, not thrown strings. A replay miss must print what changed, not just "not found".
- Trace events are the source of truth for observability — if something matters, it's an event, and the report derives from it.
- Filenames kebab-case; one module concern per directory (see DESIGN.md repo map).
- Comments only for constraints code can't express. No narration, no changelog comments.
- **Diagrams are mermaid, always.** Any diagram in docs (or generated reports) is a fenced ```` ```mermaid ```` block — never ASCII art. GitHub renders mermaid natively; ASCII diagrams drift, don't diff cleanly, and can't be styled. Keep them small enough to read in the file itself.

## Definition of done (per change)

- [ ] Tests written and green (`npm test`), typecheck clean
- [ ] Offline invariant holds (run tests with `ANTHROPIC_API_KEY` unset if the change touches the model path)
- [ ] Cassette/baseline diffs, if any, are intentional and explained in the commit
- [ ] Docs updated if behaviour or a decision changed (DESIGN.md decisions are living)
- [ ] Commit message says *why*, not just what

## Definition of done (per phase — see TODO.md)

The phase's checklist items ticked, its success criterion demonstrated (paste command output in the PR/commit description), and nothing from a later phase smuggled in.
