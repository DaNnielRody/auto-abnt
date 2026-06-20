/**
 * Port: LatexCompiler
 * -----------------------------------------------------------------------------
 * Layer: application (port). Vendor/engine-AGNOSTIC contract.
 *
 * Compiles finished ABNT LaTeX into a PDF for the inline preview / download.
 * Concrete adapter wraps the TeX toolchain (TeX Live + abntex2, Tectonic fallback)
 * and lives in src/infrastructure/adapters, wired ONLY at the composition root.
 *
 * RULE: no caller spawns latex/processes directly. Swapping the engine edits an
 * adapter, never this port nor any use-case.
 *
 * @see ../../../.claude/contexts/backend-core/CONTEXT.md (LatexCompiler decision)
 */

/**
 * A named binary asset referenced by the LaTeX (e.g. an image/figure).
 * @typedef {Object} CompileAsset
 * @property {string} path   Relative path the LaTeX `\includegraphics`/`\input` expects.
 * @property {Uint8Array} bytes  Raw asset bytes.
 */

/**
 * Input to {@link LatexCompiler#compile}.
 * @typedef {Object} CompileInput
 * @property {string} latex  Finished, compile-ready ABNT `.tex` source.
 * @property {CompileAsset[]} [assets]  Optional figures/extra files referenced by the LaTeX.
 */

/**
 * Output of {@link LatexCompiler#compile}.
 * @typedef {Object} CompileResult
 * @property {Uint8Array} pdf  Rendered PDF bytes.
 * @property {string} log  Compiler log (for diagnostics / surfacing warnings).
 */

/**
 * @interface LatexCompiler
 *
 * Contract:
 * - MUST NOT mutate inputs.
 * - On a compile error it MUST throw (reject) — the use-case relies on throw to
 *   NEVER bill on compile failure. It MUST NOT return empty/garbage `pdf` as success.
 * - `log` SHOULD be returned even on success (may carry non-fatal warnings).
 */

/**
 * Compile LaTeX to PDF.
 * @function
 * @name LatexCompiler#compile
 * @param {CompileInput} input
 * @returns {Promise<CompileResult>}
 * @throws {Error} on compile failure (never resolve with empty pdf).
 */

export {}; // contract-only module (JSDoc typedefs); no runtime export.
