/**
 * Adapter: MemoryJobStore (default; sandbox/tests)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the JobStore port with an in-memory
 * Map — the original composition-root behavior, now behind the port. NOT durable:
 * a process restart loses every job (use FileJobStore where pay→download must
 * survive a restart). Zero deps, no I/O; this is what the sandbox/test gate uses.
 *
 * @see ../../application/ports/JobStore.js
 */

/**
 * @returns {{
 *   put:  (job:import('../../application/ports/JobStore.js').Job) => import('../../application/ports/JobStore.js').Job,
 *   get:  (id:string) => (import('../../application/ports/JobStore.js').Job|undefined),
 *   update:(id:string, patch:object) => import('../../application/ports/JobStore.js').Job
 * }}
 */
export function createMemoryJobStore() {
  /** @type {Map<string, import('../../application/ports/JobStore.js').Job>} */
  const jobs = new Map();

  function put(job) {
    if (!job || typeof job.id !== 'string' || job.id.length === 0) {
      throw new Error('MemoryJobStore: put requires a job with a string id');
    }
    jobs.set(job.id, job);
    return job;
  }

  function get(id) {
    return jobs.get(id);
  }

  function update(id, patch) {
    const job = jobs.get(id);
    if (!job) {
      throw new Error(`MemoryJobStore: cannot update unknown job ${id}`);
    }
    const merged = { ...job, ...patch };
    jobs.set(id, merged);
    return merged;
  }

  return { put, get, update };
}
