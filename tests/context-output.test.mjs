import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, symlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, command } from './support/context-fixture.mjs';
import { compactLog, reportView, contextView, measure, bytes } from '../dist/lib/context-output.js';
import { STATE, loadWorkflow, sourceHash, contract, recordProof, status } from '../dist/lib/phase-workflow.js';
const script = `for(let i=0;i<400;i++) console.log('✔ result '+i+' (1.2ms)'); console.log('ℹ tests 400'); console.error('Warning: inspect configuration');`;
async function setup(t) { const f = await fixture(); t.after(f.cleanup); return f; }

test('context: only recognized successes collapse; diagnostics, unknown formats and stderr survive', async t => {
  const f = await setup(t), proof = await f.check(script);
  const original = await readFile(join(f.w, proof.report), 'utf8');
  const state = await readFile(join(f.w, STATE), 'utf8');
  const compact = await reportView(f.w, proof.proof);
  assert.equal(compact.output.format, 'compact');
  assert.equal(compact.output.content.stderr, 'Warning: inspect configuration\n');
  assert.match(compact.output.content.stdout, /tests 400/);
  assert.equal(compact.output.collapsed_success_lines, 400);
  assert.ok(compact.metrics.saved_bytes > 5000);
  const raw = await reportView(f.w, proof.proof, { raw: true });
  assert.equal(raw.output.content, original);
  assert.equal(await readFile(join(f.w, STATE), 'utf8'), state);
  assert.equal(await readFile(join(f.w, proof.report), 'utf8'), original);
  assert.equal((await loadWorkflow(f.w)).proofs.length, 1);
  assert.equal(compact.metrics.delivered_bytes, bytes(compact.output));
  assert.equal(compact.metrics.model_tokens, null);
  const unknown = '\u001b[32m✔ custom output\u001b[0m\nunknown JSON\nERROR: stop\n';
  assert.equal(compactLog(unknown).text, unknown);
  const warningLine = '✔ warning test (1ms)';
  assert.ok(compactLog(Array(5).fill(warningLine).join('\n')).text.includes(warningLine));
});

test('context: failed check stays failed even when output claims success; read never reruns it', async t => {
  const f = await setup(t);
  const proof = await f.check(script + ' process.exit(7);');
  assert.equal(proof.passed, false);
  const view = await reportView(f.w, proof.proof);
  assert.equal(view.output.format, 'original');
  assert.equal(view.output.proof.passed, false);
  assert.equal(JSON.parse(view.output.content).exit_code, 7);
  const cli = command(f.w, ['report', proof.proof, '--metrics']);
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).output.proof.passed, false);
  assert.equal((await loadWorkflow(f.w)).proofs.length, 1);
  assert.equal((await status(f.w, '1')).status.done.length, 0);
});

test('context: unknown short report falls back to original, observation and review are never summarized', async t => {
  const f = await setup(t);
  const p = await f.check("console.log('unrecognized output')");
  assert.equal((await reportView(f.w, p.proof)).output.format, 'original');
  const observation = await recordProof(f.w, '1', 'Synthetic human', 'Fixture observation only', 'observation', [f.phase.tasks[1].id], { summary: 'Synthetic human result' });
  const v = (await reportView(f.w, observation.proof)).output;
  assert.equal(v.format, 'original');
  assert.equal(JSON.parse(v.content).summary, 'Synthetic human result');
});

test('context: slices reconstruct exact original and Unicode stdout; invalid ranges are refused', async t => {
  const f = await setup(t), p = await f.check("console.log('é🙂漢'.repeat(100))");
  const full = (await reportView(f.w, p.proof, { raw: true })).output.content;
  for (const stream of ['original', 'stdout']) {
    let offset = 0, reconstructed = '';
    do {
      const v = (await reportView(f.w, p.proof, { stream, offset, limit: 17 })).output;
      reconstructed += v.content; offset = v.next_offset;
    } while (offset !== null);
    assert.equal(reconstructed, stream === 'original' ? full : JSON.parse(full).stdout);
  }
  for (const options of [{ stream: 'stdout', offset: -1 }, { stream: 'stdout', limit: 0 }, { stream: 'stdout', offset: 1e9 }, { stream: 'password' }])
    await assert.rejects(reportView(f.w, p.proof, options));
  assert.notEqual(command(f.w, ['report', p.proof, '--limit', '4']).status, 0);
});

test('context: stale proofs remain accessible as historical; active contract, baseline and human tasks stay complete', async t => {
  const f = await setup(t);
  for (let i = 0; i < 8; i++) await f.check("console.log('old fixture')");
  const old = (await loadWorkflow(f.w)).proofs[0];
  await writeFile(join(f.code, 'source.js'), 'export const value=2;\n');
  const current = await f.check("console.log('current fixture')");
  const raw = await status(f.w, '1'), reduced = await contextView(f.w, '1');
  assert.deepEqual(reduced.output.phase, raw.phase);
  assert.equal(reduced.output.historical_proofs_omitted, 8);
  assert.equal(reduced.output.proofs.length, 1);
  assert.equal(reduced.output.proofs[0].id, current.proof);
  assert.equal(reduced.output.status.done.includes(f.phase.tasks[1].id), false);
  assert.equal((await reportView(f.w, old.id)).output.matches_current_code, false);
  assert.ok(reduced.metrics.saved_bytes > 0);
  const result = command(f.w, ['context', '1', '--compact', '--metrics']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).output.historical_proofs_omitted, 8);
});

test('context: later negative review is visible and blocks; stale latest review is explicitly retained', async t => {
  const f = await setup(t);
  await f.check(script);
  const report = join(f.base, 'review.json');
  await writeFile(report, JSON.stringify({ code_hash: await sourceHash(f.w), contract_hash: contract(f.phase), summary: 'Synthetic finding', findings: ['Must correct'], checks: [] }));
  const review = await recordProof(f.w, '1', 'Independent fixture', 'Synthetic review', 'review', [], { report, verdict: 'changes_required', independent: true });
  let view = (await contextView(f.w, '1')).output;
  assert.equal(view.status.review, false);
  assert.ok(view.proofs.some(p => p.id === review.proof && !p.passed));
  assert.equal((await reportView(f.w, review.proof)).output.format, 'original');
  for(let i=0;i<5;i++) await f.check("console.log('old')");
  await writeFile(join(f.code, 'source.js'), 'export const value=3;');
  view = (await contextView(f.w, '1')).output;
  assert.equal(view.latest_review_if_historical.id, review.proof);
  assert.equal(view.status.review, false);
});

test('context: report tampering, missing files and links cannot become verified summaries', async t => {
  const f = await setup(t), p = await f.check(script);
  const path = join(f.w, p.report), original = await readFile(path);
  await writeFile(path, '{}');
  await assert.rejects(reportView(f.w, p.proof), /Rapport modifié/);
  assert.equal((await contextView(f.w, '1')).output.status.done.length, 0);
  await writeFile(path, original);
  const outside = join(f.base, 'outside.json'); await rename(path, outside);
  await assert.rejects(reportView(f.w, p.proof));
  await symlink(outside, path);
  await assert.rejects(reportView(f.w, p.proof), /Lien symbolique/);
  await assert.rejects(reportView(f.w, '../../outside.json'), /Preuve inconnue/);
});

test('context: a source-mutating successful process cannot be compacted into success', async t => {
  const f = await setup(t);
  const p = await f.check(script + "require('node:fs').writeFileSync('source.js','changed');");
  assert.equal(p.passed, false);
  const v = (await reportView(f.w, p.proof)).output;
  assert.equal(v.proof.passed, false);
  assert.equal(v.format, 'original');
  assert.equal(JSON.parse(v.content).source_unchanged, false);
});

test('context: small status does not grow; byte metrics can show negative savings', async t => {
  const f = await setup(t), before = await readFile(join(f.w, STATE));
  const view = await contextView(f.w);
  assert.ok(view.metrics.saved_bytes >= 0);
  assert.deepEqual(await readFile(join(f.w, STATE)), before);
  assert.equal(measure('a', 'longer').saved_bytes, -5);
});

test('context: rule fingerprints detect changes without treating a hash as an approval', async t => {
  const { contextSources } = await import('../dist/lib/context-output.js');
  const f = await setup(t);
  const original = await contextSources(f.w);
  const before = original.sources.find(s => s.path === 'PROJECT_BRIEF.md');
  await writeFile(join(f.w, 'PROJECT_BRIEF.md'), 'Changed draft');
  const after = (await contextSources(f.w)).sources.find(s => s.path === 'PROJECT_BRIEF.md');
  assert.notEqual(before.sha256, after.sha256);
  assert.equal((await status(f.w)).brief_approved, false);
  assert.equal(original.sources.find(s => s.path === 'AGENTS.md').state, 'missing');
});
