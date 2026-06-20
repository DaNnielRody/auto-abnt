// RED test (Slice #3) — real LatexCompiler adapter (TeX Live + abntex2).
// Plain node + ESM. ZERO network, ZERO real TeX Live. The LaTeX toolchain is reached via an
// INJECTED runner fn (Conservador: no new deps, unit-testable, offline). Each test passes a FAKE
// `run` that (a) captures what the adapter writes/invokes and (b) returns a faked toolchain result.
//
// Contract under test (src/application/ports/LatexCompiler.js):
//   compile({latex, assets?}) -> {pdf, log}   (MUST THROW on compile failure; never empty pdf as success)
//
// ASSUMED FACTORY SHAPE (df-backend must MATCH this — proposed here):
//   import { createTexLiveCompiler } from '../src/infrastructure/adapters/TexLiveCompiler.js';
//   createTexLiveCompiler({ run, tmpDir? }) -> { async compile({latex, assets}) }
//   - run: an injected async toolchain fn:
//         run({ texPath, workdir }) => Promise<{ exitCode:number, stdout:string, stderr:string,
//                                                 pdfPath?:string, pdfBytes?:Uint8Array }>
//       The adapter writes `latex` to a `.tex` file inside a fresh temp workdir, writes any
//       `assets` next to it, then calls run({texPath, workdir}). On exitCode!==0 (or no pdf)
//       it THROWS, surfacing stdout/stderr in the log. On success it reads the pdf bytes
//       (from pdfBytes, or by reading pdfPath) and returns {pdf, log}.
//   - tmpDir: optional base dir for the temp workdir (defaults to os.tmpdir() inside the adapter).
//   Node built-ins only (node:fs, node:os, node:child_process). The fake run NEVER touches a real binary.
//
// Run:  node tests/latex-compiler.test.mjs   (and via the gate: node test-all.mjs)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTexLiveCompiler } from '../src/infrastructure/adapters/TexLiveCompiler.js';

// ---- deterministic fixtures (no Date.now / no random in asserts) -------------
const LATEX = '\\documentclass{abntex2}\n\\begin{document}\nCOMPILE ME 7731\n\\end{document}\n';
const PDF_BYTES = new TextEncoder().encode('%PDF-1.5\n%fake-compiled-7731\n%%EOF\n');

// ---- fake runner factory: captures the call, returns a canned toolchain result
// success mode: writes a pdf to the workdir AND returns pdfBytes, so the adapter can
// take either path (pdfBytes preferred, or read pdfPath). Captures every call + the
// workdir it saw so we can assert cleanup afterwards.
function makeFakeRun({ exitCode = 0, stdout = 'latexmk: output written on out.pdf', stderr = '', emitPdf = true } = {}) {
  const calls = [];
  const seenWorkdirs = [];
  const run = async ({ texPath, workdir }) => {
    seenWorkdirs.push(workdir);
    // Read back what the adapter wrote so the test can assert the .tex content.
    let texOnDisk;
    try { texOnDisk = fs.readFileSync(texPath, 'utf8'); } catch { texOnDisk = undefined; }
    calls.push({ texPath, workdir, texOnDisk });

    let pdfPath;
    if (emitPdf && exitCode === 0) {
      pdfPath = path.join(workdir, 'out.pdf');
      try { fs.writeFileSync(pdfPath, PDF_BYTES); } catch { /* ignore */ }
      return { exitCode, stdout, stderr, pdfPath, pdfBytes: PDF_BYTES.slice() };
    }
    // failure: no pdf produced.
    return { exitCode, stdout, stderr };
  };
  return { run, calls, seenWorkdirs };
}

const asString = (bytes) => Buffer.from(bytes).toString('latin1');

// ---- tiny runner ------------------------------------------------------------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =============================================================================
// success: compile writes latex to a .tex, invokes run, returns {pdf, log}
// =============================================================================
test('success: writes latex to a .tex, invokes run, returns non-empty %PDF bytes + log', async () => {
  const { run, calls } = makeFakeRun();
  const compiler = createTexLiveCompiler({ run });

  const out = await compiler.compile({ latex: LATEX });

  // runner invoked exactly once with a .tex path inside a workdir
  assert.equal(calls.length, 1, 'adapter must invoke the runner exactly once');
  const call = calls[0];
  assert.match(call.texPath, /\.tex$/, `runner must receive a .tex path (got ${call.texPath})`);
  assert.ok(call.workdir, 'runner must receive a workdir');
  assert.ok(call.texPath.startsWith(call.workdir), 'the .tex must live inside the workdir');

  // the EXACT latex reached the runner via the written .tex
  assert.equal(call.texOnDisk, LATEX, 'the given latex must be written to the .tex the runner sees');

  // result: non-empty %PDF-prefixed bytes + log carrying runner output
  assert.ok(out.pdf && out.pdf.length > 0, 'pdf must be non-empty bytes');
  assert.ok(asString(out.pdf).startsWith('%PDF'), 'pdf must be %PDF-prefixed');
  assert.ok(typeof out.log === 'string' && out.log.length > 0, 'log must be a non-empty string');
  assert.ok(out.log.includes('output written on out.pdf'), 'log must carry the runner stdout');
});

// =============================================================================
// compile failure: non-zero exit => THROW, log surfaces the toolchain output
// =============================================================================
test('failure: non-zero exitCode makes compile() THROW and surface the compiler output', async () => {
  const { run } = makeFakeRun({
    exitCode: 12,
    stdout: '! LaTeX Error: File `abntex2.cls\' not found.',
    stderr: 'latexmk: fatal',
    emitPdf: false,
  });
  const compiler = createTexLiveCompiler({ run });

  let thrown;
  await assert.rejects(
    compiler.compile({ latex: LATEX }).catch((e) => { thrown = e; throw e; }),
    /./,
    'a non-zero exit must reject (throw), never resolve with empty pdf',
  );
  // the thrown error must surface the compiler output so the use-case can diagnose / not bill
  const msg = `${thrown?.message ?? ''}${thrown?.log ?? ''}`;
  assert.ok(
    msg.includes('abntex2.cls') || msg.includes('LaTeX Error'),
    'the thrown error must surface the compiler output (stdout/stderr)',
  );
});

// =============================================================================
// compile failure variant: exit 0 but NO pdf produced => still THROW
// =============================================================================
test('failure: exit 0 but no pdf produced makes compile() THROW (no empty pdf as success)', async () => {
  const { run } = makeFakeRun({ exitCode: 0, emitPdf: false, stdout: 'no pages of output' });
  const compiler = createTexLiveCompiler({ run });

  await assert.rejects(
    compiler.compile({ latex: LATEX }),
    /./,
    'a missing pdf must reject even on exit 0 — never return empty/garbage pdf as success',
  );
});

// =============================================================================
// invocation shape: assert a .tex with the given latex reaches the runner.
// Kept LOOSE — we do NOT pin exact latexmk/abntex2 CLI flags, only the .tex+workdir seam.
// =============================================================================
test('invocation: the given latex reaches the runner as a .tex inside a workdir (no flags pinned)', async () => {
  const { run, calls } = makeFakeRun();
  const compiler = createTexLiveCompiler({ run });

  await compiler.compile({ latex: LATEX });

  const call = calls[0];
  assert.match(call.texPath, /\.tex$/, 'runner must be handed a .tex path');
  assert.equal(call.texOnDisk, LATEX, 'the .tex handed to the runner must contain the given latex');
});

// =============================================================================
// temp dir cleanup: no leak after success (workdir removed)
// =============================================================================
test('cleanup: temp workdir is removed after a successful compile (no leak)', async () => {
  const { run, seenWorkdirs } = makeFakeRun();
  const compiler = createTexLiveCompiler({ run });

  await compiler.compile({ latex: LATEX });

  assert.equal(seenWorkdirs.length, 1, 'exactly one workdir created');
  const wd = seenWorkdirs[0];
  assert.ok(!fs.existsSync(wd), `temp workdir must be cleaned up after compile (still exists: ${wd})`);
});

// =============================================================================
// temp dir cleanup: no leak after FAILURE (workdir removed even when throwing)
// =============================================================================
test('cleanup: temp workdir is removed even when compile() THROWS (no leak on failure)', async () => {
  const { run, seenWorkdirs } = makeFakeRun({ exitCode: 1, emitPdf: false });
  const compiler = createTexLiveCompiler({ run });

  await assert.rejects(compiler.compile({ latex: LATEX }), /./);

  assert.equal(seenWorkdirs.length, 1, 'exactly one workdir created');
  const wd = seenWorkdirs[0];
  assert.ok(!fs.existsSync(wd), `temp workdir must be cleaned up after a failed compile (still exists: ${wd})`);
});

// =============================================================================
// guard: empty latex rejects (mirror FakeLatexCompiler contract) — never call runner
// =============================================================================
test('guard: empty latex rejects without invoking the runner', async () => {
  const { run, calls } = makeFakeRun();
  const compiler = createTexLiveCompiler({ run });

  await assert.rejects(compiler.compile({ latex: '' }), /./, 'empty latex must reject');
  assert.equal(calls.length, 0, 'runner must not be invoked for empty latex');
});

// Sanity: the temp base is under the OS tmp by default (guards the test's own assumption loosely).
test('fixture sanity: os.tmpdir() is available for the default temp base', () => {
  assert.ok(typeof os.tmpdir() === 'string' && os.tmpdir().length > 0, 'os.tmpdir() must be usable');
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
console.log(`\nLatexCompiler (TeX Live + abntex2): ${pass} passed, ${fail} failed (of ${tests.length})`);
if (fail > 0) process.exitCode = 1;
