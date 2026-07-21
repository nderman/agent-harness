# Development log

An honest, running record of building this repo *with* an AI coding agent (Claude Code). The curated version is the README's "How I used AI to build this" section; this is the raw chronology it draws from. Newest phase last.

## Planning — before any code
- Wrote `SPEC` / `DESIGN` / `GUARDRAILS` / `AGENTS` / `TODO` / `SUBMISSION` first and got sign-off before writing feature code, so the design (8 decisions, trade-offs stated) was reviewable on its own.
- `AGENTS.md` is the operating manual the coding agent follows every phase — test-first, offline-by-default, determinism injected, scope discipline. It is both a control on the agent and a work sample for the role.
- Clean-room: patterns rebuilt from scratch; no code or IP from prior work, and the docs never reference it.

## The shipit skill improved itself
- `.claude/skills/shipit/` is my daily review → test → simplify → commit pipeline, committed in-repo as both working tooling and a process sample.
- Its first real run here surfaced its *own* gaps — an untracked-file blind spot in step 1, no "re-run tests after a fix" rule, no secrets scan, no scaling of review effort to diff size. Patched the skill and shipped the fix in the same commit. Harness engineering in miniature.

## Phase 0 — scaffold
- Gate set to "green in **CI**", not "green locally": the offline invariant only means something if a machine with no `ANTHROPIC_API_KEY` proves it. The CI workflow configures no key on purpose.
- Built the determinism seam (injected `Clock` + `IdGenerator`) *before* any model code, so nothing could reach for `Date.now()` / `Math.random()` / a UUID and silently break cassette fingerprinting later.

## Phase 1 — agent, seam, loop
- Built test-first against a hand-written `FakeModelClient`, so the agentic loop was fully exercised offline before the live model or any cassette existed. The live demo (real Haiku) then passed first try: `lookup → refund → resolve` with a faithful `Resolution`.
- **The review agents caught a real bug the green tests missed.** shipit's parallel review flagged that a single re-prompt counter drove *two* different terminal failure reasons — so a run could report *why* it failed incorrectly (two bad tool calls then one empty turn → falsely "no_resolution"). Split into independent budgets and added a regression test that fails on the old design, all in the same commit. Automated adversarial review catching what unit tests didn't — on the harness's own construction — is the whole thesis in miniature.
- Two more review fixes: one shared zod-error formatter (a re-prompt had been dropping the field path), and the `model_error` trace event now carries the message (an event-sourced observability layer whose one failure event had omitted the reason).
- Model economics, noted for the writeup: the agent runs on Haiku (cheap; record/replay makes live calls rare), and the recorded LLM judge (Phase 3) will be Opus — recording once and replaying forever changes the economics of using a strong judge.
