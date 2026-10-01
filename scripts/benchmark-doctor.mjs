/** Synthetic output measurement; preserves checks and exit code. No model is called. */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initUnified } from '../dist/commands/workflow.js';
const base = await mkdtemp(join(tmpdir(), 'starter-doctor-benchmark-'));
try {
  const w = await initUnified(join(base, 'fixture'), { name: 'Doctor benchmark fixture', owner: 'Synthetic fixture' });
  const run = compact => spawnSync(process.execPath, [resolve('dist/index.js'), 'doctor', w, '--json', ...(compact ? ['--compact'] : [])], { encoding: 'utf8' });
  const full = run(false), short = run(true);
  assert.equal(short.status, full.status);
  const original = JSON.parse(full.stdout), compact = JSON.parse(short.stdout);
  assert.deepEqual(compact.items, original.items.filter(item => item.severity !== 'ok'));
  assert.equal(compact.verdict, original.verdict);
  const originalBytes = Buffer.byteLength(full.stdout), deliveredBytes = Buffer.byteLength(short.stdout);
  const result = { scenario: 'New synthetic phase workspace, no Git repository', measured_at: new Date().toISOString(), node: process.version, platform: process.platform,
    measurement: 'UTF-8 bytes of CLI stdout JSON including final newline', original_bytes: originalBytes, delivered_bytes: deliveredBytes,
    saved_bytes: originalBytes - deliveredBytes, reduction_percent: Math.round((1 - deliveredBytes / originalBytes) * 10000) / 100,
    verdict: compact.verdict, exit_code: short.status, ok_count: compact.ok_count, non_ok_count: compact.items.length,
    model_called: false, actual_model_tokens: null, monetary_savings: null };
  const output = JSON.stringify(result, null, 2) + '\n';
  if (process.argv[2]) await writeFile(process.argv[2], output);
  process.stdout.write(output);
} finally { await rm(base, { recursive: true, force: true, maxRetries: 3 }); }
