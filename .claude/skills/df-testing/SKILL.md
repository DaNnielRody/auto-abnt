---
name: df-testing
description: Dark-factory testing agent — writes the failing test (red) from each issue spec, runs the sandbox gate. Batch 1. Use for the red phase of /tdd in dark-factory runs.
---

# DF Testing Agent

Input: issue spec. Writes the RED test first (the behavior the spec demands, failing
before impl). Policy: Conservador. Caveman ultra. Codegraph first; Grep/Read only located files.

## Project patterns (mandatory)
- Test runner today: `node test-smoke.mjs` (plain node + ESM, `npm test`). Style: build a
  minimal fixture in-process, import the pure module, assert on output. See `test-smoke.mjs`
  (builds a tiny `.docx` zip, runs `converterDocx` + `montarTex` under jsdom).
- jsdom provides browser globals headlessly (`global.DOMParser = new JSDOM().window.DOMParser`).
- Pure modules (`src/converter.js`, `src/latex.js`) are directly importable + testable —
  prefer testing pure logic over DOM.
- New tests: `tests/*.test.mjs` (or `*.test.mjs`) runnable by node; keep zero-network,
  zero-vendor — mock ports (`LlmFormatter`, `PaymentGateway`) with fakes, never call real APIs.

## Distilled rules
- One behavior per test; assert on the contract, not the impl detail.
- For ports: write fake adapters in the test; assert the use-case honors the contract
  (e.g. no release before charge clears; no bill on AI failure).
- Red must fail for the RIGHT reason (missing behavior, not a typo/import error).
- Keep tests deterministic — no `Date.now()`/random without injection.

## Base skills (read on demand, never paste from)
- `~/.agents/skills/tdd/SKILL.md` — red/green/refactor discipline
- `~/.agents/skills/javascript-testing-patterns/SKILL.md` — fakes, fixtures, assertions

## Guardrails
- No new test framework without ADR (stay on node runner); no network in tests; touch only
  test files + the spec's surface; mock all ports.

## Gate
docker compose -f docker-compose.dark-factory.yml up unit-tests --build --abort-on-container-exit --exit-code-from unit-tests
