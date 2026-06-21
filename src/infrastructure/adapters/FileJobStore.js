/**
 * Adapter: FileJobStore (durable; persists jobs to disk)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the JobStore port by persisting each
 * job to one JSON file under `dir` (`<dir>/<id>.json`), so a job written by one
 * process is readable by a fresh instance on the SAME dir — the "survive a server
 * restart between pay and download" case. Node built-ins only (node:fs, node:path);
 * ZERO new deps.
 *
 * Serialization: the job is JSON with its `pdf` bytes (Buffer/Uint8Array) encoded as
 * base64 under a sentinel envelope `{ __pdf_b64__: '...' }`, so pdf round-trips
 * byte-exact and is decoded back to a Buffer on get().
 *
 * Atomicity: writes go to `<dir>/<id>.json.tmp` then `fs.renameSync` into place —
 * rename is atomic on the same filesystem, so get() never observes a half-written
 * file. A `.tmp` file is never read as a job.
 *
 * Fail closed: a corrupt/partial `<id>.json` (bad JSON / missing id) is treated as
 * MISSING — get() returns undefined rather than surfacing torn bytes as a valid job.
 *
 * NOTE (out of scope): PDFs persisted here have NO TTL / cleanup yet — a later slice
 * must expire/evict old job files (and treat the on-disk pdf as sensitive). Tracked
 * separately; not implemented here.
 *
 * @see ../../application/ports/JobStore.js
 */
import fs from 'node:fs';
import path from 'node:path';

const PDF_KEY = '__pdf_b64__';

/**
 * @param {{ dir:string }} opts  Directory the job files live in (created if absent).
 * @returns {{
 *   put:  (job:import('../../application/ports/JobStore.js').Job) => import('../../application/ports/JobStore.js').Job,
 *   get:  (id:string) => (import('../../application/ports/JobStore.js').Job|undefined),
 *   update:(id:string, patch:object) => import('../../application/ports/JobStore.js').Job
 * }}
 */
export function createFileJobStore({ dir } = {}) {
  if (typeof dir !== 'string' || dir.length === 0) {
    throw new Error('FileJobStore: requires { dir }');
  }
  fs.mkdirSync(dir, { recursive: true });

  /** Path of the durable file for a job id. */
  function fileFor(id) {
    return path.join(dir, `${encodeURIComponent(id)}.json`);
  }

  /**
   * Encode a job to a JSON string, base64-ing any byte fields so they round-trip
   * exactly. We pre-walk the OWN values (not via a JSON replacer): Buffer has a
   * `toJSON()` that JSON.stringify applies BEFORE a replacer sees it, so an
   * `instanceof Uint8Array` check inside a replacer would miss Buffers. Walking the
   * live object here sees the real Buffer/Uint8Array instances.
   */
  function encode(job) {
    const out = {};
    for (const [key, value] of Object.entries(job)) {
      out[key] =
        value instanceof Uint8Array
          ? { [PDF_KEY]: Buffer.from(value).toString('base64') }
          : value;
    }
    return JSON.stringify(out);
  }

  /** Decode a JSON string back to a job, restoring pdf bytes to a Buffer. */
  function decode(text) {
    return JSON.parse(text, (_key, value) => {
      if (
        value &&
        typeof value === 'object' &&
        typeof value[PDF_KEY] === 'string'
      ) {
        return Buffer.from(value[PDF_KEY], 'base64');
      }
      return value;
    });
  }

  /** Atomically write `job` to its file: tmp + rename (rename is atomic same-fs). */
  function put(job) {
    if (!job || typeof job.id !== 'string' || job.id.length === 0) {
      throw new Error('FileJobStore: put requires a job with a string id');
    }
    const finalPath = fileFor(job.id);
    // Write to a sibling .tmp then rename into place (rename is atomic on the same
    // filesystem), so get() never observes a half-written file. The .tmp suffix also
    // means a leftover/partial tmp is never read as a job (get() only opens <id>.json).
    const tmpPath = `${finalPath}.tmp`;
    fs.writeFileSync(tmpPath, encode(job));
    fs.renameSync(tmpPath, finalPath);
    return job;
  }

  /** Read a job by id; undefined if missing OR corrupt (fail closed). */
  function get(id) {
    const finalPath = fileFor(id);
    let text;
    try {
      text = fs.readFileSync(finalPath, 'utf8');
    } catch {
      return undefined; // missing file → unknown job
    }
    let job;
    try {
      job = decode(text);
    } catch {
      return undefined; // corrupt/partial JSON → fail closed, treat as missing
    }
    // Guard against a structurally-invalid (torn) file that still parsed as JSON.
    if (!job || typeof job !== 'object' || typeof job.id !== 'string') {
      return undefined;
    }
    return job;
  }

  /** Shallow-merge a patch into the stored job and persist atomically. */
  function update(id, patch) {
    const job = get(id);
    if (!job) {
      throw new Error(`FileJobStore: cannot update unknown job ${id}`);
    }
    const merged = { ...job, ...patch };
    put(merged);
    return merged;
  }

  return { put, get, update };
}
