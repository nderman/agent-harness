# agent-harness

**A test & evaluation harness that makes an AI agent deterministic, testable, and observable — demonstrated on a small payments-support agent.**

## The thesis

The take-home brief says *"build something using AI."* The role is about making AI agents **reliable, testable, and production-ready**. So this repo deliberately does not ship another chatbot-with-an-API-key. It ships the thing that's actually hard and actually the job: a **harness** — the machinery that lets you trust an agent enough to put it in production.

The agent here (a payments-support agent with three tools) is intentionally small. It exists to give the harness something real to bite on. The harness is the point:

1. **Deterministic record/replay** — every LLM interaction is captured as a cassette and replayed byte-for-byte in tests. The agent is unit-testable in CI with **zero API calls, zero flakes, zero cost**.
2. **Eval suite** — golden scenarios that assert on the *trajectory* (right tool, right args, right order) as well as the final answer, with a recorded LLM judge for the fuzzy parts.
3. **Guardrails** — schema validation on every tool call and final output, plus a policy layer that blocks unsafe actions (over-limit refunds, double refunds) *before* they execute.
4. **Observability** — a structured trace per run: every model call, tool call, guardrail decision, token count, cost, and latency — rendered into a human-readable report.
5. **Regression detection** — eval results diff against a committed baseline; drift fails the build.

## Why this is the interesting problem

Agents are nondeterministic programs that take actions. Ordinary testing assumes determinism; ordinary monitoring assumes request/response. Neither survives contact with an agent. The three questions this repo answers are the three questions any team shipping agents must answer:

- **How do you test it?** (record/replay + trajectory assertions)
- **How do you stop it doing something dumb?** (guardrails as a layer the agent cannot bypass)
- **How do you know what it did and whether it got worse?** (traces + baseline diffing)

## Quickstart

```bash
npm install
npm test          # full unit + eval suite — replay mode, no API key needed
npm run demo      # run the agent live against one scenario (needs ANTHROPIC_API_KEY)
npm run eval      # run the eval suite and produce a report + baseline diff
npm run record    # re-record cassettes after an intentional prompt/tool change
```

> `npm test` is the headline: the entire suite, including agent behaviour and LLM-judge evals, runs offline and deterministically. That's the harness doing its job.

## Repo map

| Path | What it is |
|---|---|
| `SPEC.md` | Problem statement, goals/non-goals, scoped capabilities, success criteria |
| `DESIGN.md` | Architecture and the key decisions, with trade-offs |
| `GUARDRAILS.md` | The safety/validation model |
| `AGENTS.md` | How an AI coding agent works in this repo (also a work sample — see below) |
| `TODO.md` | Phased plan with must-have vs stretch cut lines |
| `SUBMISSION.md` | Deliverables checklist mapped to the brief |
| `src/agent/` | The agent under test: loop, tools, prompts |
| `src/harness/` | Record/replay, eval runner, guardrails, tracing, report |
| `cassettes/` | Committed recordings — the test fixtures |
| `evals/` | Golden scenarios + committed baseline |

## How I used AI to build this

*(Filled in as the build progresses — this section is a first-class deliverable. For a harness role, how I engineer WITH agents is half the signal.)*

- **Tooling:** Claude Code as the primary development agent; this repo's `AGENTS.md` is the operating manual I wrote for it. `.claude/skills/shipit/` is a real skill from my daily workflow — a review → test-coverage → simplify → document → commit pipeline the agent runs before every push in this repo (included both as working tooling and as a process sample).
- **Process:** plan → sign-off → test-first implementation in phases (see `TODO.md`); the agent writes code and tests together, CI green from Phase 0.
- **Meta:** the repo is itself an artifact of agentic engineering — an AI agent, working inside a harness of conventions and tests, building a harness for AI agents.
- *(To add: what the agent got wrong and how the process caught it; prompts/sessions worth showing; where human judgment was load-bearing.)*
