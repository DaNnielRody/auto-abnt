# Frontend

The page users touch: enterprise landing layout (Apply4You-style positioning, fewer
sections OK), the cover form, file upload, the inline LaTeX **preview**, payment trigger,
and download. Source today: `index.html`, `src/main.js` (orchestrator), `src/style.css`.
Design SoT: `docs/DESIGN.md` (tokens). Sink: posts to the backend HTTP boundary.

## Language
**Landing layout**:
Enterprise marketing-style page structure (hero, value sections, the tool itself, pricing/CTA)
positioned like the Apply4You Figma — layout/positioning only, not its colors. _Avoid_:
"the homepage" (this is the whole product surface, one page).

**Cover form**:
The metadata inputs + `.docx` picker (`#form`, `#docx` in current DOM). _Avoid_: "the form"
when payment fields are meant.

**Preview**:
Inline rendering of the finished ABNT LaTeX before download — replaces the Overleaf step.
Mechanism (PDF render vs source view) is undecided (see ambiguities). _Avoid_: "Overleaf"
(removed in pivot).

**Prompt panel**:
The signature dark mono panel (`{component.prompt-panel}` in DESIGN.md). Post-pivot it
holds the finished LaTeX/preview, not a copy-paste handoff. _Avoid_: "result box".

## Relationships
- The **Cover form** produces Metadata + a `.docx`, posted to **Backend Core**.
- The **Preview** renders what **AI Formatting** returns, gated by **Billing**.
- The page reads every visual value from `docs/DESIGN.md` tokens (no hardcoded hex/spacing).

## Decisions (grill 2026-06-20)
- **Preview = compiled PDF** (WYSIWYG): backend returns a real PDF (server LaTeX compile),
  shown inline in the result area; download = PDF (+ `.tex`). No Overleaf.
- **Framework**: stays vanilla JS + Vite (Conservador) unless a later slice's ADR changes it.
- **Payment UX**: Stripe — capture on download intent; flow shape (Checkout redirect vs
  inline PaymentIntent) decided with df-backend; preview is visible before pay.

## Flagged ambiguities
- PDF embed method (`<iframe>`/`<embed>` of a blob URL vs pdf.js) — df-design/df-frontend
  pick at impl; keep low-dep (prefer native embed before adding pdf.js).
