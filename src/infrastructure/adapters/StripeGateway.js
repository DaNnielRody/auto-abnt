/**
 * Adapter: StripeGateway (real PaymentGateway — Stripe Checkout Sessions)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). The ONLY Stripe-aware code. Implements the
 * PaymentGateway port via an INJECTED fetch-like fn — NO Stripe SDK, NO direct
 * network import in this module (testable, ZERO new deps). The secret key is read
 * from env at the composition root and injected here; never hardcoded, never logged.
 *
 * Flow = Checkout Sessions (HITL decision: Checkout Session over PaymentIntent):
 *   createCharge -> POST https://api.stripe.com/v1/checkout/sessions
 *       headers: Authorization: Bearer <key>, content-type x-www-form-urlencoded
 *       body carries the INJECTED pricing as a single line item + mode=payment
 *       + client_reference_id=<ref> + success_url/cancel_url.
 *       returns { id: session.id, status: 'pending', url: session.url }
 *   verify(id) -> GET https://api.stripe.com/v1/checkout/sessions/:id
 *       payment_status==='paid' -> 'paid'; anything else -> 'pending'.
 *   non-2xx on either call -> THROW (fail closed; never falsely report 'paid').
 *
 * SECURITY: amount/currency that hit Stripe ALWAYS come from the injected pricing
 * config. Any client-supplied amount/currency passed to createCharge is IGNORED
 * (df-quality slice-1 flag): the server price is authoritative.
 *
 * @implements {import('../../application/ports/PaymentGateway.js').PaymentGateway}
 * @see ../../application/ports/PaymentGateway.js
 */

const STRIPE_BASE = 'https://api.stripe.com/v1/checkout/sessions';
const PRODUCT_NAME = 'auto-ABNT formatting';

/**
 * Build a StripeGateway from injected deps.
 *
 * @param {object} deps
 * @param {Function} deps.fetchFn  Injected fetch-like (url, init) => Promise<Response-like>.
 * @param {string} deps.apiKey  Stripe secret key (read from env at the composition root ONLY).
 * @param {{ amount:number, currency:string }} deps.pricing  Authoritative price (smallest unit + ISO 4217).
 * @param {string} [deps.successUrl]  Checkout redirect on success.
 * @param {string} [deps.cancelUrl]  Checkout redirect on cancel.
 * @returns {{ createCharge: (input:{amount?:number,currency?:string,ref:string}) => Promise<{id:string,status:string,url:string}>, verify: (id:string) => Promise<string> }}
 */
export function createStripeGateway({ fetchFn, apiKey, pricing, successUrl, cancelUrl } = {}) {
  if (typeof fetchFn !== 'function') {
    throw new Error('createStripeGateway: fetchFn is required');
  }
  if (!apiKey) {
    throw new Error('createStripeGateway: apiKey is required');
  }
  if (!pricing || typeof pricing.amount !== 'number' || !pricing.currency) {
    throw new Error('createStripeGateway: pricing { amount, currency } is required');
  }

  const success = successUrl || 'https://auto-abnt.app/ok';
  const cancel = cancelUrl || 'https://auto-abnt.app/cancel';

  /** Common headers: Bearer auth + Stripe's form-encoded content type. */
  const headers = () => ({
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/x-www-form-urlencoded',
  });

  /** Non-2xx => throw (fail closed). Never echo the key; only the vendor body. */
  async function ensureOk(res, label) {
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { detail = ''; }
      throw new Error(`StripeGateway: ${label} returned ${res.status}${detail ? `: ${detail}` : ''}`);
    }
  }

  return {
    /**
     * Create a Checkout Session. amount/currency ALWAYS come from injected pricing;
     * any client-supplied amount/currency in `input` is IGNORED (security).
     * @param {{amount?:number,currency?:string,ref:string}} input
     */
    async createCharge({ ref } = {}) {
      if (typeof ref !== 'string' || ref.length === 0) {
        throw new Error('StripeGateway: createCharge requires a ref');
      }

      // Build the nested Stripe form keys from the INJECTED price (never the client's).
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('client_reference_id', ref);
      form.set('success_url', success);
      form.set('cancel_url', cancel);
      form.set('line_items[0][quantity]', '1');
      form.set('line_items[0][price_data][currency]', pricing.currency);
      form.set('line_items[0][price_data][unit_amount]', String(pricing.amount));
      form.set('line_items[0][price_data][product_data][name]', PRODUCT_NAME);

      const res = await fetchFn(STRIPE_BASE, {
        method: 'POST',
        headers: headers(),
        body: form.toString(),
      });
      await ensureOk(res, 'createCharge');

      const session = await res.json();
      return { id: session.id, status: 'pending', url: session.url };
    },

    /**
     * Verify a session server-side. payment_status==='paid' => 'paid'; else 'pending'.
     * @param {string} id  Checkout Session id.
     */
    async verify(id) {
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('StripeGateway: verify requires a session id');
      }
      const url = `${STRIPE_BASE}/${encodeURIComponent(id)}`;
      const res = await fetchFn(url, {
        method: 'GET',
        headers: headers(),
      });
      await ensureOk(res, 'verify');

      const session = await res.json();
      return session.payment_status === 'paid' ? 'paid' : 'pending';
    },
  };
}
