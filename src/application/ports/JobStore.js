/**
 * Port: JobStore
 * -----------------------------------------------------------------------------
 * Layer: application (port). Storage-AGNOSTIC contract for the formatting jobs the
 * composition root holds between POST /format and the post-payment GET /download.
 *
 * Today the job lived in an in-memory Map inside the composition root, so a server
 * restart between pay and download lost the job (paid → download 404). This port is
 * the swappable seam: MemoryJobStore (default; sandbox/tests) keeps the Map; a
 * FileJobStore persists each job to disk so a restart survives. Concrete adapters
 * live in src/infrastructure/adapters and are wired ONLY at the composition root.
 *
 * RULE: callers (createJob/getJob/startCheckout/releaseDownload) depend on this port
 * only — never on a concrete store. Swapping storage edits an adapter + the selector
 * at the root, never this port nor a use-case.
 *
 * A Job is a serializable, FormattingJob-shaped object holding AT LEAST `{ id }`, and
 * may hold skeleton/metadata/latex/warnings/pdf/chargeId/status/released. The `pdf`
 * field is Buffer/Uint8Array bytes and MUST round-trip byte-exact through any store
 * (including a fresh FileJobStore instance on the same dir).
 *
 * @see ../../composition/root.js
 */

/**
 * @typedef {Object} Job
 * @property {string} id  Unique job id (the store key).
 * @property {(Uint8Array|Buffer)} [pdf]  Preview PDF bytes; round-trips byte-exact.
 * @property {string} [chargeId]  Linked charge id (set via update during checkout).
 * @property {string} [status]  Lifecycle status (e.g. 'pending' | 'paid').
 * @property {boolean} [released]
 * @property {string} [latex]
 * @property {string[]} [warnings]
 */

/**
 * @interface JobStore
 *
 * Contract:
 * - `put(job)` persists `job` keyed by `job.id`, overwriting any prior job with that id.
 * - `get(id)` returns the stored job (deep-equivalent to what was put, pdf bytes
 *   intact), or `undefined` if unknown. A corrupt/partial on-disk file MUST NOT be
 *   surfaced as a valid job (fail closed → treat as missing / throw, never return torn bytes).
 * - `update(id, patch)` shallow-merges `patch` into the stored job, persists, and
 *   returns the merged job (e.g. link a chargeId / flip status). Throws on unknown id.
 *
 * Methods may be sync or async; callers must tolerate both (await on a sync return is a no-op).
 */

/**
 * Persist a job keyed by job.id.
 * @function
 * @name JobStore#put
 * @param {Job} job  Serializable job holding at least `{ id }`.
 * @returns {(void|Job)}  Implementations may return the stored job.
 */

/**
 * Resolve a job by id.
 * @function
 * @name JobStore#get
 * @param {string} id
 * @returns {(Job|undefined)}  The stored job, or undefined if unknown/corrupt.
 */

/**
 * Shallow-merge a patch into the stored job and persist it.
 * @function
 * @name JobStore#update
 * @param {string} id
 * @param {Partial<Job>} patch
 * @returns {Job}  The merged job.
 * @throws {Error} if the job id is unknown.
 */

export {}; // contract-only module (JSDoc typedefs); no runtime export.
