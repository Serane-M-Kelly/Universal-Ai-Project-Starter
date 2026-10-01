/** Reproducible synthetic reading benchmark; not a model-usage benchmark or product acceptance. */
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from '../tests/support/context-fixture.mjs';
import { recordProof, STATE, status } from '../dist/lib/phase-workflow.js';
import { reportView, contextView, bytes } from '../dist/lib/context-output.js';
const f = await fixture();
try {
  await writeFile(join(f.code, 'checks.test.mjs'), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {value} from './source.js';\nfor(let i=0;i<400;i++) test('fixture case '+i,()=>assert.equal(value+i,1+i));\n`);
  const p = await recordProof(f.w, '1', 'Benchmark fixture', 'Synthetic volume benchmark', 'check', [f.phase.tasks[0].id], { command: [process.execPath, '--test', '--test-reporter=spec', 'checks.test.mjs'] });
  if (!p.passed) throw new Error('Benchmark test command failed');
  const compact = await reportView(f.w, p.proof);
  const full = await reportView(f.w, p.proof, { raw: true });
  const details = await reportView(f.w, p.proof, { stream: 'stdout', offset: 0, limit: 1500 });
  for(let i=0;i<8;i++) await f.check('if(2+2!==4)process.exit(1)');
  await writeFile(join(f.code, 'source.js'), 'export const value=1; // changed revision\n');
  await f.check('if(2+2!==4)process.exit(1)');
  const context = await contextView(f.w, '1');
  const report = {
    scenario: 'Synthetic fixture: 400 actual node:test checks, spec reporter; then a phase with 9 historical proofs and 1 current proof.',
    measured_at: new Date().toISOString(), node: process.version, platform: process.platform,
    model_called: false, actual_model_tokens: null, monetary_savings: null,
    measurement: 'UTF-8 JSON payload bytes (2-space indentation); metadata included, metrics envelope excluded. CLI adds one newline per response.',
    already_short_check_response_bytes: bytes(p),
    check_report_original_file_bytes: Buffer.byteLength(await readFile(join(f.w,p.report),'utf8')),
    report_read: compact.metrics,
    report_plus_one_detail_read: {
      delivered_bytes: bytes(compact.output)+bytes(details.output),
      saved_vs_full_read_bytes: bytes(full.output)-bytes(compact.output)-bytes(details.output)
    },
    report_then_full_read: {
      delivered_bytes: bytes(compact.output)+bytes(full.output),
      extra_vs_full_read_bytes: bytes(compact.output),
      note: 'Reading compact then all details costs more than reading the original once.'
    },
    phase_context: context.metrics,
    constraints_preserved: ['complete phase contract','baseline','human tasks','current proofs including failures','latest historical review if applicable'],
    limits: ['This is not a complete agent session.', 'No bill, quota or token percentage can be inferred.', 'Unrecognized formats and failed checks are not compressed.', 'No gain if the agent never needed the full report.']
  };
  const serialized = JSON.stringify(report,null,2)+'\n';
  if(process.argv[2]) await writeFile(process.argv[2],serialized);
  process.stdout.write(serialized);
} finally { await f.cleanup(); }
