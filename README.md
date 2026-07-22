# agent-harness

[![ci](https://github.com/nderman/agent-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/nderman/agent-harness/actions/workflows/ci.yml)

**A test & evaluation harness that makes an AI agent deterministic, testable, and observable — demonstrated on a small payments-support agent.**

Built with Claude Code · Anthropic SDK (Claude Haiku + Opus) · TypeScript · vitest · zod · tsx · GitHub Actions + Pages.

📊 **Live eval report → https://nderman.github.io/agent-harness/** — regenerated and deployed by CI from committed cassettes on every push (zero live API calls); each scenario links to its JSONL trace.

## The thesis

The take-home brief says *"build something using AI."* The role is about making AI agents **reliable, testable, and production-ready**. So this repo deliberately does not ship another chatbot-with-an-API-key. It ships the thing that's actually hard and actually the job: a **harness** — the machinery that lets you trust an agent enough to put it in production.

The agent here (a payments-support agent with three tools) is intentionally small. It exists to give the harness something real to bite on. The harness is the point:

1. **Deterministic record/replay** — every LLM interaction is captured as a cassette and replayed byte-for-byte in tests. The agent is unit-testable in CI with **zero API calls, zero flakes, zero cost**.
2. **Eval suite** — golden scenarios that assert on the *trajectory* (right tool, right order, guardrail outcomes) as well as the final action, plus deterministic **faithfulness checks** (the resolved action and references must match what actually happened in the trace) — no LLM judge, so the whole suite is exactly reproducible. (Why the judge was dropped: DESIGN Decision 5.)
3. **Guardrails** — schema validation on every tool call and final output, plus a policy layer that blocks unsafe actions (over-limit refunds, double refunds) *before* they execute.
4. **Observability** — a structured trace per run: every model call, tool call, guardrail decision, token count, cost, and latency — rendered into a human-readable report.
5. **Regression detection** — eval results diff against a committed baseline; drift fails the build.

### Drift detection, proven

A one-word change to the system prompt — nothing else — turns CI red: [**demo run 29863916603**](https://github.com/nderman/agent-harness/actions/runs/29863916603) fails with `Replay miss on cassette … no recorded response matches this request` on *every* scenario, each naming the exact prompt digest that changed and telling you to re-record. Strict fingerprint matching turns silent behavioural drift into an ordinary red build. (Branch [`demo/prompt-regression`](https://github.com/nderman/agent-harness/compare/main...demo/prompt-regression) — intentionally not merged.)

## Why this is the interesting problem

Agents are nondeterministic programs that take actions. Ordinary testing assumes determinism; ordinary monitoring assumes request/response. Neither survives contact with an agent. The three questions this repo answers are the three questions any team shipping agents must answer:

- **How do you test it?** (record/replay + trajectory assertions)
- **How do you stop it doing something dumb?** (guardrails as a layer the agent cannot bypass)
- **How do you know what it did and whether it got worse?** (traces + baseline diffing)

## Quickstart

```bash
npm install
npm test          # full unit + eval suite — replay mode, no API key needed
npm run eval      # eval suite → report (report/index.html) + baseline regression diff
npm run demo      # run the agent live against one scenario     (needs ANTHROPIC_API_KEY)
npm run record    # re-record cassettes after an intentional prompt/tool change (needs key)
npm run canary    # drift canary: re-run scenarios against the live model (needs key)
```

> `npm test` is the headline: the whole suite — agent behaviour, guardrails, and the deterministic eval — replays committed cassettes offline. No API key, no network, no flakes. That's the harness doing its job.

## Repo map

| Path | What it is |
|---|---|
| `SPEC.md` | Problem statement, goals/non-goals, scoped capabilities, success criteria |
| `DESIGN.md` | Architecture and the key decisions, with trade-offs |
| `GUARDRAILS.md` | The safety/validation model |
| `AGENTS.md` | How an AI coding agent works in this repo (also a work sample — see below) |
| `TODO.md` | Phased plan with must-have vs stretch cut lines |
| `NOTES.md` | Running per-phase development log (the raw "how I used AI" record) |
| `SUBMISSION.md` | Deliverables checklist mapped to the brief |
| `src/agent/` | The agent under test: loop, tools + guardrail policy, prompt, scenarios, fixture DB |
| `src/harness/` | The harness: `model-client` seam, `cassette` record/replay, `eval` runner, `trace`, `report` |
| `cassettes/` | Committed recordings — the test fixtures |
| `evals/` | Golden scenarios + committed baseline |

## Known limitations / what I'd do next

Stated plainly, because a harness that oversells its guarantees is worse than one whose edges are known. Each is a deliberate scope cut for a take-home, with the extension noted.

- **Replay assumes deterministic tools.** Record/replay freezes the *model* side (a fingerprint over model + system + messages + tools); on replay the tools still **execute live** against the in-memory fixture DB, which is pure and deterministic. Point a tool at a real PSP — network, clocks, non-reproducible refund ids — and replay would diverge. The seam is already in place (injected `Clock` + `IdGenerator`); the next step is to record tool *outputs* alongside model turns and replay those too, making the whole trajectory hermetic.
- **Injection resistance is detected, not proven.** The two injection scenarios each freeze one recorded run where the agent ignored the injection. That lets the canary catch a *regression* in that behaviour; it does not prove the agent is robust to injection in general (that's model-dependent and adversarial). Real coverage would be a fuzzed corpus of injection phrasings scored for attack-success-rate, not a single golden.
- **Faithfulness is structural, not semantic.** The check asserts the *structured* resolution (action + references) matches the trace; it deliberately does not judge the free-text message's prose. A message that lies in words while the action is correct is out of scope — that residue is what an LLM judge would have scored, dropped on purpose (DESIGN Decision 5).
- **Guardrail e2e coverage is layered.** The ceiling guardrail fires end-to-end in `over-limit-refund`. The `double_refund` guardrail is a *latent backstop*: in `double-refund` the model declines before it ever calls the tool, so in a natural run layer 2 is never reached. To exercise the denial path anyway, the harness has a **fault-injection mode** (`FaultInjectingClient`) that forces the unsafe tool call; a loop test then drives `double_refund` denial → structured error → escalation end-to-end (`src/agent/loop.test.ts`). What stays model-dependent — and so is only *detected* by a frozen golden, not proven — is whether the model declines on its own in the first place.
- **Trajectory assertions are order-strict.** Expectations pin the exact tool sequence, which can over-fit — a valid re-ordering reads as a failure. That's intentional for offline goldens (tight is the point) but is why drift-sensitivity lives in the sampling `canary`, not the strict suite.

## How I used AI to build this

A first-class deliverable — for a harness role, how I engineer *with* agents is half the signal. This is the curated version; `NOTES.md` is the running per-phase log, including a "where the human stayed in the loop" record of the calls that were mine to make.

- **Tooling:** Claude Code as the primary development agent; this repo's `AGENTS.md` is the operating manual I wrote for it. `.claude/skills/shipit/` is a real skill from my daily workflow — a review → test-coverage → simplify → document → commit pipeline the agent runs before every push here (included both as working tooling and as a process sample).
- **Process:** plan → sign-off → test-first implementation in phases (see `TODO.md`), each with a hard gate. The agent writes code and tests together; the offline invariant is enforced by CI (no API key configured), not asserted.
- **What the process caught — the thesis, demonstrated on itself:** *twice*, in separate phases, the shipit review agents flagged a real correctness bug my green tests had missed. Phase 1 — a shared re-prompt counter that mis-attributed *why* a run failed. Phase 4 — the baseline diff flagged an *improvement* (a scenario going fail→pass) as a regression, which would have reddened CI on a pure fix. Each fix shipped with a regression test in the same commit. Automated adversarial review catching what unit tests didn't, on the harness's own construction, is exactly what this repo argues for.
- **The tooling improved itself:** the `shipit` skill's first real run here surfaced its own gaps (an untracked-file blind spot, no re-run-after-fix rule, no secrets scan); I patched the skill and shipped the fix in the same commit.
- **Where my judgment was load-bearing:** the core bet — build a *harness*, not an app, inverting the brief; dropping the planned LLM judge for deterministic scoring after weighing it against prior eval experience (this overrode SPEC's own "must-have", kept clean-room); catching an under-specified error-handling layer that became Decision 8; choosing GitHub Pages so the whole submission lives in one place; and holding phase discipline so the agent never ran ahead of review. Full record in `NOTES.md`.
- **Meta:** the repo is itself an artifact of agentic engineering — an AI agent, inside a harness of conventions and tests, building a harness for AI agents.
