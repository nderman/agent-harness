# SUBMISSION checklist

Their brief → what maps to it → status. Nothing ships until every [ ] under a required row is ticked.

## Required deliverables

### 1. "A repository"
- [ ] Public GitHub repo, clean history, meaningful commit messages
- [ ] Fresh clone → `npm install && npm test` green with no API key (the headline trick — verify on a clean checkout)
- [ ] CI badge green on `main`
- [ ] Committed cassettes + baseline so the reviewer can run everything without secrets

### 2. "A hosted link"
- [x] Eval report + browsable traces on GitHub Pages (nderman.github.io/agent-harness), deployed by CI, linked from README top
- [x] Link opens to something self-explanatory in <10 seconds (title + one-line context on the page itself)

### 3. "Documentation of tools/process/framework used"
- [ ] README "How I used AI to build this" — Claude Code workflow, honest wins/misses
- [ ] `NOTES.md` — running per-phase dev log (raw record behind the README narrative)
- [ ] `AGENTS.md` — the operating manual itself is process documentation (call this out explicitly)
- [ ] `TODO.md` left in place with real ticks — shows the plan and the cuts, which the brief rewards ("clarity of thought")
- [ ] Tools list: Claude Code, Anthropic SDK, TypeScript/vitest/zod, Vercel, GitHub Actions

### 4. "Anything that helps them understand the work"
- [ ] `SPEC.md` / `DESIGN.md` / `GUARDRAILS.md` — the thinking, with trade-offs stated
- [ ] The deliberate-regression demonstration (red CI run link/screenshot) — the harness catching a bug is the money shot
- [ ] Optional: demo recording

## Framing checks (the meta-move, verified)

- [ ] README's first paragraph states the thesis: harness, not app — and why that's the role
- [ ] "No correct solution / clarity of thought" is answered by visible decisions + trade-offs + non-goals, not by volume
- [ ] Payments-flavoured agent signals domain empathy without claiming domain integration
- [ ] Every capability claimed in README is demonstrable by a command a reviewer can run

## Pre-submit final pass

- [ ] Clean-room check: no code, prompts, fixture shapes, or naming carried from work projects
- [ ] No secrets, no `.env`, no personal data in history (`git log -p | grep -i` spot checks)
- [ ] Repo name/description/About set on GitHub; topics tagged
- [ ] Read the whole thing once as the reviewer: README → DESIGN → a cassette → a trace → report, ~15 min, no dead ends
