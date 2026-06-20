/**
 * Adapter: ClaudeFormatter (DEFAULT real LlmFormatter — Anthropic Messages API)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). The ONLY Claude-aware code. Implements the
 * LlmFormatter port via an INJECTED fetch-like fn — NO vendor SDK, NO direct
 * network in this module (testable, zero new deps). The API key is read from
 * env at the composition root and injected here; never hardcoded, never logged.
 *
 * Contract honored: returns { latex, warnings }; on vendor failure (non-2xx,
 * timeout, refusal, unparseable completion) it THROWS so the use-case never
 * bills on AI failure (default lean).
 *
 * Prompt: derived from src/handoff.js via abntPrompt.js (single source of the
 * ABNT rules incl. "NBR 6023" + the "NÃO invente" no-fabrication guard).
 *
 * @implements {import('../../application/ports/LlmFormatter.js').LlmFormatter}
 * @see ./abntPrompt.js
 * @see ../../application/ports/LlmFormatter.js
 */
import { createLlmFormatter } from './llmFormatterCore.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 64000;

/**
 * @param {{ fetchFn: (url:string, init:object)=>Promise<{ok:boolean,status:number,json:()=>Promise<any>,text:()=>Promise<string>}>, apiKey: string, model?: string }} deps
 * @returns {{ format: (input:{skeleton:string, metadata?:object}) => Promise<{latex:string, warnings:string[]}> }}
 */
export function createClaudeFormatter({ fetchFn, apiKey, model } = {}) {
  if (typeof fetchFn !== 'function') {
    throw new Error('createClaudeFormatter: fetchFn is required');
  }
  const resolvedModel = model || DEFAULT_MODEL;

  // Vendor-specific: Anthropic Messages API (endpoint, x-api-key header,
  // {model, max_tokens, messages[]} body, content[0].text response path).
  return createLlmFormatter({
    label: 'ClaudeFormatter',
    fetchFn,
    endpoint: ANTHROPIC_URL,
    buildHeaders: () => ({
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    }),
    buildBody: (prompt) => ({
      model: resolvedModel,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
    extractText: (payload) => payload?.content?.[0]?.text,
  });
}
