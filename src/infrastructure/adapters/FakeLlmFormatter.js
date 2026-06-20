/**
 * Adapter: FakeLlmFormatter (Slice 1 stand-in for ClaudeFormatter/OpenAiFormatter)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the LlmFormatter port with ZERO
 * vendor SDK — it echoes the deterministic skeleton into plausible "finished"
 * ABNT LaTeX so the walking skeleton proves end-to-end. A later slice replaces
 * this with a real Claude/OpenAI adapter (wired only at the composition root).
 *
 * Contract honored: returns { latex, warnings }; throws on failure (never an
 * empty latex as success) so the use-case never bills on AI failure.
 *
 * @implements {import('../../application/ports/LlmFormatter.js').LlmFormatter}
 * @see ../../application/ports/LlmFormatter.js
 */
export class FakeLlmFormatter {
  /**
   * @param {import('../../application/ports/LlmFormatter.js').FormatInput} input
   * @returns {Promise<import('../../application/ports/LlmFormatter.js').FormatResult>}
   */
  async format({ skeleton, metadata } = {}) {
    if (typeof skeleton !== 'string' || skeleton.length === 0) {
      throw new Error('FakeLlmFormatter: missing skeleton (simulated AI failure)');
    }

    const meta = metadata ?? {};
    const titulo = meta.titulo ?? 'Sem título';
    const autor = meta.autor ?? 'Autor desconhecido';

    // Plausible "finished" abnTeX2 document echoing the draft + cover metadata.
    const latex = [
      '\\documentclass[12pt,a4paper]{abntex2}% FINISHED (fake formatter)',
      `\\titulo{${titulo}}`,
      `\\autor{${autor}}`,
      '\\begin{document}',
      '\\imprimircapa',
      '% --- conteúdo formatado a partir do RASCUNHO abaixo ---',
      skeleton,
      '\\end{document}',
    ].join('\n');

    // Deterministic non-fatal warnings (no random / no Date.now).
    const warnings = meta.ano ? [] : ['ano não informado; assumido o ano corrente'];

    return { latex, warnings };
  }
}
