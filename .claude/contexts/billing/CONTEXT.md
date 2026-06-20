# Billing (target — not built yet)

Pay-per-formatting: the user is charged X reais per finished ABNT formatting. Sits behind
a **port** so the payment vendor (Stripe available via MCP, or another) is swappable.
Source: composition root + `PaymentGateway` adapter(s) (to be created via pipeline).

## Language
**`PaymentGateway` (port)**:
The interface a use-case depends on. Contract (proposed): `createCharge({ amount,
currency, ref }) → { id, status, clientSecret? }` + `verify(id) → status`. Vendor-agnostic;
no caller imports a payment SDK. _Avoid_: "Stripe" when the port is meant.

**Adapter**:
Concrete impl wrapping one vendor (`StripeGateway`), wired only at the composition root.
_Avoid_: "the payment integration" (ambiguous port vs impl).

**Charge / entitlement**:
A single paid formatting. The Finished LaTeX + Preview are **released only after** the
charge is authorized/captured. _Avoid_: "subscription" (model is per-formatting unless
grill changes it).

**Price**:
X reais per formatting — value is config/env, not hardcoded in callers. _Avoid_: "the fee"
unqualified.

## Relationships
- A use-case in **Backend Core** depends on **`PaymentGateway`**; the **Adapter** is
  injected at the composition root.
- **Billing** gates **AI Formatting** output delivery to **Frontend** (no pay → no release).
- Charge state is verified server-side (webhook or poll) before release — never trusted
  from the client.

## Decisions (grill 2026-06-20)
- **Provider**: Stripe, behind `PaymentGateway` (Stripe supports cards + Pix in BR; MCP
  available here). One adapter: `StripeGateway`.
- **Charge model**: one-off **per formatting**.
- **Price**: R$ 9,90 = `PRICE_BRL=990` (centavos), currency BRL, stored in env/config.
- **Order**: format + preview first; **capture on download intent**; NEVER bill on AI or
  compile failure. Charge state verified server-side (webhook/poll) before release.

## Flagged ambiguities
- Stripe flow shape (PaymentIntent + manual capture vs Checkout Session) — df-backend
  picks at impl using the Stripe best-practices skill; port stays identical.
- Refund/dispute handling: deferred (out of MVP scope).
