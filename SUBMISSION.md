# SUBMISSION checklist

Their brief → what maps to it → status. Nothing ships until every [ ] under a required row is ticked.

## Required deliverables

### 1. "A repository"
- [x] Public GitHub repo, clean history, meaningful commit messages
- [x] Fresh clone → `npm install && npm test` green with no API key (verified on a clean checkout: 100 tests + `eval` green, no key)
- [x] CI badge green on `main` (badge in README; `ci` runs typecheck + test + the `eval` baseline gate, all offline)
- [x] Committed cassettes + baseline so the reviewer can run everything without secrets

### 2. "A hosted link"
- [x] Eval report + browsable traces on GitHub Pages (nderman.github.io/agent-harness), deployed by CI, linked from README top
- [x] Link opens to something self-explanatory in <10 seconds (title + one-line context on the page itself)

### 3. "Documentation of tools/process/framework used"
- [x] README "How I used AI to build this" — Claude Code workflow, honest wins/misses, where judgment was load-bearing
- [x] `NOTES.md` — running per-phase dev log + "where the human stayed in the loop" decisions record
- [x] `AGENTS.md` — the operating manual itself is process documentation (called out in README)
- [x] `TODO.md` left in place with real ticks — shows the plan and the cuts ("clarity of thought")
- [x] Tools list in README: Claude Code, Anthropic SDK (Haiku + Opus), TypeScript/vitest/zod/tsx, GitHub Actions + Pages

### 4. "Anything that helps them understand the work"
- [x] `SPEC.md` / `DESIGN.md` / `GUARDRAILS.md` — the thinking, with trade-offs + a designed-vs-built reconciliation
- [x] The deliberate-regression demonstration (red CI run linked in README) — the harness catching a bug is the money shot
- [ ] Optional: demo recording (stretch — cut; the hosted report + red-CI run cover the "see it work" need)

## Framing checks (the meta-move, verified)

- [x] README's first paragraph states the thesis: harness, not app — and why that's the role
- [x] "No correct solution / clarity of thought" is answered by visible decisions + trade-offs + non-goals, not by volume
- [x] Payments-flavoured agent signals domain empathy without claiming domain integration
- [x] Every capability claimed in README is demonstrable by a command a reviewer can run (`npm test`, `npm run eval`, `npm run demo`, `npm run canary`)

## Pre-submit final pass

- [x] Clean-room check: no code, prompts, fixture shapes, or naming carried from work projects (`git grep` clean)
- [x] No secrets, no `.env`, no personal data in history (`.env` in zero commits; no real keys in history)
- [x] Repo name/description/About + topics set on GitHub
- [x] Read the whole thing once as the reviewer: README → DESIGN → cassette → trace → report — caught + fixed two stale "LLM judge" references and a misplaced-module row
