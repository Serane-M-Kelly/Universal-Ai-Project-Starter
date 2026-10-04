import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, realpath, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { initUnified } from '../dist/commands/workflow.js';
import { synchronizeSkills, upgradeSkill } from '../dist/lib/skills.js';
import { synchronizeModels } from '../dist/lib/workflow-models.js';
import { applyAdapter } from '../dist/lib/adapters.js';
import { addNativeAdapter } from '../dist/lib/native-switch.js';
import { inspectWorkspace } from '../dist/lib/doctor.js';
import { contextSources } from '../dist/lib/context-output.js';
import { hashDirectory } from '../dist/lib/content-hash.js';

const cli = resolve('dist/index.js');
const ROLES = ['planner', 'builder', 'reviewer', 'implementer', 'reader'];
const SKILLS = ['project-start', 'project-discover', 'project-handoff', 'project-setup', 'project-plan',
  'project-next', 'project-phase', 'project-review', 'project-ship'];

async function project(t, adapter, name = 'project') {
  const root = await mkdtemp(join(tmpdir(), 'starter-024-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const w = await initUnified(join(root, name), { name: 'Fixture 024', owner: 'Test fixture', ...(adapter ? { adapter } : {}) });
  return { root, w, code: await realpath(join(root, name, 'app')) };
}
function run(args, cwd) { return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }); }
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text);
  assert.ok(match, 'frontmatter attendu');
  return { data: YAML.parse(match[1]), body: match[2] };
}
/** Content snapshot of the workspace, runtime excluded: proves a refusal wrote nothing. */
async function snapshot(w) {
  const out = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name), ref = relative(w, path).split(sep).join('/');
      if (ref === '.starter/runtime') continue;
      if (entry.isDirectory()) { out[ref + '/'] = 'dir'; await walk(path); }
      else out[ref] = createHash('sha256').update(await readFile(path)).digest('hex');
    }
  }
  await walk(w);
  return out;
}
async function expectCodexGolden(w, code) {
  const golden = resolve('tests/fixtures/codex-native-023');
  assert.equal(await readFile(join(w, '.codex/config.toml'), 'utf8'),
    (await readFile(join(golden, 'config.toml'), 'utf8')).replace('{{CODE_ROOT}}', code));
  for (const role of ROLES)
    assert.equal(await readFile(join(w, `.codex/agents/${role}.toml`), 'utf8'),
      await readFile(join(golden, `agents/${role}.toml`), 'utf8'), `${role}.toml diffère de la 0.23`);
}
async function expectCopies(w, nativeRoot) {
  const config = YAML.parse(await readFile(join(w, 'project.yaml'), 'utf8'));
  assert.deepEqual(config.skills.map(s => s.id).sort(), [...SKILLS].sort());
  for (const skill of config.skills)
    assert.equal(await hashDirectory(join(w, nativeRoot, skill.id)), skill.source_hash, `${nativeRoot}/${skill.id}`);
}

test('0.24 Codex: generated Codex files stay byte-identical to 0.23', async t => {
  const { w, code } = await project(t);
  await expectCodexGolden(w, code);
  assert.equal(await readFile(join(w, 'AGENTS.md'), 'utf8'), await readFile(resolve('tests/fixtures/codex-native-023/AGENTS.md'), 'utf8'));
  await expectCopies(w, '.agents/skills');
  await assert.rejects(lstat(join(w, '.claude')));
  const models = JSON.parse(await readFile(join(w, '.starter/models.json'), 'utf8'));
  assert.deepEqual(models.adapters, ['codex']);
  assert.ok(!JSON.stringify(models).includes('claude_'), 'aucun réglage Claude dans un workspace Codex seul');
});

test('0.24 Claude: settings, role agents, instructions and skills are generated from models.json', async t => {
  const { w, code } = await project(t, 'claude-code');
  const settings = JSON.parse(await readFile(join(w, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.additionalDirectories, [code]);
  assert.equal(settings.permissions.defaultMode, 'default');
  assert.equal(settings.permissions.disableBypassPermissionsMode, 'disable');
  assert.ok(settings.permissions.deny.includes('Read(//**/.env)') && settings.permissions.deny.includes('Edit(//**/secrets/**)'));
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
  assert.equal(settings.sandbox.autoAllowBashIfSandboxed, false);
  assert.ok(!('model' in settings) && !('effortLevel' in settings), 'session model left to the account by default');
  const expected = {
    planner: ['opus', 'high', false], builder: ['inherit', undefined, true], reviewer: ['opus', 'high', false],
    implementer: ['sonnet', 'medium', true], reader: ['haiku', undefined, false],
  };
  for (const [role, [model, effort, writer]] of Object.entries(expected)) {
    const text = await readFile(join(w, `.claude/agents/${role}.md`), 'utf8');
    const { data, body } = frontmatter(text);
    assert.equal(data.name, role);
    assert.equal(data.model, model, role);
    assert.equal(data.effort, effort, role);
    assert.ok(data.description.length > 40 && !data.description.includes('\n'));
    assert.ok(!/gpt-|luna|sol\b/i.test(text), `${role}: aucun identifiant OpenAI`);
    assert.match(body, /--compact/);
    if (writer) {
      assert.deepEqual(data.tools, ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash']);
      assert.equal(data.permissionMode, undefined, 'writers inherit the session permission mode');
    } else {
      assert.deepEqual(data.tools, ['Read', 'Glob', 'Grep', 'Bash']);
      assert.deepEqual(data.disallowedTools, ['Edit', 'Write', 'NotebookEdit']);
      assert.equal(data.permissionMode, 'plan');
    }
  }
  const claudeMd = await readFile(join(w, 'CLAUDE.md'), 'utf8');
  assert.match(claudeMd, /\.starter\/WORKFLOW\.md/);
  assert.match(claudeMd, /\/project-start/);
  assert.match(claudeMd, /sans paramètre `model`/);
  await expectCopies(w, '.claude/skills');
  await assert.rejects(lstat(join(w, '.codex')));
  await assert.rejects(lstat(join(w, 'AGENTS.md')));
  await assert.rejects(lstat(join(code, '.claude')));
  assert.notEqual((await inspectWorkspace(w)).verdict, 'BLOCKED');
});

test('0.24 Claude: auto-approved engine commands never write the workspace', async t => {
  const { w } = await project(t, 'claude-code');
  const settings = JSON.parse(await readFile(join(w, '.claude/settings.json'), 'utf8'));
  const before = await snapshot(w);
  for (const rule of settings.permissions.allow) {
    const prefix = /^Bash\((node \.starter\/run\.mjs .+) \*\)$/.exec(rule);
    assert.ok(prefix, `règle inattendue : ${rule}`);
    const args = prefix[1].split(' ').slice(1);
    const extra = args.includes('doctor') ? ['.', '--json', '--compact'] : args.includes('report') ? ['ev-absent'] : ['--compact'];
    spawnSync(process.execPath, [...args, ...extra], { cwd: w, encoding: 'utf8' });
  }
  assert.deepEqual(await snapshot(w), before);
});

test('0.24 both assistants: one source, two copies, conflicts preserved, upgrade reaches both', async t => {
  const { w, code } = await project(t, 'codex,claude-code');
  await expectCodexGolden(w, code);
  await expectCopies(w, '.agents/skills');
  await expectCopies(w, '.claude/skills');
  for (const file of ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json']) await lstat(join(w, file));
  const source = join(w, 'skills/project-next/SKILL.md');
  await writeFile(source, (await readFile(source, 'utf8')) + '\nPrécision locale.\n');
  assert.equal((await synchronizeSkills(w, false)).replicasUpdated, 2);
  for (const root of ['.agents/skills', '.claude/skills'])
    assert.equal(await readFile(join(w, root, 'project-next/SKILL.md'), 'utf8'), await readFile(source, 'utf8'));
  const claudeCopy = join(w, '.claude/skills/project-next/SKILL.md');
  await writeFile(claudeCopy, (await readFile(claudeCopy, 'utf8')) + '\nRetouche directe.\n');
  await writeFile(source, (await readFile(source, 'utf8')) + '\nSeconde précision.\n');
  const before = await snapshot(w);
  await assert.rejects(synchronizeSkills(w, false), /modifiée séparément/);
  assert.deepEqual(await snapshot(w), before);
  await synchronizeSkills(w, true);
  const config = YAML.parse(await readFile(join(w, 'project.yaml'), 'utf8'));
  config.skills.find(s => s.id === 'project-next').version--;
  await writeFile(join(w, 'project.yaml'), YAML.stringify(config));
  assert.equal((await upgradeSkill(w, 'project-next', false)).replicasUpdated, 2);
  await expectCopies(w, '.agents/skills');
  await expectCopies(w, '.claude/skills');
});

test('0.24 regression: the historical adapter add on a Codex phase workspace now installs every Claude copy', async t => {
  const { w } = await project(t);
  const r = run(['adapter', 'add', 'claude-code', w], w);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const result = JSON.parse(r.stdout);
  assert.equal(result.skills_to_copy.length, 9);
  await expectCopies(w, '.claude/skills');
  await expectCopies(w, '.agents/skills');
  for (const role of ROLES) await lstat(join(w, `.claude/agents/${role}.md`));
  const config = YAML.parse(await readFile(join(w, 'project.yaml'), 'utf8'));
  assert.deepEqual(config.adapters, [], 'no legacy registration in a phase workspace');
  assert.deepEqual(JSON.parse(await readFile(join(w, '.starter/models.json'), 'utf8')).adapters, ['codex', 'claude-code']);
  assert.match(await readFile(join(w, 'CLAUDE.md'), 'utf8'), /## Claude Code/);
  assert.notEqual((await inspectWorkspace(w)).verdict, 'BLOCKED');
  const upgrade = run(['adapter', 'upgrade', 'claude-code', w], w);
  assert.notEqual(upgrade.status, 0);
  assert.match(upgrade.stderr, /models-sync/);
});

test('0.24 repair: a workspace left by the 0.23 adapter add is diagnosed, previewed, then repaired', async t => {
  const { w } = await project(t);
  // Exactly what 0.23 produced: legacy outputs and registration, Claude copies routed to Codex only.
  await applyAdapter(w, 'claude-code');
  await synchronizeSkills(w, false);
  const broken = await inspectWorkspace(w);
  assert.equal(broken.verdict, 'BLOCKED');
  assert.ok(broken.items.some(i => i.code === 'SKILL_REPLICA_MISSING'));
  assert.ok(broken.items.some(i => i.code === 'PHASE_WORKFLOW' && /adapter-add claude-code --dry-run/.test(i.message)));
  const before = await snapshot(w);
  const preview = await addNativeAdapter(w, 'claude-code', true);
  assert.deepEqual(await snapshot(w), before, 'dry-run writes nothing');
  assert.deepEqual(preview.replaced_unmodified_legacy_outputs, ['.claude/settings.json']);
  assert.equal(preview.instructions.action, 'replace-unmodified-legacy');
  const legacyClaudeMd = await readFile(join(w, 'CLAUDE.md'), 'utf8');
  const repaired = await addNativeAdapter(w, 'claude-code', false);
  assert.notEqual(repaired.verdict, 'BLOCKED', JSON.stringify(repaired.blocked));
  await expectCopies(w, '.claude/skills');
  const history = await readdir(join(w, '.starter/history'));
  const savedClaudeMd = history.find(f => f.endsWith('-CLAUDE.md'));
  assert.ok(savedClaudeMd && history.some(f => f.endsWith('-settings.json')) && history.some(f => f.startsWith('models-')));
  assert.equal(await readFile(join(w, '.starter/history', savedClaudeMd), 'utf8'), legacyClaudeMd);
  assert.match(await readFile(join(w, 'CLAUDE.md'), 'utf8'), /\.starter\/WORKFLOW\.md/);
  // Idempotent: a second run changes nothing.
  const after = await snapshot(w);
  const again = await addNativeAdapter(w, 'claude-code', false);
  assert.equal(again.already_installed, true);
  assert.deepEqual(again.skills_to_copy, []);
  assert.deepEqual(Object.keys(await snapshot(w)).sort(), Object.keys(after).sort());
});

test('0.24 repair refuses customised legacy files and copies without writing anything', async t => {
  const { w } = await project(t);
  await applyAdapter(w, 'claude-code');
  await synchronizeSkills(w, false);
  const settingsPath = join(w, '.claude/settings.json');
  const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
  settings.permissions.allow = ['Bash(npm test *)'];
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  await mkdir(join(w, '.claude/skills/project-next'), { recursive: true });
  await writeFile(join(w, '.claude/skills/project-next/SKILL.md'), '---\nname: project-next\ndescription: personnalisation\n---\nCopie retouchée.\n');
  const before = await snapshot(w);
  await assert.rejects(addNativeAdapter(w, 'claude-code', false),
    err => /\.claude\/settings\.json/.test(err.message) && /\.claude\/skills\/project-next/.test(err.message) && /aucun fichier modifié/.test(err.message));
  assert.deepEqual(await snapshot(w), before);
});

test('0.24 repair keeps a personalised instruction file and warns', async t => {
  const { w } = await project(t);
  await writeFile(join(w, 'CLAUDE.md'), '# Mes consignes\n\nRépondre en français.\n');
  const result = await addNativeAdapter(w, 'claude-code', false);
  assert.equal(result.instructions.action, 'keep');
  assert.match(result.instructions.warning, /WORKFLOW\.md/);
  assert.equal(await readFile(join(w, 'CLAUDE.md'), 'utf8'), '# Mes consignes\n\nRépondre en français.\n');
});

test('0.24 the 0.23 models.json switch is diagnosed explicitly and repaired', async t => {
  const { w } = await project(t);
  const path = join(w, '.starter/models.json');
  const models = JSON.parse(await readFile(path, 'utf8'));
  delete models.adapters; models.adapter = 'claude-code';
  await writeFile(path, JSON.stringify(models, null, 2));
  await synchronizeModels(w);
  const report = await inspectWorkspace(w);
  const message = report.items.find(i => i.code === 'PHASE_WORKFLOW' && i.severity === 'blocked')?.message ?? '';
  assert.match(message, /Copies Claude Code absentes dans \.claude\/skills/);
  assert.doesNotMatch(message, /ENOENT/);
  const repaired = await addNativeAdapter(w, 'claude-code', false);
  assert.equal(repaired.already_installed, true);
  assert.notEqual(repaired.verdict, 'BLOCKED', JSON.stringify(repaired.blocked));
  await expectCopies(w, '.claude/skills');
});

test('0.24 switch back: Claude workspace gains Codex with 0.23-identical files', async t => {
  const { w, code } = await project(t, 'claude-code');
  const r = run(['workflow', 'adapter-add', 'codex', '--workspace', w], w);
  assert.equal(r.status, 0, r.stderr);
  await expectCodexGolden(w, code);
  await expectCopies(w, '.agents/skills');
  await expectCopies(w, '.claude/skills');
  assert.equal(await readFile(join(w, 'AGENTS.md'), 'utf8'), await readFile(resolve('tests/fixtures/codex-native-023/AGENTS.md'), 'utf8'));
  const sources = await contextSources(w);
  assert.deepEqual(sources.sources.filter(s => s.required).map(s => s.path).sort(),
    ['.starter/WORKFLOW.md', 'AGENTS.md', 'CLAUDE.md', 'PROJECT_BRIEF.md']);
});

test('0.24 Claude choices are validated before any write; coordinator values reach settings', async t => {
  const { w } = await project(t, 'claude-code');
  const path = join(w, '.starter/models.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  const cases = [
    [m => { m.roles.reader.claude_effort = 'low'; }, /Haiku/],
    [m => { m.roles.reviewer.claude_model = 'claude-opus-4-6'; m.roles.reviewer.claude_effort = 'xhigh'; }, /xhigh/],
    [m => { m.coordinator.claude_effort = 'max'; }, /max se choisit par session/],
    [m => { m.roles.planner.claude_model = 'gpt-6.1-sol'; }, /claude_model invalide/],
    [m => { m.coordinator.claude_model = 'inherit'; }, /claude_model invalide/],
    [m => { m.adapters = ['claude-code', 'claude-code']; }, /sans doublon/],
  ];
  for (const [mutate, error] of cases) {
    const candidate = structuredClone(original); mutate(candidate);
    await writeFile(path, JSON.stringify(candidate, null, 2));
    const before = await snapshot(w);
    await assert.rejects(synchronizeModels(w), error);
    assert.deepEqual(await snapshot(w), before);
  }
  const chosen = structuredClone(original);
  chosen.coordinator.claude_model = 'opus';
  chosen.coordinator.claude_effort = 'high';
  chosen.roles.builder.claude_model = 'sonnet';
  chosen.roles.builder.claude_effort = 'xhigh';
  await writeFile(path, JSON.stringify(chosen, null, 2));
  const result = await synchronizeModels(w);
  assert.equal(result.claude.coordinator.model, 'opus');
  const settings = JSON.parse(await readFile(join(w, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.model, 'opus');
  assert.equal(settings.effortLevel, 'high');
  const builder = frontmatter(await readFile(join(w, '.claude/agents/builder.md'), 'utf8')).data;
  assert.equal(builder.model, 'sonnet');
  assert.equal(builder.effort, 'xhigh');
  // A direct edit of a generated Claude file is never overwritten.
  await writeFile(join(w, '.claude/agents/reader.md'), 'retouche');
  await assert.rejects(synchronizeModels(w), /Personnalisation native détectée : \.claude\/agents\/reader\.md/);
});

test('0.24 relocate updates the Claude additional directory; environment reports Claude overrides', async t => {
  const { root, w } = await project(t, 'codex,claude-code');
  const moved = join(root, 'copie-app');
  await mkdir(moved);
  const r = run(['workflow', 'relocate', '--code-root', moved, '--by', 'Test fixture', '--request', 'Synthetic relocation', '--workspace', w], w);
  assert.equal(r.status, 0, r.stderr);
  const settings = JSON.parse(await readFile(join(w, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.additionalDirectories, [await realpath(moved)]);
  assert.match(await readFile(join(w, '.codex/config.toml'), 'utf8'), new RegExp(JSON.stringify(await realpath(moved)).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
  const env = spawnSync(process.execPath, [cli, 'workflow', 'environment', '--workspace', w],
    { encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SUBAGENT_MODEL: 'haiku', CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' } });
  assert.equal(env.status, 0, env.stderr);
  const report = JSON.parse(env.stdout);
  assert.ok('claude' in report && 'codex' in report);
  assert.deepEqual(report.adapters, ['codex', 'claude-code']);
  assert.equal(report.claude_overrides.CLAUDE_CODE_SUBAGENT_MODEL, 'haiku');
  assert.equal(report.claude_overrides.CLAUDE_CODE_SUBAGENT_MODEL_FORCE, '1');
});
