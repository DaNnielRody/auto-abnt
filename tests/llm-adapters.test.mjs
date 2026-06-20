// RED test (Slices #4 ClaudeFormatter + #5 OpenAiFormatter) — real LlmFormatter adapters.
// Plain node + ESM. ZERO network, ZERO vendor SDK. The vendor HTTP API is reached via an
// INJECTED fetch-like fn (Conservador: no new deps, unit-testable). Each test passes a FAKE
// fetch that (a) captures the outgoing call and (b) returns a faked vendor response.
//
// Contract under test (src/application/ports/LlmFormatter.js):
//   format({skeleton, metadata}) -> {latex, warnings}      (MUST THROW on AI failure; never bill)
//
// ASSUMED FACTORY SHAPES (df-backend must MATCH these — proposed here):
//   import { createClaudeFormatter } from '../src/infrastructure/adapters/ClaudeFormatter.js';
//   import { createOpenAiFormatter } from '../src/infrastructure/adapters/OpenAiFormatter.js';
//   createClaudeFormatter({ fetchFn, apiKey, model }) -> { async format({skeleton, metadata}) }
//   createOpenAiFormatter({ fetchFn, apiKey, model }) -> { async format({skeleton, metadata}) }
//   - fetchFn: a fetch-like fn (url, init) => Promise<Response-like>.
//       Response-like = { ok:boolean, status:number, async json()/text() }.
//   - apiKey: secret, read from env at the composition root only.
//   - model:  vendor model id (defaulted inside the adapter if omitted).
//   The adapter sends the ABNT rules (from src/handoff.js) + skeleton + metadata to the vendor,
//   and parses the vendor's text completion as JSON {latex, warnings}.
//
// Vendor-shape differences asserted:
//   Claude = Anthropic Messages API  : POST .../v1/messages, header `x-api-key`,
//            body {model, max_tokens, messages:[{role,content}]}, resp {content:[{type:'text',text}]}
//   OpenAI = Chat Completions API    : POST .../v1/chat/completions, header `Authorization: Bearer`,
//            body {model, messages:[{role,content}]}, resp {choices:[{message:{content}}]}
//
// Run:  node tests/llm-adapters.test.mjs   (and via the gate: node test-all.mjs)

import assert from 'node:assert/strict';
import { createClaudeFormatter } from '../src/infrastructure/adapters/ClaudeFormatter.js';
import { createOpenAiFormatter } from '../src/infrastructure/adapters/OpenAiFormatter.js';
import { PROMPT_CHATGPT } from '../src/handoff.js';

// ---- deterministic fixtures (no Date.now / no random) ------------------------
const SKELETON = '\\documentclass{abntex2}\\begin{document}RASCUNHO ÚNICO 4724\\end{document}';
const METADATA = { titulo: 'A influência da tecnologia', autor: 'Maria Teste', ano: '2026' };
const API_KEY = 'sk-test-DEADBEEF';
const FINISHED = '\\documentclass{abntex2}% FINISHED\\begin{document}OK\\end{document}';
const WARNINGS = ['ano assumido 2026', 'resumo marcado como TODO'];

// An ABNT-rule fragment that MUST survive into the outgoing prompt (proves reuse of handoff.js).
const ABNT_MARKER = 'NBR 6023'; // appears in PROMPT_CHATGPT
// The no-fabrication clause that MUST be present in the prompt (hallucination guard).
const NO_FAB_MARKER = 'NÃO invente'; // appears in PROMPT_CHATGPT

// ---- fake fetch factory: captures the call, returns a canned response --------
function makeFakeFetch(response) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    let parsedBody;
    try { parsedBody = init.body ? JSON.parse(init.body) : undefined; } catch { parsedBody = init.body; }
    calls.push({ url, init, body: parsedBody });
    return response;
  };
  return { fetchFn, calls };
}

// Response-like helpers (mimic the parts of fetch's Response the adapter needs).
const okJson = (obj) => ({ ok: true, status: 200, async json() { return obj; }, async text() { return JSON.stringify(obj); } });
const errJson = (status, obj) => ({ ok: false, status, async json() { return obj; }, async text() { return JSON.stringify(obj); } });

// Vendor success payloads carrying a JSON completion {latex, warnings}.
const completionText = JSON.stringify({ latex: FINISHED, warnings: WARNINGS });
const claudeOk = () => okJson({ content: [{ type: 'text', text: completionText }] });
const openaiOk = () => okJson({ choices: [{ message: { role: 'assistant', content: completionText } }] });

// A serialized view of every outgoing call (body + headers + url) for substring asserts.
function wholeCall(call) {
  return JSON.stringify({ url: call.url, headers: call.init.headers ?? {}, body: call.body ?? call.init.body });
}

// ---- tiny runner ------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// Shared contract assertions, parameterized per adapter.
// =============================================================================
function defineContractTests(label, { create, okResponse, endpointMatch, headerProbe }) {
  // --- request shape: ABNT rules + skeleton + metadata + key + endpoint -------
  test(`${label}: outgoing request carries ABNT rules + skeleton + metadata + key, to vendor endpoint`, async () => {
    const { fetchFn, calls } = makeFakeFetch(okResponse());
    const fmt = create({ fetchFn, apiKey: API_KEY, model: 'test-model' });

    await fmt.format({ skeleton: SKELETON, metadata: METADATA });

    assert.equal(calls.length, 1, 'adapter must call the vendor exactly once');
    const call = calls[0];
    const blob = wholeCall(call);

    // endpoint
    assert.match(call.url, endpointMatch, `must POST to the ${label} endpoint (got ${call.url})`);
    assert.equal((call.init.method || '').toUpperCase(), 'POST', 'must use POST');

    // ABNT rules reused from handoff.js (no duplication) + no-fabrication guard present
    assert.ok(blob.includes(ABNT_MARKER), `prompt must reuse handoff.js ABNT rules (expected "${ABNT_MARKER}")`);
    assert.ok(blob.includes(NO_FAB_MARKER), `prompt must forbid inventing content (expected "${NO_FAB_MARKER}")`);

    // skeleton + a metadata field carried into the request
    assert.ok(blob.includes('RASCUNHO ÚNICO 4724'), 'request must carry the skeleton');
    assert.ok(blob.includes('A influência da tecnologia'), 'request must carry the metadata (titulo)');

    // API key sent via the correct header (vendor-specific probe)
    headerProbe(call);
  });

  // --- success: faked vendor response -> {latex, warnings} --------------------
  test(`${label}: success parses vendor response into {latex, warnings}`, async () => {
    const { fetchFn } = makeFakeFetch(okResponse());
    const fmt = create({ fetchFn, apiKey: API_KEY, model: 'test-model' });

    const out = await fmt.format({ skeleton: SKELETON, metadata: METADATA });

    assert.equal(out.latex, FINISHED, 'latex must be parsed from the vendor completion');
    assert.deepEqual(out.warnings, WARNINGS, 'warnings must be parsed from the vendor completion');
  });

  // --- AI failure: non-2xx => THROW (so the use-case never bills) -------------
  test(`${label}: non-2xx vendor response makes format() THROW (never bill)`, async () => {
    const { fetchFn } = makeFakeFetch(errJson(500, { error: { message: 'vendor exploded' } }));
    const fmt = create({ fetchFn, apiKey: API_KEY, model: 'test-model' });

    await assert.rejects(
      fmt.format({ skeleton: SKELETON, metadata: METADATA }),
      /./,
      'a non-2xx response must reject (throw), never resolve with empty latex',
    );
  });

  // --- AI failure variant: 401 unauthorized also throws -----------------------
  test(`${label}: 401 unauthorized makes format() THROW`, async () => {
    const { fetchFn } = makeFakeFetch(errJson(401, { error: { message: 'bad key' } }));
    const fmt = create({ fetchFn, apiKey: 'wrong', model: 'test-model' });

    await assert.rejects(
      fmt.format({ skeleton: SKELETON, metadata: METADATA }),
      /./,
      '401 must reject so the use-case does not bill',
    );
  });
}

// =============================================================================
// Claude (Anthropic Messages API)
// =============================================================================
defineContractTests('ClaudeFormatter', {
  create: createClaudeFormatter,
  okResponse: claudeOk,
  endpointMatch: /\/v1\/messages\b/,
  headerProbe: (call) => {
    const headers = call.init.headers || {};
    const hasKey = Object.entries(headers).some(
      ([k, v]) => k.toLowerCase() === 'x-api-key' && String(v).includes(API_KEY),
    );
    assert.ok(hasKey, 'Claude must send the api key via the `x-api-key` header');
  },
});

// Claude-specific body shape: messages[] + max_tokens (Anthropic Messages API).
test('ClaudeFormatter: body uses Anthropic Messages shape (messages[] + max_tokens)', async () => {
  const { fetchFn, calls } = makeFakeFetch(claudeOk());
  const fmt = createClaudeFormatter({ fetchFn, apiKey: API_KEY, model: 'test-model' });
  await fmt.format({ skeleton: SKELETON, metadata: METADATA });
  const body = calls[0].body;
  assert.ok(Array.isArray(body.messages) && body.messages.length >= 1, 'Claude body must carry messages[]');
  assert.ok('max_tokens' in body, 'Anthropic Messages API requires max_tokens');
  assert.equal(body.model, 'test-model', 'Claude body must carry the injected model');
});

// =============================================================================
// OpenAI (Chat Completions API)
// =============================================================================
defineContractTests('OpenAiFormatter', {
  create: createOpenAiFormatter,
  okResponse: openaiOk,
  endpointMatch: /\/v1\/chat\/completions\b/,
  headerProbe: (call) => {
    const headers = call.init.headers || {};
    const hasKey = Object.entries(headers).some(
      ([k, v]) => k.toLowerCase() === 'authorization' && String(v).includes(`Bearer ${API_KEY}`),
    );
    assert.ok(hasKey, 'OpenAI must send the api key via the `Authorization: Bearer` header');
  },
});

// OpenAI-specific body shape: messages[] (Chat Completions API).
test('OpenAiFormatter: body uses Chat Completions shape (messages[])', async () => {
  const { fetchFn, calls } = makeFakeFetch(openaiOk());
  const fmt = createOpenAiFormatter({ fetchFn, apiKey: API_KEY, model: 'test-model' });
  await fmt.format({ skeleton: SKELETON, metadata: METADATA });
  const body = calls[0].body;
  assert.ok(Array.isArray(body.messages) && body.messages.length >= 1, 'OpenAI body must carry messages[]');
  assert.equal(body.model, 'test-model', 'OpenAI body must carry the injected model');
});

// Sanity: the handoff prompt actually contains the markers we assert on (guards the test itself).
test('fixture sanity: handoff.js PROMPT_CHATGPT contains the ABNT + no-fabrication markers', () => {
  assert.ok(PROMPT_CHATGPT.includes(ABNT_MARKER), `handoff prompt must contain "${ABNT_MARKER}"`);
  assert.ok(PROMPT_CHATGPT.includes(NO_FAB_MARKER), `handoff prompt must contain "${NO_FAB_MARKER}"`);
});

// ---- run --------------------------------------------------------------------
let pass = 0;
let fail = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    pass += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}
console.log(`\nLLM adapters (Claude + OpenAI): ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
