# Production image — standing Node server + TeX Live/abntex2 for the VPS.
# Distinct from Dockerfile.sandbox (the disposable unit-test gate). Multi-stage,
# pinned slim base (never :latest), NON-ROOT runtime (uid 1001). Secrets are NEVER
# baked: all config (PORT, LLM + Stripe keys, PRICE_BRL, COMPILER) arrives via env
# at runtime. CMD boots buildApp(process.env) behind the HTTP boundary.

# ---- deps: install ONLY runtime node_modules (no dev deps, no TeX yet) --------
FROM node:22.11.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: Node 22 + TeX Live (abntex2 + latexmk + pt-BR) -----------------
FROM node:22.11.0-bookworm-slim AS runtime
WORKDIR /app

# TeX Live package set that makes a REAL abntex2 compile succeed:
#   texlive-latex-recommended  — core LaTeX
#   texlive-latex-extra        — common extras pulled by abntex2
#   texlive-publishers         — provides the abntex2 document class
#   texlive-lang-portuguese    — babel brazil + pt-BR hyphenation
#   texlive-fonts-recommended  — lmodern / Times-like fonts used by montarTex
#   latexmk                    — the runner the TexLiveCompiler shells out to
# DEBIAN_FRONTEND keeps apt non-interactive; clean lists to keep the layer slim.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      texlive-latex-recommended \
      texlive-latex-extra \
      texlive-publishers \
      texlive-lang-portuguese \
      texlive-fonts-recommended \
      latexmk \
 && rm -rf /var/lib/apt/lists/*

# Non-root runtime user (uid/gid 1001) — same convention as the sandbox image.
RUN groupadd --gid 1001 app \
 && useradd --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin app

# Runtime deps from the deps stage, then the app source. No secrets, no .env.
COPY --chown=app:app --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package.json package-lock.json ./
COPY --chown=app:app bin ./bin
COPY --chown=app:app src ./src
# Integration smoke (used only by the compose `integration` gate; harmless at runtime).
COPY --chown=app:app docker/sandbox/smoke.sh ./docker/sandbox/smoke.sh

USER app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Boot the standing server. Vendor selection is env-driven at the composition root.
CMD ["node", "bin/server.mjs"]
