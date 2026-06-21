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
import { createStripeGateway } from '../infrastructure/adapters/StripeGateway.js';

/**
 * @typedef {Object} App
 * @property {FormatThesisUseCase} formatThesis  The wired central use-case.
 * @property {import('../application/ports/PaymentGateway.js').PaymentGateway} paymentGateway
 *   The wired gateway (exposed so the HTTP boundary can verify/capture charges).
 * @property {(charge:{id:string}) => Promise<void>} capturePayment
 *   Slice-1 helper simulating a webhook/poll that captures a charge as paid.
 * @property {{amount:number, currency:string, formatted:string}} pricing
 *   Server-authoritative price exposed for the UI (data, never hardcoded copy).
 * @property {(request:object) => Promise<import('../domain/types.js').FormattingJob>} createJob
 *   Runs FormatThesisUseCase AND retains the job server-side keyed by job.id.
 * @property {(id:string) => (import('../domain/types.js').FormattingJob|undefined)} getJob
 *   The retained job, or undefined.
 * @property {(jobId:string) => Promise<{chargeId:string, checkoutUrl:(string|null), status:string}>} startCheckout
 *   Creates a charge at the SERVER price and links its id to the job.
 * @property {(jobId:string, chargeId:string) => Promise<{released:boolean, status:string, pdf?:Uint8Array}>} releaseDownload
 *   Gate: returns the PDF ONLY when chargeId is the job's linked one AND verify === 'paid'.
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
 *
 * PaymentGateway selection (env, see selectPaymentGateway):
 *   PAYMENT_PROVIDER=stripe + STRIPE_API_KEY → real StripeGateway (Checkout Sessions;
 *     injected fetch, NO Stripe SDK). Price from PRICE_BRL (centavos, BRL); redirect
 *     URLs from CHECKOUT_SUCCESS_URL / CHECKOUT_CANCEL_URL.
 *   PAYMENT_PROVIDER=fake | (no key present) → FakePaymentGateway (keyless sandbox/local
 *     default; NO network). FAKE_AUTOPAY=1 marks charges paid immediately.
 * Keys are read here only and injected into the adapter; never hardcoded, never logged.
 */
export function buildApp(env = (typeof process !== 'undefined' ? process.env : {})) {
  // Price config lives here, not in callers. e.g. PRICE_BRL=990 (centavos).
  // Server-AUTHORITATIVE: amount/currency exposed to the UI + sent to the gateway
  // come from here, NEVER from the client. `formatted` is derived from amount so
  // the UI renders the price as data (never hardcodes "R$ 9,90").
  const amount = Number(env.PRICE_BRL ?? 990);
  const pricing = {
    amount,
    currency: 'brl',
    formatted: formatBrl(amount),
  };

  // In-memory job store keyed by job.id. Holds the preview pdf + ref + linked
  // chargeId so /checkout and /download can resolve a job after the Stripe
  // redirect. NOTE: not durable — a later slice persists this (see ARCHITECTURE).
  /** @type {Map<string, import('../domain/types.js').FormattingJob>} */
  const jobStore = new Map();

  // LlmFormatter chosen by env; fake by default so the sandbox/local gate stays
  // green WITHOUT keys (no real vendor call). Other adapters stay fake for now.
  const llmFormatter = selectLlmFormatter(env);
  const latexCompiler = selectLatexCompiler(env);
  const paymentGateway = selectPaymentGateway(env, pricing);

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

  /**
   * Run the formatting use-case AND retain the resulting job server-side keyed by
   * its id (holding the preview pdf + ref), so /checkout and /download can resolve
   * it by id after the Stripe redirect.
   * @param {import('../application/use-cases/FormatThesisUseCase.js').FormatThesisRequest} request
   * @returns {Promise<import('../domain/types.js').FormattingJob>}
   */
  async function createJob(request) {
    const job = await formatThesis.execute(request);
    jobStore.set(job.id, job);
    return job;
  }

  /** @param {string} id @returns {import('../domain/types.js').FormattingJob | undefined} */
  function getJob(id) {
    return jobStore.get(id);
  }

  /**
   * Start checkout for a retained job. Bills the SERVER price (pricing.amount /
   * pricing.currency) — any client-supplied amount/currency is IGNORED. Links the
   * created chargeId onto the job so /download can verify it after redirect.
   * @param {string} jobId
   * @returns {Promise<{ chargeId:string, checkoutUrl:(string|null), status:string }>}
   */
  async function startCheckout(jobId /* , clientInput ignored */) {
    const job = jobStore.get(jobId);
    if (!job) {
      throw new Error(`startCheckout: unknown job ${jobId}`);
    }
    // SERVER pricing only. Distinct ref (`:checkout`) so this charge is fully
    // owned by checkout (not the use-case's pre-charge) and idempotent on retry.
    const charge = await paymentGateway.createCharge({
      amount: pricing.amount,
      currency: pricing.currency,
      ref: `${jobId}:checkout`,
    });
    job.chargeId = charge.id;
    return {
      chargeId: charge.id,
      checkoutUrl: charge.url ?? null,
      status: charge.status,
    };
  }

  /**
   * Download gate. Releases the preview pdf ONLY when the chargeId is the one
   * LINKED to the job AND verify(chargeId) === 'paid'. Fails closed: a mismatched
   * or unknown chargeId, or an unknown job, NEVER releases the pdf.
   * @param {string} jobId
   * @param {string} chargeId
   * @returns {Promise<{ released:boolean, status:string, pdf?:Uint8Array }>}
   */
  async function releaseDownload(jobId, chargeId) {
    const job = jobStore.get(jobId);
    // Unknown job, or a chargeId not linked to this job → reject (no pdf).
    if (!job || !job.chargeId || chargeId !== job.chargeId) {
      return { released: false, status: 'rejected' };
    }
    let status;
    try {
      status = await paymentGateway.verify(chargeId);
    } catch {
      // Unknown charge on the gateway → fail closed (never falsely release).
      return { released: false, status: 'rejected' };
    }
    if (status !== 'paid') {
      return { released: false, status };
    }
    return { released: true, status, pdf: job.pdf };
  }

  return {
    formatThesis,
    paymentGateway,
    pricing,
    capturePayment,
    createJob,
    getJob,
    startCheckout,
    releaseDownload,
  };
}

/**
 * Format a centavos amount as a BRL string, e.g. 990 → 'R$ 9,90'.
 * Simple/correct: integer reais + two-digit centavos with a comma separator.
 * @param {number} centavos
 * @returns {string}
 */
function formatBrl(centavos) {
  const cents = Math.round(Number(centavos) || 0);
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `R$ ${reais},${rest}`;
}

/**
 * Normalize an env provider flag to a lowercase string ('' when unset).
 * Shared by the three env selectors; pure, no behavior change.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeProvider(value) {
  return String(value ?? '').toLowerCase();
}

/**
 * The global `fetch` injected into real adapters, or undefined where absent.
 * Adapters import no network themselves; the seam injects it here.
 * @returns {typeof fetch | undefined}
 */
function resolveFetch() {
  return typeof fetch !== 'undefined' ? fetch : undefined;
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
  const provider = normalizeProvider(env.LLM_PROVIDER);
  const fetchFn = resolveFetch();

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
  const compiler = normalizeProvider(env.COMPILER);
  if (compiler === 'texlive') {
    return createTexLiveCompiler({ run: createLatexmkRunner() });
  }
  // Unset / COMPILER=fake → fake (no external process).
  return new FakeLatexCompiler();
}

/**
 * Pick the PaymentGateway adapter from env. The ONLY place that reads the Stripe key.
 *
 * Default is FAKE (keyless) so the sandbox/local gate stays green WITHOUT a real key
 * and never hits Stripe. PAYMENT_PROVIDER=stripe + STRIPE_API_KEY selects the real
 * Checkout-Sessions adapter; the global `fetch` is injected as fetchFn (the adapter
 * imports no SDK and does no direct network). The price is server-authoritative
 * (PRICE_BRL centavos, brl) — client-supplied amount/currency is ignored by the adapter.
 *
 * @param {Object} env
 * @param {{ amount:number, currency:string }} pricing  Price config from buildApp (env-derived).
 * @returns {import('../application/ports/PaymentGateway.js').PaymentGateway}
 */
function selectPaymentGateway(env, pricing) {
  const provider = normalizeProvider(env.PAYMENT_PROVIDER);
  const fetchFn = resolveFetch();

  if (provider === 'stripe' && env.STRIPE_API_KEY) {
    // Redirect URLs carry our job id + chargeId so the SPA returns to the right
    // job and can call GET /download/:job?chargeId=... after Checkout. The job id
    // is the Checkout client_reference_id (set by the gateway from ref); the
    // chargeId is the Checkout Session id, expanded by Stripe via the template
    // {CHECKOUT_SESSION_ID}. Default shape (override via CHECKOUT_*_URL):
    //   success: ${BASE}/?job=<id>&chargeId=<sessionId>&paid=1
    //   cancel:  ${BASE}/?canceled=1
    const base = env.APP_BASE_URL ?? 'https://auto-abnt.app';
    const successUrl =
      env.CHECKOUT_SUCCESS_URL ??
      `${base}/?job={CLIENT_REFERENCE_ID}&chargeId={CHECKOUT_SESSION_ID}&paid=1`;
    const cancelUrl = env.CHECKOUT_CANCEL_URL ?? `${base}/?canceled=1`;
    return createStripeGateway({
      fetchFn,
      apiKey: env.STRIPE_API_KEY,
      pricing: { amount: Number(env.PRICE_BRL ?? pricing.amount ?? 990), currency: 'brl' },
      successUrl,
      cancelUrl,
    });
  }
  // No provider / no key / PAYMENT_PROVIDER=fake → fake (keyless, no network).
  return new FakePaymentGateway({
    autoPay: env.FAKE_AUTOPAY === '1' || env.FAKE_AUTOPAY === 'true',
  });
}
