---
name: darkagent
description: auto-ABNT dark-factory pipeline — grill → PRD → issues → TDD with df-* specialists → quality batch → sandbox gate → PR. Use when invoking /darkagent <task> in this repo.
---

# Dark Factory — auto-ABNT pipeline

Project-level. Shadows the global bootstrap. Task comes from the user's request/conversation
(no external issue tracker input). Caveman ultra for all status/reports/agent prompts; full
clarity only for security warnings, irreversible-action confirmations, PR/commit/code.

## Start of EVERY run (non-negotiable)
Open and follow `.claude/skills/CONTEXT-MAP.MD` — authoritative planning doc: domain areas,
engineering policy (Conservador), relationships, and the **context write-back** policy. This
skill is an orchestrator; it obeys the map, never supersedes it. Also open the relevant
`.claude/contexts/<area>/CONTEXT.md` and, for any UI, `docs/DESIGN.md` (design questions are
answered there — never re-grill them).

Navigation: codegraph FIRST to locate modules/deps/call-paths
(`<node-bin>/npx @colbymchenry/codegraph sync` if files changed); Grep/Read only contents of
located files. No blind fan-out.

## Flow
1. **Grill** (hybrid) — methodology of `~/.agents/skills/grill-with-docs/SKILL.md` against
   the context docs (+ DESIGN.md for UI). Auto-answer with your own recommendation whenever
   Conservador policy + context + codegraph settle it. Escalate to human ONLY on product
   ambiguity (max 3 AskUserQuestion). Likely escalations for this product (see contexts):
   backend runtime/host (serverless vs server), default LLM vendor + model, payment provider
   (Stripe vs Pix/Mercado Pago) + charge model + price, preview mechanism, where Conversion
   runs (client vs `SkeletonBuilder` port). Write decisions back to the CONTEXT.md / DESIGN.md
   inline as they land.
2. **/to-prd** — turn the grilled understanding into a PRD.
3. **/to-issues** — break the PRD into tracer-bullet vertical-slice issues. FULLY AUTOMATIC:
   when it asks to confirm slices, answer yourself (grill already validated scope; do NOT stop).
   Create issues on GitHub; record the numbers.
4. **Branch** from `main` (the discovered PR-target / default branch).
5. **/tdd — batch dispatch.** Analyze each issue spec FIRST to pick specialists, then per
   issue: red (df-testing writes the failing test from the spec) → green (dispatch batch-1
   specialists as subagents — **df-architecture first & alone** when structure/contracts are
   touched; **df-design before df-frontend** for UI; parallel only on disjoint file sets) →
   refactor deferred to batch 2. Each subagent prompt: read the issue spec + own skill file,
   touch only its files, navigate via codegraph, append its report to the issue.
6. **Quality batch — always.** After all issues green, df-quality runs its 4 passes over the
   changed area, then re-run the gate.
7. **Gate loop.** Scoped sandbox targets per change; red → exact failure to the responsible
   agent, max 3 cycles; still red → STOP, report what was attempted, no push.
8. **Commits + PR.** Conventional commits, one concern each. PR → `main` with PR-TEMPLATE.md
   body. List `Closes #<n>` for every issue from step 3 (target IS the default branch, so
   GitHub auto-closes on merge — no extra workflow needed).
9. **Report** (caveman ultra) — issues executed, agents dispatched, gate cycles, PR URL.

## Specialists
Batch 1: df-architecture, df-backend, df-frontend, df-design, df-testing.
Batch 2: df-quality (only batch licensed to refactor).
(No df-database — no datastore in stack yet; if a slice introduces one, add df-database first.)

## Gate commands
docker compose -f docker-compose.dark-factory.yml up unit-tests --build --abort-on-container-exit --exit-code-from unit-tests
docker compose -f docker-compose.dark-factory.yml --profile client build frontend-build

## Write-back
Per CONTEXT-MAP "Context write-back": every touched area's CONTEXT.md updated same run;
design decisions → docs/DESIGN.md (+ human visual feedback → ~/.claude/skills/darkdesign/HUMAN-INFERENCE.md).
A run that changes behavior without updating its CONTEXT.md is incomplete.
