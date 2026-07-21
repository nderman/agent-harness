# SPEC — agent-harness

## The problem

An LLM agent is a nondeterministic program with side effects. That breaks the standard testing contract in three ways:

1. **Nondeterminism.** The same input can produce different tool calls, different orderings, different wording. Assertions on exact output flake; assertions loose enough not to flake don't test anything.
2. **Cost and latency in CI.** Testing against a live model means every CI run costs money, takes minutes, and can fail for reasons unrelated to your code (rate limits, model updates, network).
3. **Actions, not just answers.** An agent that produces a lovely apology while refunding the wrong customer is a worse failure than a crash. Correctness lives in the *trajectory* — which tools were called, with what arguments, in what order, and what was refused — not just the final text.

The industry answer to this is a harness: capture real interactions, replay them deterministically, assert on trajectories, wall off unsafe actions, and measure drift over time. This repo builds that harness, small and sharp.

## The agent under test

A **payments-support agent** (domain chosen deliberately — payments orchestration is a domain where "the agent did something dumb" has a dollar sign on it). One conversation turn in, structured resolution out.

- **Tools:**
  - `lookup_payment(payment_id | customer_email)` → payment record (status, amount, currency, method, customer)
  - `issue_refund(payment_id, amount, reason)` → refund confirmation — *the dangerous one; guardrailed*
  - `escalate(reason, priority)` → ticket handle — the agent's safe exit when it shouldn't act
- **Output:** a structured `Resolution` object (action taken, customer-facing message, references), schema-validated.
- **Model:** `claude-haiku-4-5` — cheap and fast; record/replay makes live calls rare anyway, and a smaller model produces more interesting failure modes for the harness to catch (a feature, not a bug).
- **Backing data:** a small in-memory fixture "payments database". No real integrations — the tools are real code with real validation, but the data is canned.

## Goals (the five capabilities, scoped)

### 1. Record/replay (the centrepiece) — MUST
- A `ModelClient` seam between the agent and the Anthropic SDK with three modes: **live** (call API), **record** (call API, persist request+response as a cassette entry), **replay** (serve responses from cassette, no network).
- Cassettes are committed, human-readable JSON — reviewable in a PR diff like any other fixture.
- Replay matches on a **semantic fingerprint** of the request (model + system + messages + tools). A fingerprint miss fails loudly with a diff-friendly message: *"prompt changed since recording — re-record or fix"*. This turns prompt drift into a visible test failure instead of silent staleness.
- Success criterion: `npm test` passes with no `ANTHROPIC_API_KEY` set, in < 10 s, and is bit-for-bit repeatable.

### 2. Eval suite — MUST
- Golden scenarios in `evals/scenarios/`: input conversation + expectations.
- Two assertion classes, both deterministic (no LLM judge — see DESIGN Decision 5):
  - **Trajectory assertions:** tool call sequence, argument matching (exact or predicate), guardrail outcomes.
  - **Output assertions:** schema validity always; plus **faithfulness checks** — the customer message must be consistent with the action and trace (`escalated` ⇒ claims no refund; `refunded` ⇒ references the refund). The safety-critical output check, structurally checkable without a model.
- Scenarios must include at least: happy-path refund, lookup-only question, refund-over-limit (guardrail must block), ambiguous request (agent must escalate, not guess), and a prompt-injection attempt in customer input.
- Success criterion: eval run produces per-scenario pass/fail + scores, machine-readable (JSON) and human-readable (report).

### 3. Guardrails — MUST
- Schema validation (zod) on every tool call's arguments and on the final output — malformed calls never reach tool code.
- Policy layer on `issue_refund`: amount ceiling, refund-must-not-exceed-payment, no double refund, payment must be in refundable state.
- Guardrail violations are first-class events: recorded in the trace, surfaced to the agent as tool errors (so it can recover, e.g. escalate), and assertable in evals.
- Full model in `GUARDRAILS.md`. Success criterion: the over-limit scenario shows the block happening and the agent recovering by escalating.

### 4. Observability — MUST (report format may be cut to markdown-only)
- Every run produces a structured trace (JSONL of typed events): model requests/responses, tool calls/results, guardrail decisions, token usage, computed cost, wall-clock latency.
- A report generator renders traces + eval results into a readable artifact (markdown; static HTML is stretch).
- Success criterion: from a report alone you can answer "what did the agent do, what did it cost, and where did it go off-script?"

### 5. Regression detection — SHOULD
- `evals/baseline.json` is committed. The eval runner diffs current results against it: regressions (pass→fail, score drops beyond threshold) fail the run; improvements prompt a baseline update.
- Success criterion: deliberately break the prompt → CI goes red with a diff naming the regressed scenarios.

## Non-goals (stated so the cuts are visible)

- **Not a framework.** No plugin system, no config DSL, no attempt to generalize beyond what the demo agent needs. The patterns generalize; the code doesn't pretend to.
- **No real payments integration, no persistence, no auth.** Fixture data only.
- **No UI beyond the report.** The hosted link is a static artifact (eval report / traces), not an app.
- **No multi-turn conversation memory, no streaming, no parallel tool execution** — all real concerns, all out of scope for 3 days. Noted in DESIGN.md as extension points.
- **No prompt optimization.** The agent's prompt only needs to be good enough to exercise the harness, including its failure modes.

## Overall success criteria (what "done" means for the submission)

1. `npm test` — green, offline, fast, deterministic.
2. `npm run eval` — produces a report + baseline diff; the guardrail and escalation scenarios demonstrably work.
3. A reviewer can read README → DESIGN → one cassette → one trace and understand the whole system in ~15 minutes.
4. Hosted link shows the eval report.
5. The "how I used AI" story is written and honest.
