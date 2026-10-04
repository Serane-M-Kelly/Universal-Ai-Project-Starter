import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { initUnified } from '../dist/commands/workflow.js';
import { upgradeSkill } from '../dist/lib/skills.js';

for (const adapter of ['codex', 'claude-code']) {
  test(`SEO ${adapter}: reference survives independent installation; old runtime upgrade is refused without mutation`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'starter-seo-'));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    const w = await initUnified(join(root, 'project'), { name: 'SEO fixture', owner: 'Synthetic test', adapter });
    const reference = 'core/contracts/search-visibility.md';
    assert.equal(await readFile(join(w, '.starter/runtime', reference), 'utf8'),
      await readFile(resolve(reference), 'utf8'));
    const native = adapter === 'codex' ? '.agents/skills' : '.claude/skills';
    for (const id of ['project-start', 'project-discover', 'project-setup', 'project-plan', 'project-phase', 'project-review', 'project-ship']) {
      const text = await readFile(join(w, native, id, 'SKILL.md'), 'utf8');
      const references = [...text.matchAll(/`(\.starter\/runtime\/[^`]+\.md)`/g)];
      assert.ok(references.length > 0, `${id}: missing installed reference`);
      for (const [, path] of references) assert.ok((await readFile(join(w, path))).length > 0);
    }
    const packagePath = join(w, '.starter/runtime/package.json');
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    pkg.version = '0.22.0';
    await writeFile(packagePath, JSON.stringify(pkg));
    const paths = ['project.yaml', '.starter/workflow.json', 'skills/project-ship/SKILL.md', `${native}/project-ship/SKILL.md`];
    const before = await Promise.all(paths.map(p => readFile(join(w, p), 'utf8')));
    await assert.rejects(upgradeSkill(w, 'project-ship', false), /requiert le runtime 0\.25\.0/);
    assert.deepEqual(await Promise.all(paths.map(p => readFile(join(w, p), 'utf8'))), before);
  });
}
