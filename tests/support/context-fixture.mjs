import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createWorkspace } from '../../dist/lib/workspace.js';
import { loadProfile } from '../../dist/lib/profiles.js';
import { initializeWorkflow, applyPlan, beginPhase, recordProof, loadWorkflow } from '../../dist/lib/phase-workflow.js';
import { stringifyFrontmatter } from '../../dist/lib/frontmatter.js';
export const cli = resolve('dist/index.js');
export function command(w, args) {
  return spawnSync(process.execPath, [cli, 'workflow', ...args, '--workspace', w], { encoding: 'utf8' });
}
export async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'starter-context-'));
  const w = join(base, 'ai-workspace'), code = join(base, 'app');
  const cleanup = () => rm(base, { recursive: true, force: true, maxRetries: 3 });
  try {
    await mkdir(code);
    await writeFile(join(code, 'source.js'), 'export const value=1;\n');
    await createWorkspace({ workspacePath: w, codeRoot: code, repositoryRoot: code, name: 'Context fixture', entryMode: 'existing', profile: await loadProfile('generic') });
    await initializeWorkflow(w);
    await writeFile(join(w, 'PROJECT_BRIEF.md'), stringifyFrontmatter({ schema_version: 1, brief_version: 1, status: 'draft', approved_by: null, approved_at: null, supersedes: null }, '# Fixture\nAucune communication réseau.'));
    const approved = command(w, ['brief-approve', '--by', 'Test fixture', '--request', 'Synthetic fixture approval']);
    if (approved.status !== 0) throw new Error(approved.stderr || approved.stdout);
    const setup = join(base, 'setup.md');
    await writeFile(setup, 'Fixture Node inspectée ; commande de test locale.');
    const configured = command(w, ['setup-record', '--report', setup, '--by', 'Test fixture', '--request', 'Synthetic setup']);
    if (configured.status !== 0) throw new Error(configured.stderr || configured.stdout);
    await applyPlan(w, [{ title: 'Local result', goal: 'Un résultat local', validation: 'Tests puis essai humain', excludes: 'Aucun réseau', tasks: [{ title: 'Automated verification', human: false }, { title: 'Human observation', human: true }] }], 'Test fixture', 'Synthetic plan approval');
    await beginPhase(w, '1', 'Test fixture', 'Synthetic phase authorization');
    const phase = (await loadWorkflow(w)).phases[0];
    async function check(script) {
      return recordProof(w, '1', 'Test runner', 'Synthetic test', 'check', [phase.tasks[0].id], { command: [process.execPath, '-e', script] });
    }
    return { base, w, code, phase, check, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
