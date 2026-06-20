/**
 * Domain types (value shapes) — auto-ABNT backend.
 * -----------------------------------------------------------------------------
 * Layer: domain. Vendor-free, framework-free, dependency-free value definitions
 * shared across ports and use-cases. JSDoc typedefs only (this is JS, no TS).
 *
 * Dependency direction: domain depends on NOTHING. application/infrastructure/
 * composition may depend on domain; never the reverse.
 */

/**
 * Cover / title-page metadata captured from the form (Conversion vocabulary).
 * @typedef {Object} ThesisMetadata
 * @property {string} titulo
 * @property {string} autor
 * @property {string} instituicao
 * @property {string} [orientador]
 * @property {string} [cidade]
 * @property {string} [ano]
 * @property {string} [resumo]
 * @property {string[]} [palavrasChave]
 */

/**
 * Deterministic Conversion output: the abnTeX2 `.tex` skeleton (a RASCUNHO).
 * @typedef {Object} Skeleton
 * @property {string} latex  The skeleton `.tex` source.
 */

/**
 * Result of one end-to-end formatting job (the walking-skeleton outcome).
 * `released` is true only after payment verified as 'paid'.
 * @typedef {Object} FormattingJob
 * @property {string} id          Job / order reference.
 * @property {string} latex       Finished ABNT LaTeX (from LlmFormatter).
 * @property {string[]} warnings  Non-fatal LLM warnings.
 * @property {Uint8Array} [pdf]   Rendered preview PDF (from LatexCompiler).
 * @property {string} chargeId    PaymentGateway charge id.
 * @property {import('../application/ports/PaymentGateway.js').ChargeStatus} status  Charge status.
 * @property {boolean} released   Whether finished LaTeX/PDF may be handed to the client.
 */

export {}; // contract-only module (JSDoc typedefs); no runtime export.
