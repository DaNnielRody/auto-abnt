/**
 * HTTP boundary — thin transport edge (node:http ONLY, ZERO new deps).
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (transport). Per ADR-0001 (Slice 1) this uses Node's
 * built-in `node:http` — no framework dependency. It carries NO business logic:
 * it only parses the request, calls the wired use-case / app surface, and shapes
 * the response. Adopting a framework later changes ONLY this file.
 *
 * Routes:
 *   POST /format        { skeleton, metadata, ref } -> job (preview pdf as base64)
 *   POST /checkout      { ref }                      -> { chargeId, status, clientSecret }
 *   GET  /download/:id  ?chargeId=...                -> pdf bytes ONLY if verify === 'paid'
 *
 * Jobs are held in-memory keyed by ref for Slice 1 (a later slice persists them).
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
  /** @type {Map<string, import('../../domain/types.js').FormattingJob>} */
  const jobs = new Map();

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const { pathname } = url;

      // POST /format — run the use-case, store the job, return shaped result.
      if (req.method === 'POST' && pathname === '/format') {
        const { skeleton, metadata, ref } = await readJson(req);
        if (!skeleton || !ref) {
          return sendJson(res, 400, { error: 'skeleton and ref are required' });
        }
        const job = await app.formatThesis.execute({ skeleton, metadata, ref });
        jobs.set(job.id, job);
        return sendJson(res, 200, {
          id: job.id,
          warnings: job.warnings,
          chargeId: job.chargeId,
          status: job.status,
          released: job.released,
          // Preview PDF as base64 so the client can render it inline.
          previewPdf: job.pdf ? Buffer.from(job.pdf).toString('base64') : null,
        });
      }

      // POST /checkout — create (or reuse) a charge for a known job ref.
      // SECURITY: the price is server-authoritative (injected pricing/config).
      // We deliberately do NOT forward any client-supplied amount/currency — the
      // gateway bills the configured price regardless. /checkout needs only the ref.
      if (req.method === 'POST' && pathname === '/checkout') {
        const { ref } = await readJson(req);
        if (!ref) return sendJson(res, 400, { error: 'ref is required' });
        const charge = await app.paymentGateway.createCharge({ ref });
        return sendJson(res, 200, {
          chargeId: charge.id,
          status: charge.status,
          // Checkout URL (Stripe) or clientSecret (other gateways) — whichever the adapter returns.
          checkoutUrl: charge.url ?? null,
          clientSecret: charge.clientSecret ?? null,
        });
      }

      // GET /download/:id?chargeId=... — release PDF ONLY when verify === 'paid'.
      if (req.method === 'GET' && pathname.startsWith('/download/')) {
        const id = decodeURIComponent(pathname.slice('/download/'.length));
        const job = jobs.get(id);
        if (!job) return sendJson(res, 404, { error: 'job not found' });

        const chargeId = url.searchParams.get('chargeId') ?? job.chargeId;
        const result = await app.releaseDownload({ chargeId, pdf: job.pdf });
        if (!result.released) {
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
