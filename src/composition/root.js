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

// --- Concrete adapters (Slice 1 = fakes; later = real vendors) -----------------
// Wired here and NOWHERE else.
import { FakeLlmFormatter } from '../infrastructure/adapters/FakeLlmFormatter.js';
import { FakeLatexCompiler } from '../infrastructure/adapters/FakeLatexCompiler.js';
import { FakePaymentGateway } from '../infrastructure/adapters/FakePaymentGateway.js';

// Later slices swap fakes for real adapters (this file is the ONLY change site):
//   import { ClaudeFormatter } from '../infrastructure/adapters/ClaudeFormatter.js';
//   import { StripeGateway }   from '../infrastructure/adapters/StripeGateway.js';
//   import { TexLiveCompiler } from '../infrastructure/adapters/TexLiveCompiler.js';

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
 */
export function buildApp(env = (typeof process !== 'undefined' ? process.env : {})) {
  // Price config lives here, not in callers. e.g. PRICE_BRL=990 (centavos).
  const pricing = {
    amount: Number(env.PRICE_BRL ?? 990),
    currency: env.PRICE_CURRENCY ?? 'BRL',
  };

  // Slice 1: fake adapters. FAKE_AUTOPAY=1 makes charges 'paid' on create
  // (handy for demos); default keeps them 'pending' until capturePayment runs.
  const llmFormatter = new FakeLlmFormatter();
  const latexCompiler = new FakeLatexCompiler();
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
