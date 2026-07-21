# TODO — 3-day plan

Legend: **[M]** must-have · **[S]** stretch (cut cleanly if time pressure hits).
Cut order if behind: HTML report → semantic-judge polish → regression thresholds (keep simple pass/fail diff) → extra eval scenarios (keep the core five).

## Phase 0 — Scaffold (Day 1, morning) ✦ gate: `npm test` green in CI
- [x] [M] `npm init`, TypeScript strict + ESM, vitest, tsx; deps: `@anthropic-ai/sdk`, `zod`
- [x] [M] `npm test` / `typecheck` / placeholder scripts wired; one trivial passing test
- [x] [M] GitHub repo (public), Actions workflow: typecheck + test on push — green from the first push
- [x] [M] `src/harness/determinism.ts` (injected clock + ID gen) — exists before anything can cheat

## Phase 1 — Agent + tools (Day 1) ✦ gate: `npm run demo` completes a live happy-path refund
- [x] [M] Fixture payments DB + the three tools (`lookup_payment`, `issue_refund`, `escalate`) with zod schemas — unit-tested directly
- [x] [M] `ModelClient` interface + `LiveClient` wrapper: `defaults.ts` (models, max_tokens, timeout, retry/re-prompt bounds), `ModelClientError` union per DESIGN.md Decision 8, per-call trace emission
- [x] [M] Error-taxonomy tests: transport-retry vs re-prompt vs fail-fast paths, each against a fake client
- [x] [M] Agent loop: system prompt, tool dispatch, terminal `resolve` tool → validated `Resolution`; retry bound
- [x] [M] Loop unit tests against a hand-built fake `ModelClient` (scripted responses — proves the seam before cassettes exist)

## Phase 2 — Record/replay (Day 2, morning) ✦ gate: full suite green with API key unset
- [x] [M] Fingerprint function (canonical JSON, sorted keys) — property-style unit tests (stability, sensitivity to each component)
- [x] [M] Cassette format + `RecordingClient` / `ReplayClient`; loud, diff-friendly miss errors
- [x] [M] `npm run record` CLI; record the happy-path scenario; commit cassettes
- [x] [M] Agent tests migrated to replay mode; CI proves offline (no secret configured in Actions)
- [ ] [S] Record-mode "append vs overwrite" ergonomics

## Phase 3 — Guardrails + eval suite (Day 2) ✦ gate: over-limit scenario blocked AND recovered-by-escalation, asserted in a test
- [x] [M] Policy layer per GUARDRAILS.md (ceiling, over-refund, double refund, state) — unit-tested exhaustively, cheap
- [x] [M] Guardrail wiring in loop: deny → structured tool error → trace event
- [x] [M] Scenario format + eval runner; trajectory assertions (sequence, argument predicates, guardrail outcomes)
- [x] [M] Five core scenarios recorded: happy refund · lookup-only · over-limit block · ambiguous→escalate · prompt-injection
- [x] [M] ~~LLM judge~~ → **deterministic faithfulness checks** in the eval runner (message consistent with action/trace). Judge dropped — DESIGN Decision 5.
- [x] [M] Live drift canary (`npm run canary [model]`) — re-runs scenarios against the live model, diffs trajectory + faithfulness vs baseline. Caught a real Haiku divergence; Opus 4.8 held all five.
- [ ] [S] Additional scenarios (double-refund attempt, wrong-customer lookup)

## Phase 4 — Trace, report, regression, hosted link (Day 3, morning) ✦ gate: red CI from a deliberately broken prompt; live report URL
- [x] [M] Typed trace events + JSONL writer threaded through loop/guardrails/client; cost table for haiku/opus
- [x] [M] Markdown report: per-run summary + safety metric (blocked vs slipped) + per-scenario trajectory/action/cost
- [x] [M] `evals/baseline.json` + diff in eval runner; regression → nonzero exit; wired into CI (`npm run eval`)
- [x] [M] Demonstrate detection: broke the prompt on `demo/prompt-regression` → red CI (run 29863916603), linked in README
- [x] [M] Hosted link: GitHub Pages (nderman.github.io/agent-harness) serving the eval report + browsable JSONL traces, deployed by CI
- [x] [S] HTML report styling (theme-aware stat tiles + table) / trace links

## Phase 5 — Docs + polish (Day 3) ✦ gate: SUBMISSION.md fully ticked
- [x] [M] README "how I used AI" section written honestly (process, what the agent got wrong, where judgment was load-bearing)
- [x] [M] Reconcile DESIGN.md decisions against what was actually built; note divergences (module table + "built vs designed" section)
- [x] [M] Fresh-clone test: clean machine → `npm install && npm test` green (100 tests + eval, no key); README quickstart accurate
- [x] [M] Final pass on SUBMISSION.md checklist (all required items ticked)
- [ ] [S] Short demo GIF/recording of `npm run demo` + report — cut (hosted report + red-CI run cover it)
