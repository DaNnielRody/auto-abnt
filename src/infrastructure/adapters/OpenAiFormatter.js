/**
 * Adapter: OpenAiFormatter (alternative real LlmFormatter — Chat Completions API)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). The ONLY OpenAI-aware code. Mirrors the
 * ClaudeFormatter contract behind the same LlmFormatter port: INJECTED fetch-like
 * fn — NO vendor SDK, NO direct network here. Key read from env at the
 * composition root and injected; never hardcoded, never logged.
 *
 * Contract honored: returns { latex, warnings }; on vendor failure (non-2xx,
 * timeout, refusal, unparseable completion) it THROWS so the use-case never
 * bills on AI failure.
 *
 * Prompt: derived from src/handoff.js via abntPrompt.js (single source of the
 * ABNT rules incl. "NBR 6023" + the "NÃO invente" no-fabrication guard).
 *
 * @implements {import('../../application/ports/LlmFormatter.js').LlmFormatter}
 * @see ./abntPrompt.js
 * @see ../../application/ports/LlmFormatter.js
 */
import { createLlmFormatter } from './llmFormatterCore.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';

/**
 * @param {{ fetchFn: (url:string, init:object)=>Promise<{ok:boolean,status:number,json:()=>Promise<any>,text:()=>Promise<string>}>, apiKey: string, model?: string }} deps
 * @returns {{ format: (input:{skeleton:string, metadata?:object}) => Promise<{latex:string, warnings:string[]}> }}
 */
export function createOpenAiFormatter({ fetchFn, apiKey, model } = {}) {
  if (typeof fetchFn !== 'function') {
    throw new Error('createOpenAiFormatter: fetchFn is required');
  }
  const resolvedModel = model || DEFAULT_MODEL;

  // Vendor-specific: OpenAI Chat Completions API (endpoint, Authorization: Bearer
  // header, {model, messages[]} body, choices[0].message.content response path).
  return createLlmFormatter({
    label: 'OpenAiFormatter',
    fetchFn,
    endpoint: OPENAI_URL,
    buildHeaders: () => ({
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    }),
    buildBody: (prompt) => ({
      model: resolvedModel,
      messages: [{ role: 'user', content: prompt }],
    }),
    extractText: (payload) => payload?.choices?.[0]?.message?.content,
  });
}
