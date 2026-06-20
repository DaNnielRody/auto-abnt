/**
 * Port: LlmFormatter
 * -----------------------------------------------------------------------------
 * Layer: application (port). Vendor-AGNOSTIC contract.
 *
 * Turns the deterministic Conversion Skeleton (+ cover Metadata) into finished,
 * compile-ready ABNT LaTeX via an LLM. Use-cases depend on THIS port only.
 * Concrete adapters (e.g. ClaudeFormatter / OpenAiFormatter) live in
 * src/infrastructure/adapters and are wired ONLY at the composition root.
 *
 * RULE: no caller may import an LLM SDK. Swapping vendor edits an adapter,
 * never this port nor any use-case.
 *
 * @see ../../../.claude/contexts/ai-formatting/CONTEXT.md
 */

/**
 * Input to {@link LlmFormatter#format}.
 * @typedef {Object} FormatInput
 * @property {string} skeleton  Deterministic abnTeX2 `.tex` draft (Conversion output). RASCUNHO.
 * @property {import('../../domain/types.js').ThesisMetadata} metadata  Cover/title-page fields from the form.
 */

/**
 * Output of {@link LlmFormatter#format}.
 * @typedef {Object} FormatResult
 * @property {string} latex  Finished, compile-ready ABNT `.tex` (distinct from the skeleton).
 * @property {string[]} warnings  Non-fatal notes (e.g. assumptions, fields the LLM could not resolve).
 */

/**
 * @interface LlmFormatter
 *
 * Contract:
 * - MUST be pure w.r.t. business state: takes skeleton+metadata, returns LaTeX+warnings.
 * - MUST NOT fabricate bibliographic content beyond what the skeleton/metadata imply
 *   (hallucination guard enforced in the adapter prompt).
 * - On vendor failure/timeout/refusal it MUST throw (reject). It MUST NOT return a
 *   partial/empty `latex` as success — the use-case relies on throw to NEVER bill on
 *   AI failure. (see FormatThesisUseCase)
 */

/**
 * Produce finished ABNT LaTeX from a skeleton.
 * @function
 * @name LlmFormatter#format
 * @param {FormatInput} input
 * @returns {Promise<FormatResult>}
 * @throws {Error} on vendor failure/timeout/refusal (never resolve with empty latex).
 */

export {}; // contract-only module (JSDoc typedefs); no runtime export.
