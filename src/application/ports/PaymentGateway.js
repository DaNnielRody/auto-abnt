/**
 * Port: PaymentGateway
 * -----------------------------------------------------------------------------
 * Layer: application (port). Vendor-AGNOSTIC contract.
 *
 * Pay-per-formatting billing seam. Concrete adapter (e.g. StripeGateway) wraps the
 * payment vendor SDK and lives in src/infrastructure/adapters, wired ONLY at the
 * composition root.
 *
 * RULE: no caller imports a payment SDK; no caller trusts client-reported status.
 * Charge state is verified server-side via {@link PaymentGateway#verify} before
 * any finished LaTeX / PDF is released. Swapping vendor edits an adapter, never
 * this port nor any use-case.
 *
 * @see ../../../.claude/contexts/billing/CONTEXT.md
 */

/**
 * Lifecycle of a charge. Release is permitted only on `'paid'`.
 * @typedef {('requires_action'|'pending'|'paid'|'failed'|'canceled')} ChargeStatus
 */

/**
 * Input to {@link PaymentGateway#createCharge}.
 * @typedef {Object} CreateChargeInput
 * @property {number} amount  Smallest currency unit (e.g. centavos). Price comes from config/env.
 * @property {string} currency  ISO 4217 (e.g. "BRL").
 * @property {string} ref  Idempotency / order reference tying the charge to one formatting job.
 */

/**
 * Output of {@link PaymentGateway#createCharge}.
 * @typedef {Object} Charge
 * @property {string} id  Vendor-agnostic charge identifier (used later by verify()).
 * @property {ChargeStatus} status  Current status right after creation.
 * @property {string} [clientSecret]  Optional secret the frontend needs to confirm the charge.
 */

/**
 * @interface PaymentGateway
 *
 * Contract:
 * - `createCharge` is called only AFTER format+compile succeed (never bill on failure).
 * - `verify` is the single source of truth for release: the use-case releases the
 *   finished LaTeX/PDF only when verify(id) === 'paid'. Client-reported status is
 *   never trusted.
 * - Both methods MUST throw on transport/vendor error (do not silently report 'paid').
 */

/**
 * Create a charge for one formatting.
 * @function
 * @name PaymentGateway#createCharge
 * @param {CreateChargeInput} input
 * @returns {Promise<Charge>}
 * @throws {Error} on vendor/transport error.
 */

/**
 * Verify the authoritative server-side status of a charge.
 * @function
 * @name PaymentGateway#verify
 * @param {string} id  Charge id returned by createCharge.
 * @returns {Promise<ChargeStatus>}
 * @throws {Error} on vendor/transport error.
 */

export {}; // contract-only module (JSDoc typedefs); no runtime export.
