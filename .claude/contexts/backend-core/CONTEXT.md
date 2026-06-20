# Backend Core (target — not built yet)

The clean-architecture spine the product owner asked for: use-cases orchestrate the flow
(receive form+docx → build skeleton → AI format → bill → release) depending only on
**ports**; vendors live in **adapters** wired at one **composition root**. Changing an
impl edits an adapter, never a port or a caller. Source: to be created via pipeline.

## Language
**Port (interface/protocol)**:
A vendor-agnostic contract a use-case depends on (`LlmFormatter`, `PaymentGateway`,
`SkeletonBuilder?`, `FileStore?`). Defined in the domain/application layer; documented
with a JSDoc `@typedef` or contract block. _Avoid_: "service" used loosely for both port
and impl.

**Adapter**:
A concrete impl of a port wrapping infrastructure (an LLM SDK, a payment SDK, fs/HTTP).
Lives in an infrastructure layer; the only place a vendor SDK is imported. _Avoid_:
"implementation" without saying which port.

**Use-case**:
An application-layer function/class encoding one product action (e.g.
`FormatThesisUseCase`). Depends on ports passed in; contains no vendor code, no framework
code. _Avoid_: "controller", "handler" (those are the HTTP boundary, a thin adapter).

**Composition root**:
The single wiring point that instantiates adapters and injects them into use-cases (the
only file that knows concrete vendors). _Avoid_: "config", "bootstrap" ambiguously.

**HTTP boundary**:
The thin transport layer (route/handler) translating requests into use-case calls; carries
no business logic. _Avoid_: "the backend" (that's everything; this is just the edge).

## Relationships
- A **Use-case** depends on one or more **Ports**; the **Composition root** injects
  **Adapters**.
- The **HTTP boundary** invokes **Use-cases**; **Frontend** talks only to the HTTP boundary.
- **FormatThesisUseCase** composes Conversion (skeleton), AI Formatting (`LlmFormatter`),
  and Billing (`PaymentGateway`) through their ports.

## Decisions (grill 2026-06-20)
- **Runtime**: standing Node server in a **container**, deployed on the owner's own VPS
  (not serverless — required because preview compiles PDF, see Frontend). HTTP framework:
  minimal (Hono/Fastify) — df-architecture proposes; new dep ⇒ ADR.
- **LaTeX compiler** lives in the production container behind a `LatexCompiler` port
  (`compile({ latex, assets? }) → { pdf, log }`). Engine = TeX Live with the `abntex2`
  package (reliability over image size, since VPS-hosted); Tectonic is the fallback option
  if package fetch proves reliable. Compiler choice is the one open technical risk for the
  first slice.
- **Secrets** (LLM + Stripe keys): env only, never client, never in repo; sandbox dummies.

## Flagged ambiguities
- Layer layout on disk (`src/domain`/`src/application`/`src/infrastructure`/`src/composition`)
  — df-architecture proposes in the first slice.
- Exact HTTP framework (Hono vs Fastify) — ADR in the first backend slice.
- Where Conversion runs (client vs server `SkeletonBuilder` port) — see Conversion context.
