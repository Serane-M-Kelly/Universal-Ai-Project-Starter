import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { initUnified } from '../dist/commands/workflow.js';
import { synchronizeSkills, installSkill, upgradeSkill } from '../dist/lib/skills.js';
import { inspectWorkspace, compactDiagnostic, exitCodeFor } from '../dist/lib/doctor.js';
import { createWorkspace } from '../dist/lib/workspace.js';
import { loadProfile } from '../dist/lib/profiles.js';
import { fingerprintSource } from '../dist/lib/phase-sources.js';
import { contextSources, reportView, contextView } from '../dist/lib/context-output.js';
import { fixture, command } from './support/context-fixture.mjs';
import { applyPlan, beginPhase, loadWorkflow, status, recordProof, sourceHash, contract } from '../dist/lib/phase-workflow.js';
const cli = resolve('dist/index.js');
function run(w, args) { return spawnSync(process.execPath, [cli, ...args, w], { encoding: 'utf8' }); }
async function base(t) {
  const dir = await mkdtemp(join(tmpdir(), 'starter-022-'));
  t.after(() => rm(dir, { recursive: true, force: true, maxRetries: 3 }));
  return dir;
}
async function designFixture(t) {
  const f = await fixture(); t.after(f.cleanup);
  await mkdir(join(f.w, 'design'));
  await writeFile(join(f.w, 'design/INDEX.md'), 'Synthetic design revision one');
  const { path, sha256 } = await fingerprintSource(f.w, 'design/INDEX.md');
  await applyPlan(f.w, [{ ...f.phase, sources: [{ path, sha256 }] }], 'Test fixture', 'Synthetic revised scope', true);
  await beginPhase(f.w, '1', 'Test fixture', 'Synthetic phase authorization');
  f.phase = (await loadWorkflow(f.w)).phases[0];
  return f;
}

for (const adapter of ['codex', 'claude-code']) test(`skills v3: ${adapter} add, sync and upgrade use native copies and preserve conflicts`, async t => {
  const dir = await base(t), w = await initUnified(join(dir, 'new'), { name: 'Fixture', owner: 'Test fixture', adapter });
  const nativeRoot = adapter === 'codex' ? '.agents/skills' : '.claude/skills';
  const source = join(w, 'skills/project-next/SKILL.md'), native = join(w, nativeRoot, 'project-next/SKILL.md');
  await writeFile(source, (await readFile(source, 'utf8')) + '\nLocal fixture clarification.\n');
  assert.equal((await synchronizeSkills(w, false)).replicasUpdated, 1);
  assert.equal(await readFile(source, 'utf8'), await readFile(native, 'utf8'));
  assert.notEqual((await inspectWorkspace(w)).verdict, 'BLOCKED');
  const configBefore = await readFile(join(w, 'project.yaml'), 'utf8');
  await writeFile(native, (await readFile(native, 'utf8')) + '\nIndependent customization.\n');
  await writeFile(source, (await readFile(source, 'utf8')) + '\nSecond clarification.\n');
  await assert.rejects(synchronizeSkills(w, false), /modifiée séparément/);
  assert.equal(await readFile(join(w, 'project.yaml'), 'utf8'), configBefore);
  assert.match(await readFile(native, 'utf8'), /Independent customization/);
  await synchronizeSkills(w, true);
  let config = YAML.parse(await readFile(join(w, 'project.yaml'), 'utf8'));
  const ref = config.skills.find(s => s.id === 'project-next'); ref.version--;
  await writeFile(join(w, 'project.yaml'), YAML.stringify(config));
  await upgradeSkill(w, 'project-next', false);
  assert.equal(await readFile(source, 'utf8'), await readFile(native, 'utf8'));
  assert.doesNotMatch(await readFile(source, 'utf8'), /Local fixture/);
  // Re-add a deliberately removed optional entry through the same public API as the CLI.
  config = YAML.parse(await readFile(join(w, 'project.yaml'), 'utf8'));
  config.skills = config.skills.filter(s => s.id !== 'project-next');
  await writeFile(join(w, 'project.yaml'), YAML.stringify(config));
  await rm(join(w, 'skills/project-next'), { recursive: true });
  await rm(join(w, nativeRoot, 'project-next'), { recursive: true });
  assert.equal((await installSkill(w, 'project-next')).replicasUpdated, 1);
  assert.notEqual((await inspectWorkspace(w)).verdict, 'BLOCKED');
  await assert.rejects(installSkill(w, 'project-work'), /pas compatible/);
  const models = JSON.parse(await readFile(join(w, '.starter/models.json'), 'utf8'));
  assert.equal(models.coordinator.model, 'gpt-6.1-sol');
  if (adapter === 'claude-code') assert.match(await readFile(join(w, '.claude/agents/builder.md'), 'utf8'), /model: inherit/);
  // An external distribution must not upgrade skills past the runtime's capabilities.
  const runtime = join(w, '.starter/runtime/package.json');
  const pkg = JSON.parse(await readFile(runtime, 'utf8')); pkg.version = '0.21.0';
  await writeFile(runtime, JSON.stringify(pkg));
  await assert.rejects(upgradeSkill(w, 'project-next', true), /requiert le runtime/);
});

test('legacy skills route explicitly; phase-only skills refuse without mutation', async t => {
  const dir = await base(t), w = join(dir, 'legacy'), code = join(dir, 'app'); await mkdir(code);
  await createWorkspace({ workspacePath: w, codeRoot: code, repositoryRoot: code, name: 'Fixture', entryMode: 'existing', profile: await loadProfile('generic') });
  for (const id of ['project-discover','project-handoff','project-setup','project-plan','project-ship']) {
    await installSkill(w, id);
    assert.match(await readFile(join(w, 'skills', id, 'SKILL.md'), 'utf8'), /Sans .*workflow.json.*procédure historique/);
  }
  const before = await readFile(join(w, 'project.yaml'), 'utf8');
  await assert.rejects(installSkill(w, 'project-phase'), /Migrer/);
  assert.equal(await readFile(join(w, 'project.yaml'), 'utf8'), before);
});

test('Doctor compact preserves all non-positive diagnostics and public exit codes', async t => {
  const dir = await base(t), w = await initUnified(join(dir, 'new'), { name: 'Fixture', owner: 'Test fixture' });
  for (const blocked of [false, true]) {
    if (blocked) await writeFile(join(w, '.agents/skills/project-next/SKILL.md'), 'Changed native copy');
    const full = run(w, ['doctor', '--json']), short = run(w, ['doctor', '--json', '--compact']);
    assert.equal(short.status, full.status);
    const a = JSON.parse(full.stdout), b = JSON.parse(short.stdout);
    assert.equal(b.verdict, a.verdict);
    assert.deepEqual(b.items, a.items.filter(i => i.severity !== 'ok'));
    assert.equal(b.ok_count, a.items.filter(i => i.severity === 'ok').length);
    assert.ok(Buffer.byteLength(short.stdout) < Buffer.byteLength(full.stdout));
    assert.equal(short.status, blocked ? 2 : 1);
  }
  const ok = { workspace: w, verdict: 'OK', items: [{ severity: 'ok', code: 'X', message: 'OK' }] };
  assert.equal(exitCodeFor(ok), 0); assert.equal(compactDiagnostic(ok).items.length, 0);
});

test('PA/AD source changes block proof, acceptance and resumption; revision requires active arbitration', async t => {
  const f = await designFixture(t), proof = await f.check("console.log('Synthetic check')");
  const before = await contextSources(f.w);
  assert.equal(before.phase_references[0].current, true);
  await writeFile(join(f.w, 'design/INDEX.md'), 'Synthetic design revision two');
  const context = await status(f.w, '1');
  assert.equal(context.status.state, 'blocked'); assert.equal(context.source_references[0].current, false);
  assert.equal((await contextView(f.w, '1')).output.source_references[0].current, false);
  assert.equal((await reportView(f.w, proof.proof)).output.matches_current_sources, false);
  await assert.rejects(f.check("console.log('Not run')"), /Références modifiées/);
  await assert.rejects(beginPhase(f.w, '1', 'Test fixture', 'Resume'), /Références modifiées/);
  assert.notEqual(command(f.w, ['accept', '1', '--by', 'Test fixture', '--request', 'Synthetic']).status, 0);
  const { path, sha256 } = await fingerprintSource(f.w, 'design/INDEX.md');
  await assert.rejects(applyPlan(f.w, [{ ...f.phase, sources: [{ path, sha256 }] }], 'Test fixture', 'Change'), /phase active/);
  await applyPlan(f.w, [{ ...f.phase, sources: [{ path, sha256 }] }], 'Test fixture', 'Synthetic approved change', true);
  assert.equal((await loadWorkflow(f.w)).active, null);
  assert.equal((await loadWorkflow(f.w)).phases[0].mandate, null);
  await beginPhase(f.w, '1', 'Test fixture', 'Synthetic new authorization');
  assert.equal((await status(f.w, '1')).status.done.length, 0);
  assert.equal((await f.check("console.log('Synthetic new check')")).passed, true);
});

test('reference changed during a successful check cannot produce a passing proof', async t => {
  const f = await designFixture(t);
  const proof = await f.check(`require('node:fs').writeFileSync(${JSON.stringify(join(f.w, 'design/INDEX.md'))},'Changed during check')`);
  assert.equal(proof.passed, false);
  const report = await reportView(f.w, proof.proof);
  assert.equal(JSON.parse(report.output.content).references_unchanged, false);
});

test('source paths reject escapes and links; missing files fail; omission preserves references', async t => {
  const f = await designFixture(t);
  for (const path of ['../app/source.js', '/etc/passwd', 'C:\\temp\\x', 'design/../PROJECT_BRIEF.md'])
    await assert.rejects(fingerprintSource(f.w, path));
  await symlink(join(f.w, 'design/INDEX.md'), join(f.w, 'design/link.md'));
  await assert.rejects(fingerprintSource(f.w, 'design/link.md'), /symboliquement/);
  const { sources, ...withoutSources } = f.phase;
  await applyPlan(f.w, [withoutSources], 'Test fixture', 'Keep plan');
  assert.deepEqual((await loadWorkflow(f.w)).phases[0].sources, sources);
  const output = command(f.w, ['sources', '--path', 'design/INDEX.md']);
  assert.equal(output.status, 0); assert.equal(JSON.parse(output.stdout).requested[0].sha256, sources[0].sha256);
  await rm(join(f.w, 'design/INDEX.md'));
  assert.equal((await status(f.w, '1')).status.state, 'blocked');
  await assert.rejects(f.check("console.log('Not run')"), /Références modifiées/);
});

test('accepted design stays historical but a changed reference prevents commit preparation', async t => {
  const f = await designFixture(t);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: f.code, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init'); git('config', 'user.name', 'Synthetic fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('add', 'source.js'); git('commit', '-m', 'Synthetic baseline');
  await writeFile(join(f.code, 'source.js'), 'export const value=2;\n');
  await f.check("console.log('Synthetic check')");
  await recordProof(f.w, '1', 'Synthetic human', 'Fixture observation', 'observation', [f.phase.tasks[1].id], { summary: 'Synthetic observation' });
  const report = join(f.base, 'review.json');
  await writeFile(report, JSON.stringify({ code_hash: await sourceHash(f.w), contract_hash: contract(f.phase), summary: 'Synthetic review', findings: [], checks: [] }));
  await recordProof(f.w, '1', 'Synthetic reviewer', 'Fixture review', 'review', [], { report, verdict: 'passed', independent: true });
  assert.equal(command(f.w, ['accept', '1', '--by', 'Test fixture', '--request', 'Synthetic acceptance']).status, 0);
  const args = ['prepare-commit', '1', '--path', 'source.js', '--message', 'Synthetic change'];
  assert.equal(command(f.w, args).status, 0);
  await writeFile(join(f.w, 'design/INDEX.md'), 'Changed after acceptance');
  assert.equal((await status(f.w, '1')).status.state, 'accepted');
  const result = command(f.w, args); assert.notEqual(result.status, 0); assert.match(result.stderr, /Références modifiées/);
});
