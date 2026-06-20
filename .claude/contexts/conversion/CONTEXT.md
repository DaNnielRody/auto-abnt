# Conversion

Deterministic pre-pass: a `.docx` plus cover-form metadata become an abnTeX2 `.tex`
skeleton, entirely vendor-free. Source: `src/converter.js` (docx → structured blocks via
`mammoth`), `src/latex.js` (blocks + metadata → `.tex`), `src/handoff.js` (refinement
prompt text). Sink today: a downloadable `.tex`/`.zip`; in the pivot, the input to AI Formatting.

## Language
**Skeleton (`.tex`)**:
The auto-generated abnTeX2 LaTeX draft — capa + folha de rosto from the form, body
converted from the `.docx`, escaped specials, long quotes, lists, tables, figures. A
RASCUNHO, not final. _Avoid_: "the LaTeX", "output file" (ambiguous vs the finished AI result).

**Metadata**:
Cover/title-page fields from the form (título, autor, instituição, orientador, cidade,
ano, resumo, palavras-chave). _Avoid_: "form data" (that also includes the file upload).

**Heuristic headings**:
Title detection by Word Style + numbering/ALL-CAPS fallback → `\chapter`/`\section`/…
_Avoid_: "AI titles" (this step uses no AI).

**Handoff prompt**:
The ABNT-expert instruction (`PROMPT_CHATGPT`, `src/handoff.js`) describing refs (NBR
6023), citations (NBR 10520), heading cleanup. In the pivot this becomes the server-side
LLM system/user prompt, not user-pasted text. _Avoid_: "the prompt" unqualified.

## Relationships
- A **Skeleton** is built from one `.docx` plus one set of **Metadata**.
- A **Skeleton** is consumed by AI Formatting to produce finished ABNT LaTeX.
- **Heuristic headings** feed the **Handoff prompt**'s cleanup instructions.

## Flagged ambiguities
- Where Conversion runs in the pivot — stays in-browser (zero-cost pre-pass, current) vs
  moves server-side behind a `SkeletonBuilder` port (uniform pipeline, easier billing
  gate). Resolution: grill. Default lean: keep deterministic skeleton client-side, send
  it + metadata to the server for the paid AI pass.
- "Refinement" means two things post-pivot — the deterministic heuristic cleanup vs the
  LLM pass. Use "skeleton build" vs "AI formatting" to disambiguate.
