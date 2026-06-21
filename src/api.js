// Cliente HTTP do backend — única fronteira que o navegador toca.
// O front NUNCA fala com vendor (LLM/pagamento) nem guarda chaves; só posta o
// esqueleto + metadados pro backend e recebe o PDF compilado de volta.
//
// Base URL configurável por ambiente via Vite (import.meta.env.VITE_API_URL).
// Default: '' (mesma origem) — em produção o front é servido atrás de um proxy
// reverso e o POST cai em /format na mesma origem. Em dev, defina VITE_API_URL
// (ex.: VITE_API_URL=http://localhost:3000) num arquivo .env / .env.local.

/** Base do backend. '' = mesma origem (caminho relativo /format). */
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

/** Monta a URL de um endpoint do backend respeitando a base configurada. */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

/**
 * Decodifica uma string base64 em bytes (Uint8Array).
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Lança um Error a partir de uma resposta não-ok, preferindo a mensagem
 * `error` do corpo JSON do backend; senão usa o fallback (com o HTTP status).
 * Único parser de erro-HTTP do cliente (reusado por formatThesis/startCheckout).
 * @param {Response} res
 * @param {string} fallback  Mensagem calma em PT quando o corpo não traz `error`.
 */
async function throwHttpError(res, fallback) {
  let msg = `${fallback} (HTTP ${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) msg = body.error;
  } catch {
    /* corpo não-JSON: mantém a mensagem genérica */
  }
  throw new Error(msg);
}

/**
 * Posta o esqueleto + metadados pro backend formatar e compilar o PDF.
 * @param {{ skeleton: string, metadata: object, ref: string }} payload
 * @returns {Promise<{ id: string, warnings: string[], status: string, previewPdf: string|null }>}
 */
export async function formatThesis({ skeleton, metadata, ref }) {
  const res = await fetch(apiUrl("/format"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skeleton, metadata, ref }),
  });
  if (!res.ok) await throwHttpError(res, "falha ao formatar");
  return res.json();
}

/**
 * Erro tipado do download gated. `kind` distingue os casos que o servidor
 * decide (o front NUNCA confia no `paid=1` da query — o servidor manda):
 *  - 'unpaid'   → HTTP 402 (pagamento ainda não confirmado pelo Stripe)
 *  - 'mismatch' → HTTP 403 (chargeId não bate com o job / desconhecido)
 *  - 'unknown'  → HTTP 404 (job inexistente)
 *  - 'http'     → qualquer outro status inesperado
 */
export class DownloadError extends Error {
  constructor(kind, status) {
    super(`download negado (${kind}, HTTP ${status})`);
    this.name = "DownloadError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Inicia o checkout hospedado do Stripe. NÃO manda valor algum — o servidor é
 * autoritativo no preço. Devolve a URL hospedada pra onde o navegador redireciona.
 * @param {string} jobId
 * @returns {Promise<{ chargeId: string, checkoutUrl: string }>}
 */
export async function startCheckout(jobId) {
  const res = await fetch(apiUrl("/checkout"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job: jobId }),
  });
  if (!res.ok) await throwHttpError(res, "falha ao iniciar o pagamento");
  return res.json();
}

/**
 * Baixa o PDF liberado pelo servidor após o pagamento verificado. O servidor
 * decide: 402 = não pago, 403 = chargeId não confere, 404 = job desconhecido.
 * @param {string} jobId
 * @param {string} chargeId
 * @returns {Promise<Blob>} o PDF (application/pdf)
 */
export async function downloadPdf(jobId, chargeId) {
  const url = apiUrl(
    `/download/${encodeURIComponent(jobId)}?chargeId=${encodeURIComponent(chargeId)}`,
  );
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 402) throw new DownloadError("unpaid", 402);
    if (res.status === 403) throw new DownloadError("mismatch", 403);
    if (res.status === 404) throw new DownloadError("unknown", 404);
    throw new DownloadError("http", res.status);
  }
  return res.blob();
}

/**
 * Busca a precificação atual exposta pelo servidor (GET /config). Usado como
 * fallback quando o preço não chegou junto da resposta de /format.
 * @returns {Promise<{ pricing: { amount: number, currency: string, formatted: string } }>}
 */
export async function getConfig() {
  const res = await fetch(apiUrl("/config"));
  if (!res.ok) throw new Error(`falha ao ler a configuração (HTTP ${res.status})`);
  return res.json();
}
