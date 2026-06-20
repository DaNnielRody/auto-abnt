// RED test (Slice #6) — real StripeGateway adapter implementing the PaymentGateway port.
// Plain node + ESM. ZERO network, ZERO vendor SDK, ZERO new deps. The Stripe REST API is
// reached via an INJECTED fetch-like fn (Conservador: same DI pattern as the LLM adapters).
// Each test passes a FAKE fetch that (a) captures the outgoing call and (b) returns a canned
// Stripe response. No key, no network needed.
//
// Contract under test (src/application/ports/PaymentGateway.js):
//   createCharge({amount,currency,ref}) -> {id, status, clientSecret?}
//   verify(id) -> ChargeStatus            (release ONLY when verify === 'paid')
//   both MUST THROW on transport/vendor error (fail closed; never report 'paid' falsely)
//
// SECURITY (df-quality flag carried from slice 1): the amount/currency that hit Stripe MUST
// come from the INJECTED pricing config, NEVER from any client-supplied input. This test
// proves the adapter ignores a hostile client amount and bills the injected price.
//
// ASSUMED FACTORY SHAPE (df-backend MUST MATCH — proposed here):
//   import { createStripeGateway } from '../src/infrastructure/adapters/StripeGateway.js';
//   createStripeGateway({ fetchFn, apiKey, pricing:{amount,currency}, successUrl, cancelUrl })
//       -> { async createCharge({amount?,currency?,ref}), async verify(id) }
//   - fetchFn: fetch-like (url, init) => Promise<Response-like>;
//       Response-like = { ok:boolean, status:number, async json()/text() }.
//   - apiKey: Stripe secret key, read from env at the composition root ONLY.
//   - pricing: { amount:number (smallest unit, e.g. 990), currency:string (e.g. 'brl') }.
//   - successUrl / cancelUrl: Checkout redirect URLs (defaulted inside the adapter if omitted).
//
// STRIPE FLOW = Checkout Sessions (HITL decision: Checkout Session over PaymentIntent):
//   createCharge -> POST https://api.stripe.com/v1/checkout/sessions
//       headers: Authorization: Bearer <key>, content-type application/x-www-form-urlencoded
//       form body carries INJECTED pricing as line_items + mode=payment + client_reference_id=<ref>
//       returns { id: session.id, status:'pending', clientSecret|url: session.url }
//   verify(id) -> GET https://api.stripe.com/v1/checkout/sessions/:id
//       maps payment_status==='paid' -> 'paid'; anything else ('unpaid'/'no_payment_required'/...) -> 'pending'
//   non-2xx (either call) -> THROW (fail closed: nothing released, flow fails).
//
// Run:  node tests/stripe-gateway.test.mjs   (and via the gate: node test-all.mjs)

import assert from 'node:assert/strict';
import { createStripeGateway } from '../src/infrastructure/adapters/StripeGateway.js';
import { FormatThesisUseCase } from '../src/application/use-cases/FormatThesisUseCase.js';

// ---- deterministic fixtures (no Date.now / no random) ------------------------
const API_KEY = 'sk_test_DEADBEEF';
const PRICING = { amount: 990, currency: 'brl' }; // R$9,90, injected price (NOT client-controlled)
const SUCCESS_URL = 'https://auto-abnt.test/ok';
const CANCEL_URL = 'https://auto-abnt.test/cancel';
const REF = 'job-0001';
const SESSION_ID = 'cs_test_a1b2c3';
const SESSION_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3';

// ---- fake fetch factory: captures the call, returns a canned response --------
function makeFakeFetch(response) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init, method: (init.method || 'GET').toUpperCase(), body: init.body });
    return response;
  };
  return { fetchFn, calls };
}

// Response-like helpers (mimic the parts of fetch's Response the adapter needs).
const okJson = (obj) => ({ ok: true, status: 200, async json() { return obj; }, async text() { return JSON.stringify(obj); } });
const errJson = (status, obj) => ({ ok: false, status, async json() { return obj; }, async text() { return JSON.stringify(obj); } });

// Stripe Checkout Session payloads.
const sessionCreated = () => okJson({ id: SESSION_ID, url: SESSION_URL, payment_status: 'unpaid', status: 'open' });
const sessionPaid = () => okJson({ id: SESSION_ID, url: SESSION_URL, payment_status: 'paid', status: 'complete' });
const sessionUnpaid = () => okJson({ id: SESSION_ID, url: SESSION_URL, payment_status: 'unpaid', status: 'open' });

// Parse an x-www-form-urlencoded body string into a flat array of [k,v] pairs.
function formPairs(body) {
  if (body == null) return [];
  const str = typeof body === 'string' ? body : String(body);
  return str.split('&').filter(Boolean).map((kv) => {
    const i = kv.indexOf('=');
    const k = decodeURIComponent(kv.slice(0, i).replace(/\+/g, ' '));
    const v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    return [k, v];
  });
}
const formGet = (body, predicate) => formPairs(body).find(([k]) => predicate(k));
const headerVal = (headers = {}, name) => {
  const hit = Object.entries(headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return hit ? String(hit[1]) : undefined;
};

const makeGateway = (fetchFn, over = {}) =>
  createStripeGateway({ fetchFn, apiKey: API_KEY, pricing: PRICING, successUrl: SUCCESS_URL, cancelUrl: CANCEL_URL, ...over });

// ---- tiny runner ------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// 1. createCharge: POSTs to the Checkout Sessions endpoint, Bearer auth, form-encoded.
// =============================================================================
test('createCharge: POSTs to /v1/checkout/sessions with Bearer auth + form-encoded body', async () => {
  const { fetchFn, calls } = makeFakeFetch(sessionCreated());
  const gw = makeGateway(fetchFn);

  await gw.createCharge({ ref: REF });

  assert.equal(calls.length, 1, 'createCharge must call Stripe exactly once');
  const call = calls[0];
  assert.match(call.url, /\/v1\/checkout\/sessions\b/, `must POST to the checkout/sessions endpoint (got ${call.url})`);
  assert.equal(call.method, 'POST', 'createCharge must use POST');

  const auth = headerVal(call.init.headers, 'authorization');
  assert.equal(auth, `Bearer ${API_KEY}`, 'must send the Stripe key via Authorization: Bearer');

  const ctype = headerVal(call.init.headers, 'content-type') || '';
  assert.match(ctype, /application\/x-www-form-urlencoded/, 'Stripe form API requires x-www-form-urlencoded');
});

// =============================================================================
// 2. createCharge: amount/currency come from INJECTED pricing (security flag).
// =============================================================================
test('createCharge: bills the INJECTED pricing (990/brl), carried in the form body', async () => {
  const { fetchFn, calls } = makeFakeFetch(sessionCreated());
  const gw = makeGateway(fetchFn);

  await gw.createCharge({ ref: REF });

  const body = calls[0].init.body;
  // amount 990 appears as a unit_amount line-item value
  const amountPair = formGet(body, (k) => /unit_amount/.test(k));
  assert.ok(amountPair, 'form body must carry a unit_amount line-item');
  assert.equal(amountPair[1], String(PRICING.amount), 'unit_amount must be the injected amount (990)');
  // currency 'brl' from injected pricing
  const currencyPair = formGet(body, (k) => /currency/.test(k));
  assert.ok(currencyPair, 'form body must carry a currency');
  assert.equal(currencyPair[1].toLowerCase(), PRICING.currency.toLowerCase(), 'currency must be the injected one (brl)');
  // mode=payment for a one-off Checkout Session
  const modePair = formGet(body, (k) => k === 'mode');
  assert.ok(modePair && modePair[1] === 'payment', 'Checkout Session must use mode=payment');
});

// =============================================================================
// 3. SECURITY: a hostile client-supplied amount/currency is IGNORED; injected price wins.
// =============================================================================
test('createCharge: IGNORES client-supplied amount/currency, always bills the injected price', async () => {
  const { fetchFn, calls } = makeFakeFetch(sessionCreated());
  const gw = makeGateway(fetchFn);

  // Attacker tries to pay 1 centavo in usd. The adapter MUST ignore it.
  await gw.createCharge({ ref: REF, amount: 1, currency: 'usd' });

  const body = calls[0].init.body;
  const amountPair = formGet(body, (k) => /unit_amount/.test(k));
  assert.equal(amountPair[1], String(PRICING.amount), 'must bill injected 990, NOT the client-supplied 1');
  const currencyPair = formGet(body, (k) => /currency/.test(k));
  assert.equal(currencyPair[1].toLowerCase(), PRICING.currency.toLowerCase(), 'must use injected brl, NOT client usd');
  assert.ok(!String(body).includes('usd'), 'the hostile client currency must never reach Stripe');
});

// =============================================================================
// 4. createCharge: carries the ref as client_reference_id, returns {id,status,url}.
// =============================================================================
test('createCharge: carries ref (client_reference_id) and returns {id, status:pending, url/clientSecret}', async () => {
  const { fetchFn, calls } = makeFakeFetch(sessionCreated());
  const gw = makeGateway(fetchFn);

  const charge = await gw.createCharge({ ref: REF });

  const refPair = formGet(calls[0].init.body, (k) => k === 'client_reference_id');
  assert.ok(refPair, 'form body must carry client_reference_id');
  assert.equal(refPair[1], REF, 'client_reference_id must be the job ref');

  assert.equal(charge.id, SESSION_ID, 'returned id must be the Stripe session id');
  assert.equal(charge.status, 'pending', 'a freshly created session is pending (not yet paid)');
  const link = charge.url ?? charge.clientSecret;
  assert.equal(link, SESSION_URL, 'returned url/clientSecret must be the Checkout Session url');
});

// =============================================================================
// 5. verify: GETs the session; payment_status 'paid' -> 'paid'.
// =============================================================================
test('verify: GETs the session and maps payment_status=paid -> paid', async () => {
  const { fetchFn, calls } = makeFakeFetch(sessionPaid());
  const gw = makeGateway(fetchFn);

  const status = await gw.verify(SESSION_ID);

  assert.equal(calls.length, 1, 'verify must call Stripe exactly once');
  const call = calls[0];
  assert.equal(call.method, 'GET', 'verify must use GET');
  assert.match(call.url, new RegExp(`/v1/checkout/sessions/${SESSION_ID}\\b`), 'verify must GET the session by id');
  assert.equal(headerVal(call.init.headers, 'authorization'), `Bearer ${API_KEY}`, 'verify must send Bearer auth');
  assert.equal(status, 'paid', 'payment_status=paid must map to ChargeStatus paid');
});

// =============================================================================
// 6. verify: payment_status 'unpaid'/other -> 'pending' (never falsely 'paid').
// =============================================================================
test('verify: payment_status=unpaid maps to pending (never falsely paid)', async () => {
  const { fetchFn } = makeFakeFetch(sessionUnpaid());
  const gw = makeGateway(fetchFn);

  const status = await gw.verify(SESSION_ID);
  assert.equal(status, 'pending', 'unpaid must map to pending so the download stays gated');
});

// =============================================================================
// 7. FAIL CLOSED: a non-2xx Stripe response THROWS (createCharge and verify).
// =============================================================================
test('createCharge: non-2xx Stripe response THROWS (fail closed; nothing created)', async () => {
  const { fetchFn } = makeFakeFetch(errJson(400, { error: { message: 'bad request' } }));
  const gw = makeGateway(fetchFn);

  await assert.rejects(gw.createCharge({ ref: REF }), /./, 'a non-2xx must reject, never silently succeed');
});

test('verify: non-2xx Stripe response THROWS (fail closed; never report paid)', async () => {
  const { fetchFn } = makeFakeFetch(errJson(500, { error: { message: 'stripe down' } }));
  const gw = makeGateway(fetchFn);

  await assert.rejects(gw.verify(SESSION_ID), /./, 'verify must throw on transport/vendor error, never report paid');
});

// =============================================================================
// 8. PAY-GATE INTEGRATION: with the real StripeGateway wired into the use-case,
//    a job is NOT released until verify(id) === 'paid'. Drives the gateway with a
//    stateful fake fetch (create -> session pending; verify -> paid only after capture).
// =============================================================================
function makeStatefulStripeFetch() {
  let paid = false;
  const fetchFn = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    if (method === 'POST' && /\/v1\/checkout\/sessions\b/.test(url) && !/sessions\/cs_/.test(url)) {
      return sessionCreated();
    }
    if (method === 'GET' && /\/v1\/checkout\/sessions\/cs_/.test(url)) {
      return paid ? sessionPaid() : sessionUnpaid();
    }
    return errJson(404, { error: { message: 'unexpected call' } });
  };
  return { fetchFn, capture: () => { paid = true; } };
}

// Minimal stub ports so the use-case can run with only the StripeGateway under test.
const stubLlm = { async format() { return { latex: '\\documentclass{abntex2}% FINISHED', warnings: [] }; } };
const stubLatex = { async compile() { return { pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46]), log: 'ok' }; } };

test('pay-gate: NOT released while session is unpaid (use-case + real StripeGateway)', async () => {
  const { fetchFn } = makeStatefulStripeFetch(); // never captured => stays unpaid
  const paymentGateway = makeGateway(fetchFn);
  const uc = new FormatThesisUseCase({ llmFormatter: stubLlm, latexCompiler: stubLatex, paymentGateway, pricing: PRICING });

  const job = await uc.execute({ skeleton: 'sk', metadata: {}, ref: REF });
  assert.equal(job.released, false, 'must NOT release while Stripe reports the session unpaid');
});

test('pay-gate: released once Stripe reports the session paid', async () => {
  const stripe = makeStatefulStripeFetch();
  const paymentGateway = makeGateway(stripe.fetchFn);

  // Simulate the customer completing Checkout (webhook/poll flips payment_status=paid).
  stripe.capture();

  const uc = new FormatThesisUseCase({ llmFormatter: stubLlm, latexCompiler: stubLatex, paymentGateway, pricing: PRICING });
  const job = await uc.execute({ skeleton: 'sk', metadata: {}, ref: REF });
  assert.equal(job.released, true, 'must release once verify() sees payment_status=paid');
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
console.log(`\nStripeGateway: ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
