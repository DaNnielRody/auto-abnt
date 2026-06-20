// RED test (Slice 1) for FormatThesisUseCase — the seam skeleton→format→compile→pay-gate→pdf.
// Plain node + ESM, zero network, zero vendor SDK. All ports are in-process FAKE adapters
// that record their calls (spy-style) so we assert ORDERING + whether createCharge ran.
// Asserts the use-case CONTRACT (external behavior), never impl details.
//
// Contracts under test (from src/ARCHITECTURE.md + ports):
//   LlmFormatter.format({skeleton,metadata}) -> {latex,warnings}        (throws on AI failure)
//   LatexCompiler.compile({latex,assets?})   -> {pdf,log}               (throws on compile failure)
//   PaymentGateway.createCharge({amount,currency,ref}) -> {id,status,clientSecret?}
//   PaymentGateway.verify(id) -> status        (release ONLY when verify === 'paid')
//   FormatThesisUseCase.execute({skeleton,metadata,ref}) -> FormattingJob
//     invariants: order format->compile->charge | never bill on failure | no release before pay
//
// Run:  node tests/format-thesis-usecase.test.mjs

import assert from 'node:assert/strict';
import { FormatThesisUseCase } from '../src/application/use-cases/FormatThesisUseCase.js';

// ---- shared deterministic fixtures (no Date.now / no random) -----------------
const SKELETON = '\\documentclass{abntex2}\\begin{document}RASCUNHO\\end{document}';
const METADATA = { titulo: 'A influência da tecnologia', autor: 'Maria Teste' };
const REF = 'job-0001';
const PRICING = { amount: 990, currency: 'BRL' };
const FAKE_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

// ---- spy fakes: shared call-log proves ORDER across collaborators ------------
function makeFakes({
  formatThrows = false,
  compileThrows = false,
  verifyStatus = 'paid',
  createStatus = 'pending',
} = {}) {
  const calls = []; // ordered record of every cross-boundary call

  const llmFormatter = {
    async format(input) {
      calls.push({ port: 'llm', method: 'format', input });
      if (formatThrows) throw new Error('AI failure (vendor refusal/timeout)');
      return { latex: '\\documentclass{abntex2}% FINISHED', warnings: ['assumed year 2026'] };
    },
  };

  const latexCompiler = {
    async compile(input) {
      calls.push({ port: 'latex', method: 'compile', input });
      if (compileThrows) throw new Error('compile failure');
      return { pdf: FAKE_PDF, log: 'compiled ok' };
    },
  };

  const paymentGateway = {
    async createCharge(input) {
      calls.push({ port: 'pay', method: 'createCharge', input });
      return { id: 'charge_1', status: createStatus, clientSecret: 'cs_secret' };
    },
    async verify(id) {
      calls.push({ port: 'pay', method: 'verify', input: id });
      return verifyStatus;
    },
  };

  return { calls, deps: { llmFormatter, latexCompiler, paymentGateway, pricing: PRICING } };
}

const names = (calls) => calls.map((c) => `${c.port}.${c.method}`);
const made = (n) => `port "${n}" was called`;

// ---- tiny runner -------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// 1. HAPPY PATH: format -> compile produces a job carrying compiled pdf + latex,
//    and the calls happen in order format THEN compile.
// =============================================================================
test('happy path: job carries finished latex + compiled pdf; order is format then compile', async () => {
  const { calls, deps } = makeFakes();
  const uc = new FormatThesisUseCase(deps);

  const job = await uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF });

  // job carries the finished latex + the compiled pdf bytes (the seam output)
  assert.equal(job.latex, '\\documentclass{abntex2}% FINISHED', 'job carries finished LaTeX');
  assert.deepEqual(job.pdf, FAKE_PDF, 'job carries the compiled PDF bytes');

  // format ran before compile, and format got the skeleton + metadata
  const order = names(calls);
  const iFormat = order.indexOf('llm.format');
  const iCompile = order.indexOf('latex.compile');
  assert.ok(iFormat >= 0, made('llm.format'));
  assert.ok(iCompile >= 0, made('latex.compile'));
  assert.ok(iFormat < iCompile, `format must precede compile (got order: ${order.join(' -> ')})`);

  const fmtInput = calls[iFormat].input;
  assert.equal(fmtInput.skeleton, SKELETON, 'format received the skeleton');
  assert.equal(fmtInput.metadata, METADATA, 'format received the metadata');

  // compile received the FINISHED latex (the LLM output), not the raw skeleton
  assert.equal(calls[iCompile].input.latex, '\\documentclass{abntex2}% FINISHED',
    'compile received the finished LaTeX from the formatter');
});

// =============================================================================
// 2. PAY GATE: the compiled PDF is NOT released until verify(ref) === 'paid'.
// =============================================================================
test('pay gate: NOT released when verify !== paid', async () => {
  const { deps } = makeFakes({ verifyStatus: 'pending' });
  const uc = new FormatThesisUseCase(deps);

  const job = await uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF });

  assert.equal(job.released, false, 'released must be false until payment verifies as paid');
});

test('pay gate: released only when verify === paid', async () => {
  const { calls, deps } = makeFakes({ verifyStatus: 'paid' });
  const uc = new FormatThesisUseCase(deps);

  const job = await uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF });

  assert.equal(job.released, true, 'released must be true once verify() === paid');
  // release decision must come from server-side verify(), not from createCharge status
  assert.ok(names(calls).includes('pay.verify'), 'use-case verifies status server-side before release');
});

// =============================================================================
// 3. NO BILL ON FAILURE: if format() throws, createCharge is never called.
// =============================================================================
test('no bill on AI failure: format throws => createCharge never called', async () => {
  const { calls, deps } = makeFakes({ formatThrows: true });
  const uc = new FormatThesisUseCase(deps);

  await assert.rejects(
    uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF }),
    /AI failure/,
    'AI failure must propagate (use-case must not swallow it)'
  );
  assert.ok(!names(calls).includes('pay.createCharge'),
    'createCharge must NOT run when the LLM fails (never bill on AI failure)');
});

// =============================================================================
//    ...same if compile() throws.
// =============================================================================
test('no bill on compile failure: compile throws => createCharge never called', async () => {
  const { calls, deps } = makeFakes({ compileThrows: true });
  const uc = new FormatThesisUseCase(deps);

  await assert.rejects(
    uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF }),
    /compile failure/,
    'compile failure must propagate'
  );
  assert.ok(!names(calls).includes('pay.createCharge'),
    'createCharge must NOT run when compile fails (never bill on compile failure)');
});

// =============================================================================
// 4. PRICING: createCharge is called with the configured amount/currency + ref.
// =============================================================================
test('pricing: createCharge uses configured amount/currency and the job ref', async () => {
  const { calls, deps } = makeFakes();
  const uc = new FormatThesisUseCase(deps);

  await uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF });

  const charge = calls.find((c) => c.port === 'pay' && c.method === 'createCharge');
  assert.ok(charge, 'createCharge must be called on the happy path');
  assert.equal(charge.input.amount, PRICING.amount, 'amount comes from injected pricing (990)');
  assert.equal(charge.input.currency, PRICING.currency, 'currency comes from injected pricing (BRL)');
  assert.equal(charge.input.ref, REF, 'charge ref ties to the job ref');
});

// =============================================================================
//    bonus contract: full order on happy path is format -> compile -> createCharge.
// =============================================================================
test('order invariant: billing happens LAST (format -> compile -> createCharge)', async () => {
  const { calls, deps } = makeFakes();
  const uc = new FormatThesisUseCase(deps);

  await uc.execute({ skeleton: SKELETON, metadata: METADATA, ref: REF });

  const order = names(calls);
  const iFormat = order.indexOf('llm.format');
  const iCompile = order.indexOf('latex.compile');
  const iCharge = order.indexOf('pay.createCharge');
  assert.ok(iFormat < iCompile && iCompile < iCharge,
    `expected format -> compile -> createCharge, got: ${order.join(' -> ')}`);
});

// ---- run ---------------------------------------------------------------------
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
console.log(`\nFormatThesisUseCase: ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
