/**
 * Adapter: FakePaymentGateway (Slice 1 stand-in for StripeGateway)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the PaymentGateway port with an
 * in-memory charge store and ZERO vendor SDK. A later slice replaces this with a
 * real Stripe adapter (wired only at the composition root).
 *
 * Pay-gate model: createCharge stores a 'pending' charge keyed by id; verify()
 * returns the stored status — 'pending' until markPaid(id) flips it to 'paid'.
 * This lets the composition root simulate a webhook/poll capturing a payment so
 * the download endpoint can release only after server-side verify === 'paid'.
 * Idempotent on `ref` so a retried createCharge does not double-bill.
 *
 * @implements {import('../../application/ports/PaymentGateway.js').PaymentGateway}
 * @see ../../application/ports/PaymentGateway.js
 */
export class FakePaymentGateway {
  /**
   * @param {Object} [opts]
   * @param {boolean} [opts.autoPay=false]  If true, charges are 'paid' immediately
   *   (handy for the walking-skeleton happy path / tests). Default keeps them
   *   'pending' until markPaid(id) is called.
   */
  constructor({ autoPay = false } = {}) {
    /** @type {Map<string, { id: string, ref: string, amount: number, currency: string, status: string }>} */
    this._charges = new Map();
    /** @type {Map<string, string>} ref -> charge id, for idempotency. */
    this._byRef = new Map();
    this._autoPay = autoPay;
    this._seq = 0;
  }

  /**
   * @param {import('../../application/ports/PaymentGateway.js').CreateChargeInput} input
   * @returns {Promise<import('../../application/ports/PaymentGateway.js').Charge>}
   */
  async createCharge({ amount, currency, ref } = {}) {
    if (typeof ref !== 'string' || ref.length === 0) {
      throw new Error('FakePaymentGateway: createCharge requires a ref');
    }

    // Idempotency: same ref reuses the existing charge (no double-billing on retry).
    const existingId = this._byRef.get(ref);
    if (existingId) {
      const existing = this._charges.get(existingId);
      return { id: existing.id, status: existing.status, clientSecret: `cs_${existing.id}` };
    }

    this._seq += 1;
    const id = `fake_charge_${this._seq}`;
    const status = this._autoPay ? 'paid' : 'pending';
    this._charges.set(id, { id, ref, amount, currency, status });
    this._byRef.set(ref, id);

    return { id, status, clientSecret: `cs_${id}` };
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../../application/ports/PaymentGateway.js').ChargeStatus>}
   */
  async verify(id) {
    const charge = this._charges.get(id);
    if (!charge) {
      throw new Error(`FakePaymentGateway: unknown charge ${id}`);
    }
    return /** @type {any} */ (charge.status);
  }

  /**
   * Test/dev hook simulating a webhook/poll that captures the payment.
   * Flips the stored charge to 'paid' so a later verify() releases the download.
   * @param {string} id
   */
  markPaid(id) {
    const charge = this._charges.get(id);
    if (!charge) {
      throw new Error(`FakePaymentGateway: cannot mark unknown charge ${id} paid`);
    }
    charge.status = 'paid';
  }
}
