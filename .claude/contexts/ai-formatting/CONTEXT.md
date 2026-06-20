# AI Formatting (target — not built yet)

Turns the deterministic Skeleton + Metadata into finished ABNT LaTeX via an LLM. Exists
behind a **port** so OpenAI, Claude, or any future vendor is swappable without touching
callers. Source: composition root + `LlmFormatter` adapter(s) (to be created via pipeline).

## Language
**`LlmFormatter` (port)**:
The interface a use-case depends on. Contract (proposed): `format({ skeleton, metadata })
→ { latex, warnings }`. Vendor-agnostic; no caller imports an LLM SDK. _Avoid_: "the AI",
"OpenAI client" (that's an adapter, not the port).

**Adapter**:
A concrete impl of `LlmFormatter` wrapping one vendor SDK/HTTP API (`OpenAiFormatter`,
`ClaudeFormatter`), wired only at the composition root. _Avoid_: "provider" used for both
port and impl — port = `LlmFormatter`, impl = adapter.

**Formatting prompt**:
The server-side system+user prompt derived from `src/handoff.js`, enforcing NBR 14724 /
6023 / 10520. Lives with the adapter or a shared prompt module (decision: grill). _Avoid_:
"handoff prompt" (that was the user-pasted legacy flow).

**Finished LaTeX**:
The LLM output — compile-ready ABNT `.tex`, distinct from the Skeleton. _Avoid_: "the tex".

## Relationships
- A use-case in **Backend Core** depends on **`LlmFormatter`**; the chosen **Adapter** is
  injected at the composition root.
- **AI Formatting** consumes a Skeleton from **Conversion** and Metadata from the form.
- Its output feeds **Frontend** Preview, released only after **Billing** clears.

## Decisions (grill 2026-06-20)
- **Two adapters** behind `LlmFormatter`: `ClaudeFormatter` (DEFAULT) + `OpenAiFormatter`
  (alternative/fallback). Claude wired first; selection via config/env. Port identical for both.

## Flagged ambiguities
- Exact default model (Claude) — pick latest capable per the `claude-api` skill at impl time.
- Hallucination guard — the prompt forbids fabricating content; enforcement (validation
  pass, retry, diff vs skeleton) undecided: grill.
- Streaming vs single response for the preview — UX/cost: grill.
- Failure/timeout/refusal handling and whether a failed format still charges: grill +
  Billing (lean: never charge on failure).
