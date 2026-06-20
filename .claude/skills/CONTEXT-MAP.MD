# Context Map — auto-ABNT

Global project context for dark-factory runs and grilling sessions. Authoritative
planning doc: domain areas, engineering policy, mandatory write-back. The pipeline
skill obeys this map; it never supersedes it.

## Product (current → target)
- **Current**: static browser tool. User fills cover form + uploads `.docx`; browser
  generates abnTeX2 `.tex` skeleton (`mammoth` parse + heuristics), hands off a prompt
  to ChatGPT/Claude for refs/citations, user compiles on Overleaf. No backend, no AI
  call, no payment. Cost zero.
- **Target pivot**: paid SaaS. Same form, but a server calls an LLM (OpenAI or Claude)
  to produce finished ABNT LaTeX, renders an inline **preview**, user pays per
  formatting, then downloads. Overleaf removed. Landing-page layout (Apply4You-style
  enterprise positioning, fewer sections OK; design tokens in `docs/DESIGN.md`).
  Backend = clean architecture, low coupling: callers depend on **ports/interfaces**;
  swapping an impl (LLM vendor, payment vendor, compiler) changes an adapter, never the
  port → app does not break.

## Contexts
- [Conversion](../contexts/conversion/CONTEXT.md) — docx → abnTeX2 `.tex` skeleton (existing core)
- [Frontend](../contexts/frontend/CONTEXT.md) — landing page, cover form, LaTeX preview, download/handoff UI
- [AI Formatting](../contexts/ai-formatting/CONTEXT.md) — LLM port that turns the skeleton into finished ABNT LaTeX (target)
- [Billing](../contexts/billing/CONTEXT.md) — pay-per-formatting; payment-provider port (target)
- [Backend Core](../contexts/backend-core/CONTEXT.md) — clean-arch ports/adapters, use-cases, composition root (target)

## Relationships
- **Frontend → Backend Core**: form data + `.docx` posted to an HTTP boundary; receives
  LaTeX + preview; never talks to LLM/payment vendors directly.
- **Backend Core → AI Formatting**: a use-case calls the `LlmFormatter` port; adapter
  (OpenAI/Claude) is wired at the composition root.
- **Backend Core → Billing**: a use-case calls the `PaymentGateway` port; charge must
  clear (or be authorized) before the finished LaTeX/preview is released.
- **AI Formatting → Conversion**: the LLM refines the skeleton produced by Conversion;
  Conversion stays the deterministic pre-pass (cheaper, vendor-free).
- **Backend Core → Conversion**: skeleton generation may move server-side behind a
  `SkeletonBuilder` port (decision deferred to grill — see Conversion ambiguities).

## Engineering policy (Conservador — dark-factory default)
- Replicate existing patterns: small ESM modules with named exports (`src/converter.js`,
  `src/latex.js`, `src/handoff.js`); pure functions + a thin orchestrator (`src/main.js`);
  Vite build, `base: "./"`.
- **Clean-arch contract (product owner's explicit rule)**: every cross-boundary
  dependency is an interface/port. Implementations are adapters wired only at the
  composition root. Changing an impl edits the adapter, never the port or its callers.
  New ports get a one-line JSDoc `@typedef`/contract doc; no caller imports a vendor SDK.
- No new dependencies without an ADR (LLM SDK, payment SDK, server framework all count).
- Minimal diff during implementation; improvement belongs to the quality batch (always runs).
- Tests: `node test-smoke.mjs` (jsdom smoke) today; new code adds tests under `tests/`
  (or `*.test.mjs`) run by the same node runner. Sandbox gate must stay green.

## Context write-back (mandatory, before commit)
Every run updates the CONTEXT.md of each area it touched — new terms, changed
contracts/thresholds, new ports/envs/routes, resolved ambiguities — in the same run,
never deferred. A run that changes area behavior without updating its CONTEXT.md is
incomplete. Grill decisions are written back inline as they land. Design decisions are
written back to `docs/DESIGN.md` (and human visual feedback to the global
`~/.claude/skills/darkdesign/HUMAN-INFERENCE.md`) the same turn. This rule lives here
(context operations), never in the pipeline SKILL.md (orchestration only).
