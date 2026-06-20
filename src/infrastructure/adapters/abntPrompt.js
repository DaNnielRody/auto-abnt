/**
 * Shared server-side ABNT prompt builder.
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter helper). Single source of the ABNT rules:
 * derives from src/handoff.js (PROMPT_CHATGPT) — NBR 14724/6023/10520 + the
 * "NÃO invente" no-fabrication guard — so the rules live in ONE place and are
 * never duplicated inline. Both ClaudeFormatter and OpenAiFormatter call this
 * to build the user prompt sent to the vendor.
 *
 * The handoff prompt is written for a human pasting a .tex into ChatGPT; here we
 * reuse the same rule text server-side, then append the skeleton + metadata and
 * instruct the model to return strict JSON {latex, warnings} (vendor-agnostic).
 *
 * @see ../../handoff.js
 */
import { PROMPT_CHATGPT } from '../../handoff.js';

/**
 * Build the server-side prompt for an LLM formatter.
 * @param {{ skeleton: string, metadata?: object }} input
 * @returns {string} the full prompt text (ABNT rules + skeleton + metadata + JSON contract).
 */
export function buildAbntPrompt({ skeleton, metadata } = {}) {
  const meta = metadata ?? {};
  const metaJson = JSON.stringify(meta, null, 2);

  // PROMPT_CHATGPT already ends with "Aqui está o arquivo:\n\n" — reuse it whole
  // (single source of the ABNT rules incl. "NBR 6023" + "NÃO invente"), then
  // append the skeleton, the cover metadata, and the JSON output contract.
  return [
    PROMPT_CHATGPT,
    skeleton,
    '',
    '--- METADADOS DE CAPA (JSON) ---',
    metaJson,
    '',
    '--- FORMATO DE SAÍDA (OBRIGATÓRIO) ---',
    'Responda APENAS com um objeto JSON válido, sem texto fora dele, sem cercas de código (```), no formato exato:',
    '{"latex": "<arquivo .tex completo e corrigido>", "warnings": ["<lacuna/TODO 1>", "<lacuna 2>"]}',
    'O campo "latex" é o .tex final pronto pra compilar (abntex2). O campo "warnings" lista o que ficou marcado como [VERIFICAR]/TODO (citações sem fonte, dados de referência faltantes, resumo/abstract, metodologia). NÃO invente conteúdo para preencher as lacunas.',
  ].join('\n');
}
