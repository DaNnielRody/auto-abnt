/**
 * HTTP boundary — thin transport edge (node:http ONLY, ZERO new deps).
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (transport). Per ADR-0001 (Slice 1) this uses Node's
 * built-in `node:http` — no framework dependency. It carries NO business logic:
 * it only parses the request, calls the wired use-case / app surface, and shapes
 * the response. Adopting a framework later changes ONLY this file.
 *
 * Routes:
 *   POST /format        { skeleton, metadata, ref } -> job (preview pdf + pricing)
 *   POST /checkout      { job }                      -> { chargeId, checkoutUrl }
 *   GET  /download/:id  ?chargeId=...                -> pdf bytes ONLY if verify === 'paid'
 *   GET  /config                                     -> server pricing (for the UI)
 *
 * Jobs are RETAINED by the app surface (composition root), keyed by job.id, so
 * /checkout and /download resolve a job after the Stripe redirect. The price is
 * server-authoritative (app.pricing) — never trusted from the client. The
 * download gate fails closed: 402 when unpaid, 403/404 on mismatch/unknown.
 *
 * @see ../../ARCHITECTURE.md  (ADR-0001)
 */
import http from 'node:http';
import { buildApp } from '../../composition/root.js';

/** Read and JSON-parse a request body (bounded; thin parse, no business logic). */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/**
 * Create the HTTP request handler bound to a built app surface.
 * Exported separately so it is importable + testable without binding a port.
 *
 * @param {ReturnType<typeof buildApp>} [app]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRequestHandler(app = buildApp()) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const { pathname } = url;

      // GET /health — liveness probe for the container / integration poll.
      // Returns 200 with no business data; cheap, never touches a vendor.
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { status: 'ok' });
      }

      // GET /config — expose the server-authoritative price for the UI.
      if (req.method === 'GET' && pathname === '/config') {
        return sendJson(res, 200, { pricing: app.pricing });
      }

      // POST /format — run the use-case, RETAIN the job (app surface), return result.
      // Includes app.pricing so the UI shows the price without hardcoding it.
      if (req.method === 'POST' && pathname === '/format') {
        const { skeleton, metadata, ref } = await readJson(req);
        if (!skeleton || !ref) {
          return sendJson(res, 400, { error: 'skeleton and ref are required' });
        }
        const job = await app.createJob({ skeleton, metadata, ref });
        return sendJson(res, 200, {
          id: job.id,
          warnings: job.warnings,
          status: job.status,
          released: job.released,
          // Server-authoritative price so the UI never hardcodes "R$ 9,90".
          pricing: app.pricing,
          // Preview PDF as base64 so the client can render it inline.
          previewPdf: job.pdf ? Buffer.from(job.pdf).toString('base64') : null,
        });
      }

      // POST /checkout — start checkout for a retained job (by id). NO amount from
      // the client: the gateway bills app.pricing. The created chargeId is LINKED
      // to the job server-side so /download can verify it after the redirect.
      if (req.method === 'POST' && pathname === '/checkout') {
        const { job: jobId } = await readJson(req);
        if (!jobId) return sendJson(res, 400, { error: 'job is required' });
        if (!app.getJob(jobId)) return sendJson(res, 404, { error: 'job not found' });
        const out = await app.startCheckout(jobId);
        return sendJson(res, 200, {
          chargeId: out.chargeId,
          checkoutUrl: out.checkoutUrl,
        });
      }

      // GET /download/:id?chargeId=... — release PDF ONLY when verify === 'paid'.
      // Never trust a client paid flag. Fail closed:
      //   released      -> 200 application/pdf (bytes)
      //   not paid      -> 402 payment required
      //   mismatch/unk  -> 403 (no pdf)
      if (req.method === 'GET' && pathname.startsWith('/download/')) {
        const id = decodeURIComponent(pathname.slice('/download/'.length));
        if (!app.getJob(id)) return sendJson(res, 404, { error: 'job not found' });

        const chargeId = url.searchParams.get('chargeId') ?? '';
        const result = await app.releaseDownload(id, chargeId);
        if (!result.released) {
          // Distinguish unpaid (402) from mismatch/unknown chargeId (403).
          if (result.status === 'rejected') {
            return sendJson(res, 403, { error: 'forbidden', status: result.status });
          }
          return sendJson(res, 402, { error: 'payment required', status: result.status });
        }
        res.writeHead(200, {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${id}.pdf"`,
        });
        return res.end(Buffer.from(result.pdf));
      }

      return sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      // Map use-case/adapter throws to a typed transport error (no vendor leak).
      return sendJson(res, 502, { error: err?.message ?? 'internal error' });
    }
  };
}

/**
 * Create (but do not start) an http.Server. Importable without side effects.
 * @param {ReturnType<typeof buildApp>} [app]
 * @returns {import('node:http').Server}
 */
export function createServer(app = buildApp()) {
  return http.createServer(createRequestHandler(app));
}

/**
 * Boot helper — only runs when this file is executed directly.
 * @param {number} [port]
 * @returns {import('node:http').Server}
 */
export function start(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer();
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`auto-ABNT HTTP boundary listening on :${port}`);
  });
  return server;
}

// Boot only when run directly (`node src/infrastructure/http/server.js`),
// never on import — keeps the module side-effect-free for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
