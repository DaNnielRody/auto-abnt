/**
 * Composition Root
 * -----------------------------------------------------------------------------
 * Layer: composition. THE SINGLE wiring point.
 *
 * This is the ONLY file allowed to import concrete adapters / vendor SDKs and
 * inject them into use-cases. Use-cases and ports never know which adapter runs.
 * Swapping a vendor (Claude↔OpenAI, Stripe↔other, TeX Live↔Tectonic) edits this
 * file + the adapter only — never a port, never a use-case, never the HTTP boundary.
 *
 * Slice 1 (walking skeleton): wires FAKE adapters so the seam proves end-to-end
 * with no real vendor. df-backend implements the fakes under
 * src/infrastructure/adapters and uncomments the wiring below.
 *
 * @see ../ARCHITECTURE.md
 */

import { FormatThesisUseCase } from '../application/use-cases/FormatThesisUseCase.js';

// --- Concrete adapters -----------------
// Wired here and NOWHERE else. Vendor selection is by env (see selectLlmFormatter).
import { FakeLlmFormatter } from '../infrastructure/adapters/FakeLlmFormatter.js';
import { FakeLatexCompiler } from '../infrastructure/adapters/FakeLatexCompiler.js';
import { FakePaymentGateway } from '../infrastructure/adapters/FakePaymentGateway.js';
import { createClaudeFormatter } from '../infrastructure/adapters/ClaudeFormatter.js';
import { createOpenAiFormatter } from '../infrastructure/adapters/OpenAiFormatter.js';
import { createTexLiveCompiler, createLatexmkRunner } from '../infrastructure/adapters/TexLiveCompiler.js';

// Later slices swap the remaining fakes for real adapters (this file is the ONLY change site):
//   import { StripeGateway }   from '../infrastructure/adapters/StripeGateway.js';

/**
 * @typedef {Object} App
 * @property {FormatThesisUseCase} formatThesis  The wired central use-case.
 * @property {import('../application/ports/PaymentGateway.js').PaymentGateway} paymentGateway
 *   The wired gateway (exposed so the HTTP boundary can verify/capture charges).
 * @property {(charge:{id:string}) => Promise<void>} capturePayment
 *   Slice-1 helper simulating a webhook/poll that captures a charge as paid.
 * @property {(job:{chargeId:string, pdf?:Uint8Array}) => Promise<{released:boolean, pdf?:Uint8Array, status:string}>} releaseDownload
 *   Gate: returns the PDF ONLY when server-side verify(chargeId) === 'paid'.
 */

/**
 * Build the application by instantiating adapters and injecting them into use-cases.
 * Reads config/env (price, vendor selection, secrets) — the only place that does.
 *
 * @param {Object} [env]  Process env / config (price, keys, vendor flags). Defaults to process.env.
 * @returns {App} The wired application surface.
 *
 * LlmFormatter selection (env, see selectLlmFormatter):
 *   LLM_PROVIDER=claude  + ANTHROPIC_API_KEY → real ClaudeFormatter (default vendor)
 *   LLM_PROVIDER=openai  + OPENAI_API_KEY    → real OpenAiFormatter (alternative)
 *   LLM_PROVIDER=fake | (no key present)     → FakeLlmFormatter (sandbox/local default; NO network)
 * Optional model overrides: LLM_MODEL (or CLAUDE_MODEL / OPENAI_MODEL).
 * Keys are read here only and injected into the adapter; never hardcoded, never logged.
 *
 * LatexCompiler selection (env, see selectLatexCompiler):
 *   COMPILER=texlive → real TexLiveCompiler (TeX Live + abntex2 via latexmk runner)
 *   COMPILER=fake | (unset) → FakeLatexCompiler (sandbox/local default; NO binary)
 */
export function buildApp(env = (typeof process !== 'undefined' ? process.env : {})) {
  // Price config lives here, not in callers. e.g. PRICE_BRL=990 (centavos).
  const pricing = {
    amount: Number(env.PRICE_BRL ?? 990),
    currency: env.PRICE_CURRENCY ?? 'BRL',
  };

  // LlmFormatter chosen by env; fake by default so the sandbox/local gate stays
  // green WITHOUT keys (no real vendor call). Other adapters stay fake for now.
  const llmFormatter = selectLlmFormatter(env);
  const latexCompiler = selectLatexCompiler(env);
  const paymentGateway = new FakePaymentGateway({
    autoPay: env.FAKE_AUTOPAY === '1' || env.FAKE_AUTOPAY === 'true',
  });

  const formatThesis = new FormatThesisUseCase({
    llmFormatter,
    latexCompiler,
    paymentGateway,
    pricing,
  });

  /** Simulate a payment webhook/poll capturing the charge (Slice 1 only). */
  async function capturePayment(charge) {
    if (typeof paymentGateway.markPaid === 'function') {
      paymentGateway.markPaid(charge.id);
    }
  }

  /** Download gate: release the PDF ONLY when verify(chargeId) === 'paid'. */
  async function releaseDownload(job) {
    const status = await paymentGateway.verify(job.chargeId);
    if (status !== 'paid') {
      return { released: false, status };
    }
    return { released: true, status, pdf: job.pdf };
  }

  return { formatThesis, paymentGateway, capturePayment, releaseDownload };
}

/**
 * Pick the LlmFormatter adapter from env. The ONLY place that reads vendor keys.
 *
 * Default is FAKE when no usable provider+key is present, so the sandbox/local
 * test gate is green without secrets and never makes a real call. `claude` is the
 * default real vendor; `openai` is the alternative. The global `fetch` is injected
 * as fetchFn into real adapters (the adapters themselves do no network/SDK import).
 *
 * @param {Object} env
 * @returns {import('../application/ports/LlmFormatter.js').LlmFormatter}
 */
function selectLlmFormatter(env) {
  const provider = String(env.LLM_PROVIDER ?? '').toLowerCase();
  const fetchFn = typeof fetch !== 'undefined' ? fetch : undefined;

  if (provider === 'claude' && env.ANTHROPIC_API_KEY) {
    return createClaudeFormatter({
      fetchFn,
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL || env.CLAUDE_MODEL,
    });
  }
  if (provider === 'openai' && env.OPENAI_API_KEY) {
    return createOpenAiFormatter({
      fetchFn,
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL || env.OPENAI_MODEL,
    });
  }
  // No provider selected / no key present / LLM_PROVIDER=fake → fake (no network).
  return new FakeLlmFormatter();
}

/**
 * Pick the LatexCompiler adapter from env. The ONLY place that selects the engine.
 *
 * Default is FAKE so the keyless/binaryless sandbox + local gate stay green WITHOUT
 * a TeX toolchain. COMPILER=texlive selects the real TeX Live + abntex2 path, which
 * shells out via the default latexmk runner (only available where TeX Live is
 * installed — the VPS container; verified-in-CI deferred to slice #10).
 *
 * @param {Object} env
 * @returns {import('../application/ports/LatexCompiler.js').LatexCompiler}
 */
function selectLatexCompiler(env) {
  const compiler = String(env.COMPILER ?? '').toLowerCase();
  if (compiler === 'texlive') {
    return createTexLiveCompiler({ run: createLatexmkRunner() });
  }
  // Unset / COMPILER=fake → fake (no external process).
  return new FakeLatexCompiler();
}
