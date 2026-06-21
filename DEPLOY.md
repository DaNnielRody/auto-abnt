# Deploy — production container (VPS)

The production image (`Dockerfile`) is the standing Node HTTP server bundled with
**TeX Live + abntex2 + latexmk** so the server compiles previews itself. It is
**distinct** from the sandbox unit-test image (`Dockerfile.sandbox`).

- Non-root runtime (uid 1001), pinned `node:22.11.0-bookworm-slim` base.
- **No secrets are baked.** All config is read from the host env at runtime by the
  composition root (`src/composition/root.js`). `.env` and `.env.*` are git- and
  docker-ignored.
- Liveness probe: `GET /health` → `200 {"status":"ok"}`. Price probe: `GET /config`.

## Build

```sh
docker build -t auto-abnt:prod .
```

## Run on the VPS

The server selects vendors by env. Production wiring = real Claude (or OpenAI),
real Stripe, real TeX Live compiler:

```sh
docker run -d --name auto-abnt \
  -p 3000:3000 \
  --restart unless-stopped \
  --read-only --tmpfs /tmp \
  --security-opt no-new-privileges:true --cap-drop ALL \
  -e PORT=3000 \
  -e COMPILER=texlive \
  -e LLM_PROVIDER=claude \
  -e ANTHROPIC_API_KEY=sk-ant-...      `# or LLM_PROVIDER=openai + OPENAI_API_KEY=sk-...` \
  -e PAYMENT_PROVIDER=stripe \
  -e STRIPE_API_KEY=sk_live_... \
  -e PRICE_BRL=990                     `# centavos → R$ 9,90` \
  -e APP_BASE_URL=https://auto-abnt.app \
  -e CHECKOUT_SUCCESS_URL='https://auto-abnt.app/?job={CLIENT_REFERENCE_ID}&chargeId={CHECKOUT_SESSION_ID}&paid=1' \
  -e CHECKOUT_CANCEL_URL='https://auto-abnt.app/?canceled=1' \
  auto-abnt:prod
```

### Env reference

| Var | Required | Purpose |
| --- | --- | --- |
| `PORT` | no (3000) | Listen port. |
| `COMPILER` | yes (`texlive`) | Real TeX Live/abntex2 compiler; `fake` skips compilation. |
| `LLM_PROVIDER` | yes | `claude` (default vendor), `openai`, or `fake`. |
| `ANTHROPIC_API_KEY` | if claude | Claude key (never logged, never sent to client). |
| `OPENAI_API_KEY` | if openai | OpenAI key. |
| `PAYMENT_PROVIDER` | yes | `stripe` or `fake`. |
| `STRIPE_API_KEY` | if stripe | Stripe secret key. |
| `PRICE_BRL` | no (990) | Server-authoritative price in centavos. |
| `APP_BASE_URL` | recommended | Base URL for Stripe redirect templates. |
| `CHECKOUT_SUCCESS_URL` / `CHECKOUT_CANCEL_URL` | no | Override the redirect URLs. |

## Integration gate (proves the real compile)

```sh
docker compose -f docker-compose.dark-factory.yml --profile integration up \
  integration --build --abort-on-container-exit --exit-code-from integration
```

Builds the production image, boots the server with `COMPILER=texlive` +
`LLM_PROVIDER=fake` + `PAYMENT_PROVIDER=fake` (no external calls), polls `/health`,
then POSTs `/format` and asserts a non-empty `%PDF` — i.e. **abntex2 really
compiled**. Exit 0 = proven.
```
