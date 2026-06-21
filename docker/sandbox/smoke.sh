#!/bin/sh
# Integration smoke — proves a REAL abntex2 compile end-to-end.
# ---------------------------------------------------------------------------
# Runs INSIDE the production image (Node + TeX Live/abntex2). No host ports, no
# external vendors: LLM_PROVIDER=fake + PAYMENT_PROVIDER=fake, COMPILER=texlive.
#
# Steps:
#   1. boot the standing server (bin/server.mjs) in the background
#   2. poll GET /health until status < 500 (server is up)
#   3. POST /format with a genuinely compilable abntex2 skeleton; the FAKE LLM
#      wraps it into a finished abntex2 doc, which COMPILER=texlive compiles for
#      real via latexmk → abntex2. Assert the response carries a non-empty
#      base64 PDF whose bytes start with "%PDF" (real abntex2 output).
#
# Exit 0 only when a real PDF was produced; non-zero (and server log dumped) otherwise.
set -eu

PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"
export BASE

echo "[smoke] booting server (COMPILER=${COMPILER:-?}, LLM=${LLM_PROVIDER:-?}, PAY=${PAYMENT_PROVIDER:-?}) on :${PORT}"
node bin/server.mjs >/tmp/server.log 2>&1 &
SERVER_PID=$!

cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# --- 2. poll /health until <500 (up) -------------------------------------
echo "[smoke] polling ${BASE}/health ..."
UP=0
i=0
while [ "$i" -lt 60 ]; do
  CODE=$(node -e "fetch('${BASE}/health').then(r=>{console.log(r.status);process.exit(0)}).catch(()=>{console.log(0);process.exit(0)})") || CODE=0
  if [ "$CODE" -ge 200 ] && [ "$CODE" -lt 500 ]; then
    echo "[smoke] server up (/health -> ${CODE})"
    UP=1
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$UP" -ne 1 ]; then
  echo "[smoke] FAIL: server never became healthy"
  echo "----- server.log -----"; cat /tmp/server.log || true
  exit 1
fi

# --- 3. POST /format and assert a real compiled PDF ----------------------
# Skeleton = plain abntex2 textual content. The fake LLM wraps it as:
#   \documentclass[12pt,a4paper]{abntex2}\titulo{..}\autor{..}
#   \begin{document}\imprimircapa <SKELETON> \end{document}
# So this is a complete, compilable abntex2 document once wrapped.
echo "[smoke] POST ${BASE}/format ..."
node -e '
const base = process.env.BASE || "http://127.0.0.1:3000";
const skeleton = [
  "\\textual",
  "\\chapter{Introdução}",
  "Este é um documento de teste de integração compilado de verdade pelo abntex2.",
  "\\section{Contexto}",
  "Texto da seção para garantir conteúdo textual real."
].join("\n");
const body = {
  ref: "smoke-integration-001",
  skeleton,
  metadata: { titulo: "Teste de Integração", autor: "Smoke Bot", ano: "2026" }
};
fetch(base + "/format", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
})
  .then(async (r) => {
    const json = await r.json();
    if (r.status !== 200) {
      console.error("[smoke] /format HTTP " + r.status + ": " + JSON.stringify(json));
      process.exit(2);
    }
    const b64 = json.previewPdf;
    if (!b64 || typeof b64 !== "string") {
      console.error("[smoke] no previewPdf in response (compile produced no PDF): " + JSON.stringify(json));
      process.exit(3);
    }
    const buf = Buffer.from(b64, "base64");
    const magic = buf.subarray(0, 5).toString("latin1");
    if (buf.length < 1000 || magic !== "%PDF-") {
      console.error("[smoke] previewPdf not a real PDF (len=" + buf.length + ", magic=" + JSON.stringify(magic) + ")");
      process.exit(4);
    }
    console.log("[smoke] REAL PDF produced by abntex2: " + buf.length + " bytes, magic " + JSON.stringify(magic));
    process.exit(0);
  })
  .catch((e) => { console.error("[smoke] /format error: " + (e && e.message)); process.exit(5); });
' || {
  RC=$?
  echo "[smoke] FAIL: /format assertion failed (rc=${RC})"
  echo "----- server.log -----"; cat /tmp/server.log || true
  exit "$RC"
}

echo "[smoke] PASS: real abntex2 compile proven."
exit 0
