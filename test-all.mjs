// Dark-factory unit-test entrypoint. Runs every test file in one node process
// and fails (exit 1) if ANY child fails — so the sandbox `unit-tests` gate is red
// until all pass. Conservador: no test framework dep, just node:child_process.
// Add new test files to the list below.
import { spawnSync } from 'node:child_process';

const files = [
  'test-smoke.mjs',
  'tests/format-thesis-usecase.test.mjs',
  'tests/llm-adapters.test.mjs',
  'tests/latex-compiler.test.mjs',
  'tests/stripe-gateway.test.mjs',
  'tests/payment-flow.test.mjs',
  'tests/jobstore.test.mjs',
];

let failed = 0;
for (const file of files) {
  console.log(`\n===== ${file} =====`);
  const res = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed += 1;
    console.error(`>>> FAILED: ${file} (exit ${res.status})`);
  }
}

console.log(`\n===== gate: ${files.length - failed}/${files.length} test files passed =====`);
process.exit(failed > 0 ? 1 : 0);
