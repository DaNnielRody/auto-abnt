// RED test (Slice #10, AFK) — the DURABLE JobStore port. The job store is today an
// in-memory Map in the composition root, so a server restart between POST /format and
// the post-payment GET /download loses the job (paid → download 404s). This test pins
// the JobStore PORT contract + its two adapters: MemoryJobStore (default, sandbox/tests)
// and FileJobStore (persists job incl. pdf+chargeId+status to disk; survives restart).
//
// Plain node + ESM, ZERO network, ZERO vendor SDK, deterministic (no Date.now / random).
// FileJobStore uses os.tmpdir() + a unique subdir, cleaned up after the run.
//
// ============================================================================
// ASSUMED JOBSTORE PORT + FACTORY CONTRACT (df-backend MUST MATCH — proposed here):
//
//   import { createMemoryJobStore } from '../src/infrastructure/adapters/MemoryJobStore.js';
//   import { createFileJobStore   } from '../src/infrastructure/adapters/FileJobStore.js';
//
//   const store = createMemoryJobStore();              // in-memory (default)
//   const store = createFileJobStore({ dir });         // persists to `dir` on disk
//
//   JobStore (the port — both factories implement it):
//     store.put(job)            -> void | job
//         Persist `job` keyed by job.id. `job` is a serializable FormattingJob-shaped
//         object holding at least { id }, and may hold skeleton/metadata/latex/warnings/
//         pdf (bytes)/chargeId/status/released. pdf is Buffer/Uint8Array and MUST
//         round-trip intact (bytes equal after get, incl. across a fresh FileJobStore).
//     store.get(id)             -> job | undefined
//         The stored job (deep-equivalent to what was put), or undefined if unknown.
//     store.update(id, patch)   -> job
//         Shallow-merge `patch` into the stored job, persist it, return the merged job
//         (e.g. update(id, { chargeId, status }) to link a charge / flip status).
//
//   Durability invariant (FileJobStore): a job put() by one createFileJobStore({dir})
//   instance is readable by a SECOND createFileJobStore({dir}) on the SAME dir — pdf
//   bytes included. This is the "survive a process restart between pay and download" case.
//
//   Atomicity (best-effort): FileJobStore writes atomically (tmp file + rename) so a
//   partially-written file is never returned by get() as a valid job.
//
//   Composition wiring (selector, mirrors selectLlmFormatter/selectPaymentGateway):
//     JOB_STORE=file + JOB_STORE_DIR=<dir> -> FileJobStore (durable)
//     JOB_STORE=memory | (unset)           -> MemoryJobStore (sandbox/tests default)
//   createJob/getJob/startCheckout(link chargeId)/releaseDownload go THROUGH the port.
// ============================================================================
//
// Run:  node tests/jobstore.test.mjs   (and via the gate: node test-all.mjs)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createMemoryJobStore } from '../src/infrastructure/adapters/MemoryJobStore.js';
import { createFileJobStore } from '../src/infrastructure/adapters/FileJobStore.js';
import { buildApp } from '../src/composition/root.js';

// ---- deterministic fixtures (no Date.now / no random) ------------------------
// A real-ish %PDF byte buffer so we prove the bytes round-trip (not just truthiness).
const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF\n', 'latin1');

function makeJob(id = 'job-0010') {
  return {
    id,
    latex: '\\documentclass{abntex2}\\begin{document}FORMATADO\\end{document}',
    warnings: ['warn-1'],
    pdf: PDF_BYTES,
    chargeId: undefined,
    status: 'pending',
    released: false,
  };
}

// Unique tmp dir per createFileJobStore test; tracked for cleanup.
const tmpDirs = [];
function freshDir(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `abnt-jobstore-${label}-`));
  tmpDirs.push(dir);
  return dir;
}
function cleanup() {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

// Assert pdf bytes survived as bytes (Buffer/Uint8Array), comparing content.
function assertPdfIntact(actualPdf, msg) {
  assert.ok(actualPdf, `${msg}: pdf must be present`);
  assert.equal(actualPdf.length, PDF_BYTES.length, `${msg}: pdf byte length must match`);
  assert.ok(
    Buffer.from(actualPdf).equals(PDF_BYTES),
    `${msg}: pdf bytes must round-trip exactly`,
  );
}

// ---- tiny runner ------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// CONTRACT — runs the SAME suite against BOTH stores (memory + file).
// =============================================================================
const stores = [
  { label: 'MemoryJobStore', make: () => createMemoryJobStore() },
  { label: 'FileJobStore', make: () => createFileJobStore({ dir: freshDir('contract') }) },
];

for (const { label, make } of stores) {
  // ---- put → get roundtrip (incl. pdf bytes) --------------------------------
  test(`${label}: put then get returns an equivalent job (pdf bytes intact)`, async () => {
    const store = make();
    const job = makeJob();
    await store.put(job);

    const got = await store.get(job.id);
    assert.ok(got, 'get must resolve the put job');
    assert.equal(got.id, job.id, 'id must round-trip');
    assert.equal(got.latex, job.latex, 'latex must round-trip');
    assert.equal(got.status, job.status, 'status must round-trip');
    assert.deepEqual(got.warnings, job.warnings, 'warnings must round-trip');
    assertPdfIntact(got.pdf, `${label} put→get`);
  });

  // ---- update(id, patch) persists + is visible via get ----------------------
  test(`${label}: update(id, {chargeId,status}) persists and is visible via get`, async () => {
    const store = make();
    await store.put(makeJob());

    await store.update('job-0010', { chargeId: 'charge-xyz', status: 'paid' });

    const got = await store.get('job-0010');
    assert.ok(got, 'job must still exist after update');
    assert.equal(got.chargeId, 'charge-xyz', 'chargeId patch must persist');
    assert.equal(got.status, 'paid', 'status patch must persist');
    assertPdfIntact(got.pdf, `${label} update keeps pdf`);
  });

  // ---- get(unknown) → undefined --------------------------------------------
  test(`${label}: get(unknown) returns undefined`, async () => {
    const store = make();
    const got = await store.get('does-not-exist');
    assert.equal(got, undefined, 'unknown id must resolve to undefined');
  });
}

// =============================================================================
// DURABILITY — FileJobStore survives a "process restart": a SECOND instance on the
// SAME dir reads back a job written by the FIRST (pdf bytes included).
// =============================================================================
test('FileJobStore: a second instance on the same dir reads back the job (restart survives, pdf intact)', async () => {
  const dir = freshDir('restart');

  // First "process": create the store, persist a job, link a paid charge.
  const writer = createFileJobStore({ dir });
  await writer.put(makeJob('job-restart'));
  await writer.update('job-restart', { chargeId: 'ch-restart', status: 'paid' });

  // Second "process": a brand-new store on the SAME dir (simulates a restart).
  const reader = createFileJobStore({ dir });
  const got = await reader.get('job-restart');

  assert.ok(got, 'a fresh FileJobStore instance must read the persisted job (durability)');
  assert.equal(got.chargeId, 'ch-restart', 'chargeId must survive the restart');
  assert.equal(got.status, 'paid', 'status must survive the restart');
  assertPdfIntact(got.pdf, 'FileJobStore restart');
});

// =============================================================================
// ATOMICITY (best-effort) — a partially-written file is NOT returned as a valid job.
// We simulate a torn write by dropping garbage where a job file would live and assert
// get() does not surface it as a real job (returns undefined, or ignores the corrupt
// file rather than throwing a non-undefined truthy job). Don't over-engineer.
// =============================================================================
test('FileJobStore: a partially-written/corrupt file is not returned as a valid job', async () => {
  const dir = freshDir('atomic');
  const store = createFileJobStore({ dir });

  // Drop corrupt content using both common on-disk layouts so the test is layout-agnostic:
  //  - one-file-per-job:  <dir>/<id>.json
  //  - tmp partial write: <dir>/<id>.json.tmp (must never be read as the job)
  fs.writeFileSync(path.join(dir, 'corrupt-job.json'), '{ this is not valid json');
  fs.writeFileSync(path.join(dir, 'corrupt-job.json.tmp'), '%PDF-partial');

  let got;
  let threw = false;
  try {
    got = await store.get('corrupt-job');
  } catch {
    // Throwing on a corrupt file is acceptable fail-closed behavior; what's NOT
    // acceptable is returning a truthy "valid" job from torn bytes.
    threw = true;
  }
  assert.ok(threw || got === undefined, 'a corrupt/partial file must NOT be surfaced as a valid job');
});

// =============================================================================
// INTEGRATION (composition seam) — JOB_STORE=file makes a job created via the app
// retrievable after building a FRESH app on the SAME dir (pay→restart→download), and
// releaseDownload still gates on verify==='paid'.
//
// RED until df-backend wires the JobStore selector into buildApp (JOB_STORE/JOB_STORE_DIR).
// Failure reason is made explicit so it's clearly "wiring missing", not a typo.
// =============================================================================
test('composition: JOB_STORE=file makes a job survive a fresh buildApp on the same dir, and releaseDownload still gates on paid', async () => {
  const dir = freshDir('app');
  const env = {
    PRICE_BRL: '990',
    JOB_STORE: 'file',
    JOB_STORE_DIR: dir,
    // no LLM/STRIPE/COMPILER keys => all fakes (no network, no binary).
  };

  const SKELETON = '\\documentclass{abntex2}\\begin{document}RASCUNHO\\end{document}';
  const METADATA = { titulo: 'Durabilidade', autor: 'Maria Teste' };
  const REF = 'job-afk';

  // "Process 1": create the job + start checkout (links the chargeId), through the file store.
  const app1 = buildApp(env);
  await app1.createJob({ skeleton: SKELETON, metadata: METADATA, ref: REF });
  const { chargeId } = await app1.startCheckout(REF);

  // "Process 2": a FRESH app on the SAME dir (server restarted between pay and download).
  const app2 = buildApp(env);
  const survived = app2.getJob(REF);
  assert.ok(
    survived,
    'JOB_STORE=file must persist the job so a fresh buildApp on the same dir resolves it ' +
      '(if undefined, buildApp is NOT yet routing createJob/getJob through a durable FileJobStore)',
  );
  assert.equal(survived.chargeId, chargeId, 'the linked chargeId must survive the restart');
  assertPdfIntact(survived.pdf, 'composition restart');

  // Still gates on paid: unpaid → no release; paid → release the SAME pdf.
  const unpaid = await app2.releaseDownload(REF, chargeId);
  assert.equal(unpaid.released, false, 'must not release before verify === paid (even after restart)');
  assert.equal(unpaid.pdf, undefined, 'pdf must not leave the seam while unpaid');

  app2.paymentGateway.markPaid(chargeId);
  const paid = await app2.releaseDownload(REF, chargeId);
  assert.equal(paid.released, true, 'must release once verify(chargeId) === paid (post-restart)');
  assertPdfIntact(paid.pdf, 'composition paid release');
});

// ---- run --------------------------------------------------------------------
let pass = 0;
let fail = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    pass += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}
cleanup();
console.log(`\njobstore: ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
