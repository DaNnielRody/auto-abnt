/**
 * Shared LlmFormatter adapter core.
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter helper). Collapses the request/parse/error
 * shape that ClaudeFormatter and OpenAiFormatter share, WITHOUT erasing the
 * per-vendor differences each must keep (endpoint, headers, body shape, and the
 * response→text extraction path). Those four stay in the adapters; everything
 * vendor-agnostic (build prompt → POST → non-2xx THROWS → JSON-parse the
 * completion into {latex, warnings}) lives here.
 *
 * Contract honored for every vendor: returns { latex, warnings }; on vendor
 * failure (non-2xx, missing/unparseable completion) it THROWS so the use-case
 * never bills on AI failure. The API key lives only in the vendor headers and is
 * never echoed into a thrown message.
 *
 * @see ./abntPrompt.js
 * @see ./ClaudeFormatter.js
 * @see ./OpenAiFormatter.js
 */
import { buildAbntPrompt } from './abntPrompt.js';

/**
 * Build an LlmFormatter from the vendor-specific bits.
 *
 * @param {object} cfg
 * @param {string} cfg.label                Adapter name, used as the error prefix (e.g. 'ClaudeFormatter').
 * @param {Function} cfg.fetchFn            Injected fetch-like fn (url, init) => Promise<Response-like>.
 * @param {string} cfg.endpoint             Vendor endpoint URL.
 * @param {()=>object} cfg.buildHeaders     Vendor headers (carry the key).
 * @param {(prompt:string)=>object} cfg.buildBody     Vendor request body (vendor message shape).
 * @param {(payload:any)=>(string|undefined)} cfg.extractText  Pull the completion text from the vendor JSON.
 * @returns {{ format: (input:{skeleton:string, metadata?:object}) => Promise<{latex:string, warnings:string[]}> }}
 */
export function createLlmFormatter({ label, fetchFn, endpoint, buildHeaders, buildBody, extractText }) {
  return {
    async format({ skeleton, metadata } = {}) {
      const prompt = buildAbntPrompt({ skeleton, metadata });

      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(buildBody(prompt)),
      });

      if (!res.ok) {
        // Non-2xx => throw so the use-case never bills on AI failure.
        const detail = await safeText(res);
        throw new Error(`${label}: vendor returned ${res.status}${detail ? `: ${detail}` : ''}`);
      }

      const payload = await res.json();
      const text = extractText(payload);
      if (typeof text !== 'string') {
        throw new Error(`${label}: missing completion text in vendor response`);
      }
      return parseCompletion(label, text);
    },
  };
}

/** Parse the model completion as JSON {latex, warnings}; throw on malformed output. */
function parseCompletion(label, text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(`${label}: completion was not valid JSON {latex, warnings}`);
  }
  if (typeof obj?.latex !== 'string') {
    throw new Error(`${label}: completion JSON missing string "latex"`);
  }
  const warnings = Array.isArray(obj.warnings) ? obj.warnings : [];
  return { latex: obj.latex, warnings };
}

/** Best-effort read of an error body for the thrown message (vendor text only, never the key). */
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
