// RED test (Slice #9) — the SERVER SEAM of pay-before-download (composition/application
// logic, NOT the DOM). The UI itself is verified by build+manual; here we test the wired
// app surface with in-process FAKE adapters (FakePaymentGateway + fake llm/compiler).
// Plain node + ESM, ZERO network, ZERO vendor SDK, deterministic (no Date.now / random).
//
// WHY this exists: df-design flagged that /checkout must LINK the created chargeId to the
// job so /download can verify it after the Stripe redirect, and that the price must be
// server-authoritative + exposed for the UI (never hardcoded "R$ 9,90"). These are
// composition-level concerns (buildApp's surface), so we assert them with fakes here,
// mirroring tests/format-thesis-usecase.test.mjs + tests/stripe-gateway.test.mjs.
//
// ============================================================================
// ASSUMED COMPOSITION API SHAPE (df-backend MUST MATCH — proposed here):
//   import { buildApp } from '../src/composition/root.js';
//   const app = buildApp(env);   // env selects FAKE gateway by default (keyless, no network)
//
//   app.createJob({ skeleton, metadata, ref })  -> Promise<FormattingJob>
//       Runs FormatThesisUseCase AND RETAINS the job server-side keyed by job.id,
//       holding the preview pdf. (Today the use-case runs but nothing retains it at the
//       composition level — the http handler keeps its own Map. We pull retention into
//       the app surface so checkout/download can resolve a job by id.)
//   app.getJob(id) -> FormattingJob | undefined   (the retained job)
//
//   app.startCheckout(jobId) -> Promise<{ chargeId, checkoutUrl, status }>
//       Calls paymentGateway.createCharge with the SERVER pricing (990 / 'brl') —
//       NEVER a client-supplied amount/currency — LINKS the returned chargeId to the
//       job (getJob(jobId).chargeId === chargeId), returns the checkoutUrl.
//
//   app.releaseDownload(jobId, chargeId) -> Promise<{ released, status, pdf? }>
//       Returns the pdf ONLY when paymentGateway.verify(chargeId) === 'paid'.
//       Unpaid  -> { released:false, status:'pending' (or any non-paid), pdf undefined }.
//       Mismatched/unknown chargeId (≠ the job's linked chargeId) -> rejected:
//         { released:false } and NEVER the pdf (don't trust an arbitrary client id).
//
//   app.pricing -> { amount: 990, currency: 'brl', formatted: 'R$ 9,90' }
//       Server price exposed for the UI so it never hardcodes the value.
// ============================================================================
//
// Run:  node tests/payment-flow.test.mjs   (and via the gate: node test-all.mjs)

import assert from 'node:assert/strict';
import { buildApp } from '../src/composition/root.js';

// ---- deterministic fixtures (no Date.now / no random) ------------------------
const SKELETON = '\\documentclass{abntex2}\\begin{document}RASCUNHO\\end{document}';
const METADATA = { titulo: 'A influência da tecnologia', autor: 'Maria Teste' };
const REF = 'job-0009';

// Env that forces the keyless FAKE gateway + fake llm/compiler (no provider keys),
// and pins the server price so the assertions are deterministic.
const FAKE_ENV = {
  PRICE_BRL: '990',
  // no LLM_PROVIDER / STRIPE_API_KEY / COMPILER => all fakes (no network, no binary).
};

// Build a job retained in the app, ready for checkout. Helper so each test is one behavior.
async function buildJobbedApp(env = FAKE_ENV) {
  const app = buildApp(env);
  const job = await app.createJob({ skeleton: SKELETON, metadata: METADATA, ref: REF });
  return { app, job };
}

// ---- tiny runner ------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// 0. RETENTION: createJob retains the job server-side (keyed by id) with its pdf.
//    (Pre-req for checkout/download to resolve a job by id after the Stripe redirect.)
// =============================================================================
test('createJob retains the job server-side keyed by id, holding the preview pdf', async () => {
  const { app, job } = await buildJobbedApp();

  assert.equal(job.id, REF, 'createJob returns the job keyed by its ref/id');
  const stored = app.getJob(REF);
  assert.ok(stored, 'job must be retained server-side (getJob resolves it by id)');
  assert.ok(stored.pdf && stored.pdf.length > 0, 'retained job holds the preview pdf bytes');
});

// =============================================================================
// 1. startCheckout: uses SERVER pricing (990 / brl), links chargeId to job, returns url.
// =============================================================================
test('startCheckout uses server pricing (990/brl), links chargeId to the job, returns checkoutUrl', async () => {
  const { app } = await buildJobbedApp();

  const out = await app.startCheckout(REF);

  assert.ok(out && out.chargeId, 'startCheckout returns a chargeId');
  // checkoutUrl is what the UI redirects to (Stripe hosted page). Fake may stand in a url,
  // but the field MUST be present in the contract so the http layer can pass it through.
  assert.ok('checkoutUrl' in out, 'startCheckout returns a checkoutUrl field (redirect target)');

  // The created charge must carry the SERVER price — assert via the gateway's stored charge.
  // (FakePaymentGateway stores {amount,currency} on createCharge.)
  const stored = app.paymentGateway._charges.get(out.chargeId);
  assert.ok(stored, 'the charge must be created on the gateway');
  assert.equal(stored.amount, 990, 'charge amount must be the SERVER price (990), not a client value');
  assert.equal(String(stored.currency).toLowerCase(), 'brl', "charge currency must be the SERVER currency ('brl')");

  // The chargeId must be LINKED to the job so /download can verify it after redirect.
  const job = app.getJob(REF);
  assert.equal(job.chargeId, out.chargeId, 'the job must be linked to the created chargeId');
});

// =============================================================================
// 2. SECURITY: startCheckout IGNORES any client-supplied amount/currency.
// =============================================================================
test('startCheckout ignores a client-supplied amount/currency (server price wins)', async () => {
  const { app } = await buildJobbedApp();

  // Hostile client tries to pay 1 centavo in usd. The server price MUST win.
  const out = await app.startCheckout(REF, { amount: 1, currency: 'usd' });

  const stored = app.paymentGateway._charges.get(out.chargeId);
  assert.equal(stored.amount, 990, 'must bill the server 990, NOT the client-supplied 1');
  assert.equal(String(stored.currency).toLowerCase(), 'brl', 'must use server brl, NOT client usd');
});

// =============================================================================
// 3. releaseDownload UNPAID: no pdf, signals not-paid (so http can answer 402).
// =============================================================================
test('releaseDownload while unpaid does NOT release the pdf and signals not-paid', async () => {
  const { app } = await buildJobbedApp();
  const { chargeId } = await app.startCheckout(REF); // pending (FakePaymentGateway, no autopay)

  const result = await app.releaseDownload(REF, chargeId);

  assert.equal(result.released, false, 'must NOT release while the charge is unpaid');
  assert.equal(result.pdf, undefined, 'the pdf must NEVER leave the seam while unpaid');
  assert.notEqual(result.status, 'paid', 'status must signal not-paid so the http layer can answer 402');
});

// =============================================================================
// 4. releaseDownload PAID: returns the pdf once the charge verifies as paid.
// =============================================================================
test('releaseDownload once paid returns the pdf', async () => {
  const { app, job } = await buildJobbedApp();
  const { chargeId } = await app.startCheckout(REF);

  // Simulate the customer completing Checkout (webhook/poll flips the charge to paid).
  // FakePaymentGateway exposes markPaid(id); drive paid deterministically through it.
  app.paymentGateway.markPaid(chargeId);

  const result = await app.releaseDownload(REF, chargeId);

  assert.equal(result.released, true, 'must release once verify(chargeId) === paid');
  assert.deepEqual(result.pdf, job.pdf, 'released pdf must be the retained preview pdf bytes');
});

// =============================================================================
// 5. releaseDownload MISMATCH: a chargeId that is NOT the job's linked one is rejected,
//    even if that charge happens to be paid. Never trust an arbitrary client-supplied id.
// =============================================================================
test('releaseDownload rejects a chargeId not linked to the job (no pdf), even if that charge is paid', async () => {
  const { app } = await buildJobbedApp();
  await app.startCheckout(REF); // links the REAL chargeId to the job

  // Forge a separate paid charge under a different ref — it must NOT unlock this job.
  const forged = await app.paymentGateway.createCharge({ amount: 990, currency: 'brl', ref: 'attacker-ref' });
  app.paymentGateway.markPaid(forged.id);

  const result = await app.releaseDownload(REF, forged.id);

  assert.equal(result.released, false, 'a chargeId not linked to the job must NOT release it');
  assert.equal(result.pdf, undefined, 'the pdf must NEVER be returned for a mismatched chargeId');
});

test('releaseDownload rejects an unknown chargeId (no pdf)', async () => {
  const { app } = await buildJobbedApp();
  await app.startCheckout(REF);

  const result = await app.releaseDownload(REF, 'totally_made_up_charge_id');

  assert.equal(result.released, false, 'an unknown chargeId must NOT release the job');
  assert.equal(result.pdf, undefined, 'the pdf must NEVER be returned for an unknown chargeId');
});

// =============================================================================
// 6. PRICING/CONFIG: the server price is exposed for the UI (990 / brl + formatted).
//    So the UI never hardcodes "R$ 9,90" as the source of truth.
// =============================================================================
test('app.pricing exposes the server price (990 / brl) + a formatted string for the UI', async () => {
  const app = buildApp(FAKE_ENV);

  assert.ok(app.pricing, 'app must expose a pricing/config value for the UI');
  assert.equal(app.pricing.amount, 990, 'pricing.amount must be the server price in centavos (990)');
  assert.equal(String(app.pricing.currency).toLowerCase(), 'brl', "pricing.currency must be 'brl'");
  assert.equal(typeof app.pricing.formatted, 'string', 'pricing.formatted must be a string for direct UI render');
  assert.match(app.pricing.formatted, /9,90/, 'formatted price must read R$ 9,90 (data, not hardcoded copy)');
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
console.log(`\npayment-flow: ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
