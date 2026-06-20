/**
 * Adapter: TexLiveCompiler (real LatexCompiler — TeX Live + abntex2)
 * -----------------------------------------------------------------------------
 * Layer: infrastructure (adapter). Implements the LatexCompiler port by writing
 * the finished `.tex` (plus any assets) into a FRESH temp workdir and handing it
 * to an INJECTED runner fn — NO direct process spawn in the factory itself, so it
 * is unit-testable offline with a fake runner (Conservador: zero new deps).
 *
 * The DEFAULT production runner (createLatexmkRunner / defaultRun) shells out via
 * node:child_process to the real TeX Live toolchain. It is importable WITHOUT
 * invoking it; the unit gate uses the fake runner only (no TeX Live in sandbox).
 *
 * Contract honored: compile({latex, assets?}) -> {pdf, log}.
 *  - empty latex      → reject WITHOUT calling run
 *  - exit 0 + pdf     → { pdf, log } (pdf = non-empty %PDF bytes; log = runner output)
 *  - exit !== 0       → THROW, surfacing the compiler output (err.message / err.log)
 *  - exit 0, no pdf   → THROW (never return empty/garbage pdf as success)
 *  - temp workdir is cleaned up on BOTH success and throw (no leaks)
 *
 * @implements {import('../../application/ports/LatexCompiler.js').LatexCompiler}
 * @see ../../application/ports/LatexCompiler.js
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Build the TeX Live compiler adapter.
 *
 * @param {Object} deps
 * @param {(args:{texPath:string, workdir:string}) => Promise<{exitCode:number, stdout:string, stderr:string, pdfPath?:string, pdfBytes?:Uint8Array}>} deps.run
 *   Injected toolchain runner. Receives the written `.tex` path and its workdir.
 * @param {string} [deps.tmpDir]  Base dir for the temp workdir (defaults to os.tmpdir()).
 * @returns {{ compile: (input:{latex:string, assets?:{path:string,bytes:Uint8Array}[]}) => Promise<{pdf:Uint8Array, log:string}> }}
 */
export function createTexLiveCompiler({ run, tmpDir } = {}) {
  if (typeof run !== 'function') {
    throw new Error('createTexLiveCompiler: run is required');
  }
  const baseDir = tmpDir || os.tmpdir();

  async function compile({ latex, assets } = {}) {
    // Guard: empty latex rejects WITHOUT touching the runner or the filesystem.
    if (typeof latex !== 'string' || latex.length === 0) {
      throw new Error('TexLiveCompiler: empty LaTeX (nothing to compile)');
    }

    // Fresh, isolated temp workdir per compile.
    const workdir = await fs.mkdtemp(path.join(baseDir, 'abnt-tex-'));
    try {
      const texPath = path.join(workdir, 'main.tex');
      await fs.writeFile(texPath, latex, 'utf8');

      // Write any assets next to the .tex (figures / \input files).
      if (Array.isArray(assets)) {
        for (const asset of assets) {
          if (!asset || typeof asset.path !== 'string') continue;
          const dest = path.join(workdir, asset.path);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.writeFile(dest, Buffer.from(asset.bytes ?? new Uint8Array()));
        }
      }

      const result = await run({ texPath, workdir });
      const { exitCode, stdout = '', stderr = '', pdfPath, pdfBytes } = result || {};
      const log = [stdout, stderr].filter(Boolean).join('\n');

      // Failure: non-zero exit → throw, surfacing the compiler output.
      if (exitCode !== 0) {
        const err = new Error(
          `TexLiveCompiler: compile failed (exit ${exitCode})\n${log}`,
        );
        err.log = log;
        throw err;
      }

      // Read the produced PDF (prefer bytes returned directly, else read pdfPath).
      let pdf;
      if (pdfBytes && pdfBytes.length > 0) {
        pdf = Buffer.from(pdfBytes);
      } else if (pdfPath) {
        try {
          pdf = await fs.readFile(pdfPath);
        } catch {
          pdf = undefined;
        }
      }

      // Exit 0 but no usable pdf → throw (never empty/garbage pdf as success).
      if (!pdf || pdf.length === 0) {
        const err = new Error(
          `TexLiveCompiler: toolchain exited 0 but produced no PDF\n${log}`,
        );
        err.log = log;
        throw err;
      }

      return { pdf, log };
    } finally {
      // Clean up the temp workdir on BOTH success and throw — no leaks.
      await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return { compile };
}

/**
 * DEFAULT production runner: real TeX Live + abntex2 path for the VPS container.
 * Shells out to `latexmk -pdf -interaction=nonstopmode -halt-on-error <tex>` in the
 * workdir and returns the contract shape with the produced .pdf path.
 *
 * NOT exercised by the unit gate (no TeX Live in the sandbox) — importable without
 * invoking. Verified-in-CI is deferred to slice #10 (TeX Live image). The exact CLI
 * flags live HERE, not in the adapter's contract with tests.
 *
 * @returns {(args:{texPath:string, workdir:string}) => Promise<{exitCode:number, stdout:string, stderr:string, pdfPath:string}>}
 */
export function createLatexmkRunner() {
  return async function defaultRun({ texPath, workdir }) {
    const base = path.basename(texPath, '.tex');
    const args = ['-pdf', '-interaction=nonstopmode', '-halt-on-error', texPath];

    const { exitCode, stdout, stderr } = await spawnCollect('latexmk', args, workdir);

    return {
      exitCode,
      stdout,
      stderr,
      pdfPath: path.join(workdir, `${base}.pdf`),
    };
  };
}

/** Convenience default runner instance (real TeX Live path). */
export const defaultRun = createLatexmkRunner();

/**
 * Spawn a child process, collect stdout/stderr, resolve with its exit code.
 * Never rejects on a non-zero exit (the adapter maps exit codes to throws).
 */
function spawnCollect(cmd, args, cwd) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(cmd, args, { cwd });
    } catch (err) {
      resolve({ exitCode: 127, stdout: '', stderr: String(err?.message ?? err) });
      return;
    }
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      resolve({ exitCode: 127, stdout, stderr: `${stderr}${err?.message ?? err}` });
    });
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}
