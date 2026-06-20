/**
 * Use-case: FormatThesisUseCase
 * -----------------------------------------------------------------------------
 * Layer: application. Encodes the single product action: turn a skeleton +
 * metadata into a paid, released, compiled ABNT thesis.
 *
 * Depends ONLY on ports (injected). Contains NO vendor code and NO framework
 * (HTTP) code. Adapters are injected at the composition root.
 *
 * Orchestration contract (the seam other agents build on):
 *   skeleton ──▶ LlmFormatter.format  ──▶ finished LaTeX (+warnings)
 *            ──▶ LatexCompiler.compile ──▶ preview PDF (+log)
 *            ──▶ PaymentGateway.createCharge ──▶ charge
 *            ──▶ PaymentGateway.verify ──▶ release ONLY when status === 'paid'
 *
 * Invariants (enforced by df-backend in the body; asserted by df-testing):
 *  1. ORDER: format → compile → charge. Billing happens LAST.
 *  2. NEVER BILL ON FAILURE: if format() or compile() throws, createCharge() is
 *     never called.
 *  3. NO RELEASE BEFORE PAY: `released` is true only when verify(id) === 'paid';
 *     finished LaTeX/PDF must not leave this use-case otherwise.
 *
 * @see ../ports/LlmFormatter.js
 * @see ../ports/LatexCompiler.js
 * @see ../ports/PaymentGateway.js
 * @see ../../../.claude/contexts/backend-core/CONTEXT.md
 */

/**
 * Collaborator ports for the use-case (constructor-injected).
 * @typedef {Object} FormatThesisDeps
 * @property {import('../ports/LlmFormatter.js').LlmFormatter} llmFormatter
 * @property {import('../ports/LatexCompiler.js').LatexCompiler} latexCompiler
 * @property {import('../ports/PaymentGateway.js').PaymentGateway} paymentGateway
 * @property {{ amount: number, currency: string }} pricing  Price config (from env/config; e.g. { amount: 990, currency: 'BRL' }).
 */

/**
 * Request to run a formatting job.
 * @typedef {Object} FormatThesisRequest
 * @property {string} skeleton  Deterministic abnTeX2 `.tex` skeleton.
 * @property {import('../../domain/types.js').ThesisMetadata} metadata
 * @property {string} ref  Order/idempotency reference for this job.
 */

export class FormatThesisUseCase {
  /**
   * @param {FormatThesisDeps} deps  Ports + pricing, injected at the composition root.
   */
  constructor(deps) {
    /** @type {FormatThesisDeps} */
    this.deps = deps;
  }

  /**
   * Run the orchestration: format → compile → charge → (later) release on pay.
   *
   * @param {FormatThesisRequest} request
   * @returns {Promise<import('../../domain/types.js').FormattingJob>}
   *   The job with finished LaTeX, preview PDF and charge info. `released` is
   *   false until payment is verified 'paid'.
   * @throws {Error} on AI or compile failure — and in that case NO charge is created.
   */
  async execute(request) {
    const { skeleton, metadata, ref } = request;
    const { llmFormatter, latexCompiler, paymentGateway, pricing } = this.deps;

    // 1. FORMAT — finished ABNT LaTeX from the deterministic skeleton.
    //    Throws on AI failure; propagated => step 3 (billing) never runs.
    const { latex, warnings } = await llmFormatter.format({ skeleton, metadata });

    // 2. COMPILE — preview PDF from the finished LaTeX (NOT the raw skeleton).
    //    Throws on compile failure; propagated => billing never runs.
    const { pdf } = await latexCompiler.compile({ latex });

    // 3. CHARGE — billing happens LAST, only after format+compile succeed.
    //    Amount/currency come from injected pricing; ref ties charge to this job.
    const charge = await paymentGateway.createCharge({
      amount: pricing.amount,
      currency: pricing.currency,
      ref,
    });

    // 4. PAY GATE — release ONLY when the server-side verify() says 'paid'.
    //    Client-reported / createCharge status is never trusted for release.
    const status = await paymentGateway.verify(charge.id);
    const released = status === 'paid';

    /** @type {import('../../domain/types.js').FormattingJob} */
    return {
      id: ref,
      latex,
      warnings: warnings ?? [],
      pdf,
      chargeId: charge.id,
      status,
      released,
    };
  }
}
