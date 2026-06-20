/**
 * Adapter: FakeLatexCompiler (Slice 1 stand-in for TexLiveCompiler/Tectonic)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the LatexCompiler port with ZERO
 * external process — it returns deterministic, non-empty PDF bytes (a tiny valid
 * "%PDF" stub) so the walking skeleton proves end-to-end. A later slice replaces
 * this with a real TeX Live / Tectonic adapter (wired only at the composition root).
 *
 * Contract honored: returns { pdf, log }; throws on failure (never empty pdf as
 * success) so the use-case never bills on compile failure.
 *
 * @implements {import('../../application/ports/LatexCompiler.js').LatexCompiler}
 * @see ../../application/ports/LatexCompiler.js
 */

// Minimal, deterministic valid-ish PDF stub: a real "%PDF-1.4" header + EOF marker.
const PDF_STUB = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
);

export class FakeLatexCompiler {
  /**
   * @param {import('../../application/ports/LatexCompiler.js').CompileInput} input
   * @returns {Promise<import('../../application/ports/LatexCompiler.js').CompileResult>}
   */
  async compile({ latex } = {}) {
    if (typeof latex !== 'string' || latex.length === 0) {
      throw new Error('FakeLatexCompiler: empty LaTeX (simulated compile failure)');
    }

    // Fresh copy each call so callers can't mutate the shared stub.
    const pdf = PDF_STUB.slice();
    return { pdf, log: 'fake compile ok (no TeX engine in Slice 1)' };
  }
}
