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
  if (!res.ok) {
    let msg = `falha ao formatar (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* corpo não-JSON: mantém a mensagem genérica */
    }
    throw new Error(msg);
  }
  return res.json();
}
