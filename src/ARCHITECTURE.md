# Architecture — auto-ABNT backend (clean-arch, Slice 1)

The paid-SaaS pivot adds a clean-architecture backend under `src/`, alongside the
existing vendor-free browser code. **One rule above all:** callers depend on
**ports**; concrete **adapters** are wired only at the **composition root**.
Swapping an impl (LLM vendor, payment vendor, LaTeX engine) edits an adapter +
the root — never a port, a use-case, or the HTTP boundary.

## Layers (on disk)

```
src/
├─ domain/                       value shapes, vendor/framework-free
│   └─ types.js                  ThesisMetadata, Skeleton, FormattingJob, ...
├─ application/                  business rules; depends only on domain + ports
│   ├─ ports/                    vendor-AGNOSTIC interfaces (contracts)
│   │   ├─ LlmFormatter.js
│   │   ├─ LatexCompiler.js
│   │   └─ PaymentGateway.js
│   └─ use-cases/
│       └─ FormatThesisUseCase.js    orchestrates the seam (signature; body = df-backend)
├─ infrastructure/              adapters (vendor SDKs) + transport edge  [df-backend]
│   ├─ adapters/                 Fake* (Slice 1) then Claude/Stripe/TexLive
│   └─ http/                     thin HTTP boundary (node:http) — translates req→use-case→res
├─ composition/
│   └─ root.js                   THE ONLY place adapters/vendor SDKs are imported & injected
│
└─ (existing browser code — unchanged, stays here)
   converter.js, latex.js, handoff.js, main.js, style.css
```

## Dependency direction (must point inward)

```
infrastructure ─┐
http boundary ──┤──▶ application (use-cases) ──▶ application/ports ──▶ domain
composition ────┘                                                       ▲
   (composition imports concrete adapters + use-cases and wires them)   │
   adapters implement ports ───────────────────────────────────────────┘
```

- **domain** depends on nothing.
- **application** (use-cases) depends on **domain** + **ports** only. No vendor, no framework.
- **ports** are interfaces; **adapters** (infrastructure) implement them.
- **HTTP boundary** carries no business logic — it only translates request → use-case → response.
- **composition root** is the single file importing concrete adapters / vendor SDKs.

## The rule (product owner's prime directive)

> Callers depend on ports. Adapters are wired only at the composition root.
> Changing an impl edits an adapter (and the root), never a port nor a caller.
> Every new cross-boundary dependency = a port with a documented contract.

## Port contracts (Slice 1)

| Port | Method(s) | Contract |
|------|-----------|----------|
| `LlmFormatter`   | `format({ skeleton, metadata }) → { latex, warnings }` | throws on AI failure (never returns empty latex as success) |
| `LatexCompiler`  | `compile({ latex, assets? }) → { pdf, log }`            | throws on compile failure (never returns empty pdf as success) |
| `PaymentGateway` | `createCharge({ amount, currency, ref }) → { id, status, clientSecret? }`, `verify(id) → status` | release ONLY when `verify === 'paid'`; status verified server-side |

`FormatThesisUseCase.execute({ skeleton, metadata, ref })`: order = **format →
compile → charge**; **never bill on AI/compile failure**; **no release before
`verify === 'paid'`**.

## ADR-0001 — HTTP framework: DEFERRED (Slice 1 uses `node:http`)

- **Status**: deferred. **Context**: spec lists Hono/Fastify as candidates; project
  policy is Conservador with **zero new dependencies** in this slice.
- **Decision (Slice 1)**: the HTTP boundary (`src/infrastructure/http/`) uses Node's
  **built-in `node:http`** — no framework dependency. The framework choice (Hono vs
  Fastify) is deferred to a later slice and will be its own ADR (any pick = new dep ⇒ ADR).
- **Consequence**: the boundary stays thin and framework-agnostic; routes
  `POST /format` and `GET /download/:id` translate to use-case calls. Adopting a
  framework later changes only the boundary, not use-cases/ports.

## ADR-0002 — Layer layout: ACCEPTED

- `domain / application / infrastructure / composition` under `src/`, existing
  browser files left in place. Resolves the layout ambiguity flagged in
  `backend-core/CONTEXT.md`.
