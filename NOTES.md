# Development log

An honest, running record of building this repo *with* an AI coding agent (Claude Code). The curated version is the README's "How I used AI to build this" section; this is the raw chronology it draws from. Newest phase last.

## Where the human stayed in the loop
The agent did the building; these were mine to decide, and a couple were course-corrections it would not have made on its own:
- **The core bet** — build a *harness*, not an app. The brief said "build something using AI"; I read the role and inverted it. That framing is the submission.
- **Caught an architectural gap** — the first design under-specified failure handling. I pushed for a first-principles error taxonomy (retry at the transport vs re-prompt at the model vs fail fast), one centralized model wrapper, and sensible defaults in a single place. That became DESIGN Decision 8 and `defaults.ts`.
- **Conventions I set** — diagrams are mermaid, promoted to a standing rule in `AGENTS.md`; and the provider stays Anthropic-native rather than routing through a third-party credit broker, to keep the artifact coherent with its own thesis (multi-provider is a documented non-goal, not a gap — the `ModelClient` seam makes it a drop-in later).
- **Process discipline** — every phase runs to a hard gate and stops for review; I never let the agent run ahead across phases. That includes shipping the `shipit` skill in-repo as an exhibit and greenlighting its self-improvements.
- **Cut the LLM judge for deterministic scoring** — my prior eval experience was a deterministic scoring matrix over outcomes, not prose evaluation, and I trust that more. So the output gate is deterministic faithfulness checks (the customer message must be consistent with the action and trace) rather than an LLM judge — which also keeps the eval layer true to the repo's determinism thesis. Conscious tradeoff: we don't chase subtle semantic hallucinations that are structurally consistent. This bent the plan away from SPEC's "LLM judge" must-have; the reasoning won over the spec.
- **Demanded provable drift detection** — "prove we actually catch something." That flushed out the real distinction: strict fingerprinting catches drift in *our* artifact (prompt/tools/model-id) loudly, but replay *insulates* from live model drift (frozen responses), so the offline suite can't see the model change under us. Led to a live drift canary — re-run the scenarios against the live model and diff the trajectory against the recorded baseline — as the model-drift catcher, distinct from the fingerprint catch.

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

## Phase 2 — record/replay (the centrepiece)
- Fingerprint over (model, system, messages, tools) with canonical JSON (sorted keys, array order preserved); property-tested for stability, key-order independence, per-field sensitivity, and that `max_tokens` is deliberately excluded.
- Cassettes are one reviewable JSON file per scenario; `RecordingClient` / `ReplayClient` sit at the `ModelClient` seam. A replay miss throws a diff-friendly `ReplayMissError` naming which of the four fields changed and telling you to re-record — strict matching turns prompt drift into a red build with a decision attached, not silent staleness.
- `npm run record` captured the happy-path scenario live (3 turns) into a committed cassette. The payoff: `replay.test.ts` runs the real agent loop — lookup → refund → resolve — offline against those recorded responses, green with the key unset. It works only because record and replay reconstruct byte-identical requests, which is Phase 0's determinism seam paying off.
- Review catches this round: `loadCassette` cast a hand-editable file straight to the type with no validation — now it fails loudly at the load boundary with a structured `CassetteError` naming the file, rather than obscurely deep in `ReplayClient`. Plus a misleading miss-diagnostic string, and script duplication (the demo hard-coded the scenario input that also lives in `scenarios.ts` — a silent-drift risk, since that literal is what the cassette fingerprints against — now a shared constant, alongside a shared `requireApiKey` helper).

## Phase 3 — guardrails + deterministic evals
- Policy layer (`checkRefund`: ceiling / over-refund / double-refund / refundable-state, in that precedence) as pure functions with exhaustive tests. Wired into the loop as Gate 2, between the model's proposal and execution — code it can't bypass — emitting a `guardrail_decision` trace event; denials return as structured tool errors the agent recovers from. Gate: over-limit refund blocked → escalated, asserted.
- To place the gate correctly, split the tool interface into `parse` (Gate 1 schema) / `run` / optional `policy` (Gate 2), so the loop orchestrates the two gates and traces each — rather than burying policy inside the tool.
- Eval suite: a trajectory-first runner replays each scenario offline and asserts tool sequence + guardrail outcomes + final action. Five golden scenarios recorded and green: happy refund, lookup-only, over-limit-block, ambiguous→escalate, prompt-injection.
- Prompt-injection result worth keeping: the agent looked up both payments but refunded only the legitimate one — it declined the injected over-limit refund on its own, before the guardrail even fired. The injection changed words, never actions.
- Proved drift detection live: a one-word system-prompt change made all five evals fail loudly, each naming the exact digest change (`14bd79 → 6beb21`) and saying to re-record. Reverted, green again. This is the Phase 4 "break it → red CI" demo, brought forward.
- Decision (see human-in-the-loop notes + DESIGN Decision 5): dropped the LLM judge for deterministic faithfulness scoring. Faithfulness checks + a live drift canary (for model drift, which replay insulates against) are the next build.
