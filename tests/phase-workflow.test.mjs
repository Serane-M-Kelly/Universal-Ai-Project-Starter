import test from "node:test";
import YAML from "yaml";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createWorkspace } from "../dist/lib/workspace.js";
import { loadProfile } from "../dist/lib/profiles.js";
import {
  initializeWorkflow,
  applyPlan,
  loadWorkflow,
  beginPhase,
  sourceHash,
  recordProof,
  status,
  contract,
  hash,
  mutateWorkflow,
  phaseStatus,
} from "../dist/lib/phase-workflow.js";
import { initUnified } from "../dist/commands/workflow.js";
import { synchronizeModels } from "../dist/lib/workflow-models.js";
import { stringifyFrontmatter } from "../dist/lib/frontmatter.js";
const cli = resolve("dist/index.js");
function cmd(w, args) {
  return spawnSync(
    process.execPath,
    [cli, "workflow", ...args, "--workspace", w],
    { encoding: "utf8" },
  );
}
async function fixture(t, aliasParent = false) {
  const base = await mkdtemp(join(tmpdir(), "starter-phase-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  let parent = base;
  if (aliasParent) {
    await mkdir(join(base, "real"));
    await symlink(join(base, "real"), join(base, "alias"), process.platform === "win32" ? "junction" : "dir");
    parent = join(base, "alias");
  }
  const code = join(parent, "app"),
    w = join(parent, "ai-workspace");
  await mkdir(code);
  await writeFile(join(code, "calc.js"), "export const add=(a,b)=>a+b;\n");
  await createWorkspace({
    workspacePath: w,
    codeRoot: code,
    repositoryRoot: code,
    name: "Fixture",
    entryMode: "existing",
    profile: await loadProfile("generic"),
  });
  await initializeWorkflow(w);
  await writeFile(
    join(w, "PROJECT_BRIEF.md"),
    stringifyFrontmatter(
      {
        schema_version: 1,
        brief_version: 1,
        status: "draft",
        approved_by: null,
        approved_at: null,
        supersedes: null,
      },
      "# Calculatrice\nAddition locale. Critères : additionner correctement. Pas de réseau.",
    ),
  );
  assert.equal(
    cmd(w, [
      "brief-approve",
      "--by",
      "Kelly",
      "--request",
      "J’approuve ce brief de fixture.",
    ]).status,
    0,
  );
  const report = join(base, "setup.md");
  await writeFile(report, "Socle JavaScript inspecté. Test node disponible.");
  assert.equal(
    cmd(w, [
      "setup-record",
      "--report",
      report,
      "--by",
      "builder",
      "--request",
      "Préparer le socle.",
    ]).status,
    0,
  );
  await applyPlan(
    w,
    [
      {
        title: "Addition",
        goal: "Additionner deux nombres",
        validation: "Positifs et négatifs corrects",
        tasks: [
          { title: "Vérifier l’addition", human: false },
          { title: "Essai réel", human: true },
        ],
      },
    ],
    "Kelly",
    "Construire cette addition.",
  );
  return { w, base, code };
}
async function runCheck(w, p) {
  return recordProof(
    w,
    p.id,
    "builder",
    "Vérifier la phase",
    "check",
    [p.tasks[0].id],
    {
      command: [
        process.execPath,
        "--input-type=module",
        "-e",
        "import {add} from './calc.js'; if(add(2,3)!==5||add(-2,-3)!==-5) process.exit(1)",
      ],
    },
  );
}
async function review(w, p, base, verdict = "passed") {
  const context = await status(w, p.id);
  const report = join(base, "review.json");
  await writeFile(
    report,
    JSON.stringify({
      code_hash: context.code_hash,
      contract_hash: context.contract_hash,
      summary:
        "Revue synthétique de fixture : assertions et addition examinées.",
    }),
  );
  return recordProof(
    w,
    p.id,
    "reviewer-fixture",
    "Examiner l’addition",
    "review",
    [],
    { report, verdict, independent: true },
  );
}
test("phase workflow: checks, human observation, independent review, acceptance and cold resume", async (t) => {
  const { w, base } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise la phase 1.");
  assert.equal((await beginPhase(w, p.id, "Kelly", "Reprends.")).reused, true);
  await runCheck(w, p);
  await review(w, p, base);
  assert.equal(
    cmd(w, ["accept", "1", "--by", "Kelly", "--request", "J’accepte."]).status,
    2,
  );
  await recordProof(
    w,
    p.id,
    "Kelly",
    "Observation synthétique réservée au test",
    "observation",
    [p.tasks[1].id],
    { summary: "Résultat de fixture observé." },
  );
  assert.equal(
    cmd(w, [
      "accept",
      "1",
      "--by",
      "Kelly",
      "--request",
      "J’accepte cette fixture.",
    ]).status,
    0,
  );
  const resumed = JSON.parse(cmd(w, ["status"]).stdout);
  assert.equal(resumed.phases[0].state, "accepted");
  assert.equal(resumed.active, null);
});
test("phase workflow: begin does not auto-review, auto-accept or start another phase", async (t) => {
  const { w } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise seulement la phase 1.");
  const current = await loadWorkflow(w);
  assert.equal(current.proofs.length, 0);
  assert.equal(current.phases[0].acceptance, null);
  assert.equal(current.active, p.id);
  const s = await status(w, p.id);
  assert.equal(s.status.review, false);
  assert.equal(
    cmd(w, ["accept", "1", "--by", "Kelly", "--request", "Accepte."]).status,
    2,
    "La phase en cours ne suffit pas à autoriser une acceptation par le moteur.",
  );
});

test("phase workflow: failed check then correction invalidates earlier code evidence", async (t) => {
  const { w, code } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await writeFile(join(code, "calc.js"), "export const add=(a,b)=>a-b;");
  assert.equal((await runCheck(w, p)).passed, false);
  await writeFile(join(code, "calc.js"), "export const add=(a,b)=>a+b;");
  assert.equal((await runCheck(w, p)).passed, true);
  assert.equal((await status(w)).backlog_refresh_needed, false);
  await writeFile(join(code, "unrelated.js"), "// source changed");
  const st = await phaseStatus(
    w,
    await loadWorkflow(w),
    p,
    await sourceHash(w),
  );
  assert.deepEqual(st.done, []);
  assert.equal((await status(w)).backlog_refresh_needed, true);
});
test("phase workflow: cannot replace human observation with a test", async (t) => {
  const { w } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await assert.rejects(
    () =>
      recordProof(w, p.id, "builder", "Test", "check", [p.tasks[1].id], {
        command: [process.execPath, "-e", ""],
      }),
    /humain/,
  );
});
test("phase workflow: future addition preserves mandate; active scope change needs decision", async (t) => {
  const { w } = await fixture(t);
  let p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await applyPlan(
    w,
    [p, { title: "Soustraction", goal: "Soustraire", tasks: [] }],
    "Kelly",
    "Ajoute la soustraction plus tard.",
  );
  p = (await loadWorkflow(w)).phases[0];
  assert.ok(p.mandate);
  await assert.rejects(
    () =>
      applyPlan(
        w,
        [{ ...p, goal: "Multiplier" }],
        "Kelly",
        "Change le produit.",
      ),
    /active/,
  );
  await applyPlan(
    w,
    [{ ...p, goal: "Multiplier" }],
    "Kelly",
    "Remplace la phase active.",
    true,
  );
  assert.equal((await loadWorkflow(w)).active, null);
});
test("phase workflow: discovered technical task retains mandate and can be completed", async (t) => {
  const { w } = await fixture(t);
  let p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  const r = cmd(w, [
    "task-add",
    "1",
    "--summary",
    "Vérifier zéro",
    "--reason",
    "Cas nécessaire au même résultat",
    "--by",
    "Kelly",
    "--request",
    "Réalise cette phase.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  p = (await loadWorkflow(w)).phases[0];
  assert.equal(p.mandate.hash, contract(p));
  assert.equal(p.tasks.length, 3);
});
test("phase workflow: reopening dependency revokes dependent and old proofs", async (t) => {
  const { w } = await fixture(t);
  let p = (await loadWorkflow(w)).phases[0];
  await applyPlan(
    w,
    [
      p,
      {
        title: "Suite",
        goal: "Réutiliser addition",
        depends_on: [p.id],
        tasks: [],
      },
    ],
    "Kelly",
    "Plan de fixture.",
  );
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await runCheck(w, p);
  assert.equal(
    cmd(w, ["reopen", "1", "--by", "Kelly", "--request", "Résultat à revoir"])
      .status,
    0,
  );
  await beginPhase(w, p.id, "Kelly", "Reprends.");
  p = (await loadWorkflow(w)).phases[0];
  assert.deepEqual(
    (await phaseStatus(w, await loadWorkflow(w), p, await sourceHash(w))).done,
    [],
  );
});
test("phase workflow: manual view is archived, never treated as plan or evidence", async (t) => {
  const { w } = await fixture(t);
  await writeFile(
    join(w, "BACKLOG.md"),
    "# Ma modification\n- [x] Tout terminé",
  );
  assert.equal(
    cmd(w, ["begin", "1", "--by", "Kelly", "--request", "Réalise."]).status,
    2,
  );
  const r = cmd(w, [
    "repair-view",
    "--by",
    "Kelly",
    "--request",
    "Rétablis la vue.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await loadWorkflow(w)).proofs.length, 0);
  assert.match(await readFile(join(w, "BACKLOG.md"), "utf8"), /Addition/);
});
test("phase workflow: report must name exact code and contract; later negative review blocks", async (t) => {
  const { w, base } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  const bad = join(base, "bad.json");
  await writeFile(
    bad,
    JSON.stringify({
      code_hash: "wrong",
      contract_hash: contract(p),
      summary: "review",
    }),
  );
  await assert.rejects(
    () =>
      recordProof(w, p.id, "reviewer", "Revue", "review", [], {
        report: bad,
        independent: true,
      }),
    /empreintes/,
  );
  await runCheck(w, p);
  await recordProof(
    w,
    p.id,
    "Kelly",
    "Observation de fixture",
    "observation",
    [p.tasks[1].id],
    { summary: "Fixture." },
  );
  await review(w, p, base);
  await review(w, p, base, "changes_required");
  assert.equal(
    (await phaseStatus(w, await loadWorkflow(w), p, await sourceHash(w))).state,
    "ready_for_review",
  );
});
test("phase workflow: Swift build links ignored, source changes tracked and source links refused", async (t) => {
  const { w, code } = await fixture(t);
  const before = await sourceHash(w);
  await mkdir(join(code, "app/BuildArtifacts/SharedKitBuild"), {
    recursive: true,
  });
  await symlink(
    "missing",
    join(code, "app/BuildArtifacts/SharedKitBuild/debug"),
  );
  assert.equal(before, await sourceHash(w));
  await symlink("calc.js", join(code, "source-link"));
  await assert.rejects(() => sourceHash(w), /symbolique/);
});
test("phase workflow: lock and command changing sources refuse false completion", async (t) => {
  const { w } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await mkdir(join(w, ".starter/write.lock"));
  await assert.rejects(() => runCheck(w, p), /occupé/);
  await rm(join(w, ".starter/write.lock"), { recursive: true });
  const proof = await recordProof(
    w,
    p.id,
    "builder",
    "Contrôle de fixture",
    "check",
    [p.tasks[0].id],
    {
      command: [
        process.execPath,
        "-e",
        "require('fs').writeFileSync('changed.txt','source')",
      ],
    },
  );
  assert.equal(proof.passed, false);
  const report = JSON.parse(await readFile(join(w, proof.report), "utf8"));
  assert.equal(report.environment.node, process.version);
  assert.equal(report.source_unchanged, false);
});
test("phase workflow: init installs nine skills and native defaults; customization preserved", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "starter-install-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const w = await initUnified(join(base, "project"), {
    name: "Projet",
    owner: "Kelly",
  });
  assert.match(
    await readFile(join(w, ".codex/agents/reviewer.toml"), "utf8"),
    /model_reasoning_effort = "high"/,
  );
  assert.match(
    await readFile(join(w, ".agents/skills/project-plan/SKILL.md"), "utf8"),
    /Product Owner/,
  );
  const r = spawnSync(
    process.execPath,
    [join(w, ".starter/run.mjs"), "workflow", "status"],
    { cwd: w, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  const config = join(w, ".codex/config.toml");
  await writeFile(
    config,
    (await readFile(config, "utf8")) + "\n# personnalisation",
  );
  await assert.rejects(() => synchronizeModels(w), /Personnalisation/);
});
test("phase workflow: a failed later control does not reuse a previous pass", async (t) => {
  const { w } = await fixture(t);
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await runCheck(w, p);
  await recordProof(
    w,
    p.id,
    "builder",
    "Contrôle supplémentaire",
    "check",
    [p.tasks[0].id],
    { command: [process.execPath, "-e", "process.exit(1)"] },
  );
  assert.deepEqual(
    (await phaseStatus(w, await loadWorkflow(w), p, await sourceHash(w))).done,
    [],
  );
});
test("phase workflow: manual Git preparation and verification with an unrelated preexisting edit", async (t) => {
  const { w, code, base } = await fixture(t);
  const git = (args) => {
    const r = spawnSync("git", args, { cwd: code, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Fixture"]);
  git(["config", "user.email", "fixture@local.invalid"]);
  git(["add", "calc.js"]);
  git(["commit", "-m", "baseline"]);
  await writeFile(join(code, "personal.txt"), "Do not commit this");
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Kelly", "Réalise.");
  await writeFile(
    join(code, "calc.js"),
    "export const add = (a, b) => a + b;\n",
  );
  await runCheck(w, p);
  await recordProof(
    w,
    p.id,
    "Kelly",
    "Fixture observation",
    "observation",
    [p.tasks[1].id],
    { summary: "Fixture" },
  );
  await review(w, p, base);
  assert.equal(
    cmd(w, ["accept", "1", "--by", "Kelly", "--request", "J’accepte."]).status,
    0,
  );
  assert.equal(
    cmd(w, [
      "prepare-commit",
      "1",
      "--path",
      "personal.txt",
      "--message",
      "wrong",
    ]).status,
    2,
  );
  const prepared = cmd(w, [
    "prepare-commit",
    "1",
    "--path",
    "calc.js",
    "--message",
    "Addition",
  ]);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(git(["diff", "--cached", "--name-only"]).trim(), "");
  git(["add", "--", "calc.js"]);
  git(["commit", "-m", "Addition"]);
  const verified = cmd(w, ["verify-commit"]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(git(["status", "--porcelain"]), /personal.txt/);
});
test("phase workflow: migration of legacy v2 preserves archives and maps dependencies without acceptance", async (t) => {
  const { w, base } = await fixture(t);
  const old = join(base, "legacy"),
    code = join(base, "app");
  await createWorkspace({
    workspacePath: old,
    codeRoot: code,
    repositoryRoot: code,
    name: "Legacy",
    entryMode: "existing",
    profile: await loadProfile("swiftui"),
    commands: { test: "swift test --parallel" },
  });
  await writeFile(
    join(old, "taches/BACKLOG.md"),
    await readFile("tests/fixtures/backlog-v2-roadmap/BACKLOG.md"),
  );
  const before = await readFile(join(old, "taches/BACKLOG.md"), "utf8");
  const target = join(base, "migrated");
  const r = cmd(w, ["migrate", "--source", old, "--target", target]);
  assert.equal(r.status, 0, r.stderr);
  const s = await loadWorkflow(join(target, "ai-workspace"));
  const migratedConfig = YAML.parse(await readFile(join(target, "ai-workspace/project.yaml"), "utf8"));
  assert.equal(migratedConfig.profile.id, "swiftui");
  assert.equal(migratedConfig.commands.test, "swift test --parallel");
  assert.ok(s.phases.length > 0);
  assert.equal(s.proofs.length, 0);
  assert.equal(s.brief, null);
  assert.equal(await readFile(join(old, "taches/BACKLOG.md"), "utf8"), before);
  assert.equal(
    await readFile(
      join(target, "ai-workspace/.starter/legacy-source/taches/BACKLOG.md"),
      "utf8",
    ),
    before,
  );
});
test("phase workflow: Next migration preserves dependencies and human tasks, not old passes", async (t) => {
  const { w, base, code } = await fixture(t);
  const old = join(base, "next-old");
  await mkdir(join(old, ".starter"), { recursive: true });
  await writeFile(join(old, "BRIEF.md"), "# Ancien brief\nCalculer");
  await writeFile(
    join(old, ".starter/state.json"),
    JSON.stringify({
      project: { name: "Next", code_root: code },
      plan: [
        {
          id: "p-abc",
          title: "A",
          goal: "A",
          validation: "A works",
          depends: [],
          tasks: [{ id: "t-abc", title: "Essai", human: true, checked: true }],
        },
        {
          id: "p-def",
          title: "B",
          goal: "B",
          validation: "B works",
          depends: ["p-abc"],
          tasks: [],
        },
      ],
      evidence: { fake: "historical" },
    }),
  );
  const target = join(base, "from-next");
  const r = cmd(w, ["migrate", "--source", old, "--target", target]);
  assert.equal(r.status, 0, r.stderr);
  const s = await loadWorkflow(join(target, "ai-workspace"));
  assert.deepEqual(s.phases[1].depends_on, [s.phases[0].id]);
  assert.equal(s.phases[0].tasks[0].human, true);
  assert.equal(s.proofs.length, 0);
  assert.equal(s.phases[0].acceptance, null);
});
test("phase workflow: invalid plans leave canonical state unchanged", async (t) => {
  const { w } = await fixture(t);
  const before = await readFile(join(w, ".starter/workflow.json"), "utf8");
  const p = (await loadWorkflow(w)).phases[0];
  await assert.rejects(() =>
    applyPlan(w, [{ ...p, depends_on: [p.id] }], "Kelly", "Cycle"),
  );
  assert.equal(
    await readFile(join(w, ".starter/workflow.json"), "utf8"),
    before,
  );
  await assert.rejects(() =>
    applyPlan(
      w,
      [{ ...p, tasks: [{ id: "t-unknown", title: "Foreign" }] }],
      "Kelly",
      "Foreign",
    ),
  );
  assert.equal(
    await readFile(join(w, ".starter/workflow.json"), "utf8"),
    before,
  );
});
test("phase workflow: restoring a corrupted state requires a valid snapshot and revokes old authority", async (t) => {
  const { w } = await fixture(t);
  const { readdir } = await import("node:fs/promises");
  const snapshots = (await readdir(join(w, ".starter/history"))).filter((f) =>
    f.startsWith("revision-"),
  );
  const chosen = snapshots.sort().at(-1);
  await writeFile(join(w, ".starter/workflow.json"), "{corrupted");
  const r = cmd(w, [
    "restore-state",
    "--snapshot",
    `.starter/history/${chosen}`,
    "--by",
    "Kelly",
    "--request",
    "Restaure cette sauvegarde.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await loadWorkflow(w)).active, null);
  assert.equal(
    (await loadWorkflow(w)).phases.every((p) => p.mandate === null),
    true,
  );
});
test("phase workflow: public CLI begins after brief approval, repeated approval preserves mandate", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "starter-public-cli-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const w = await initUnified(join(base, "project"), {
    name: "Addition",
    owner: "Kelly",
  });
  const brief = join(w, "PROJECT_BRIEF.md");
  await writeFile(
    brief,
    stringifyFrontmatter(
      {
        schema_version: 1,
        brief_version: 1,
        status: "draft",
        approved_by: null,
        approved_at: null,
        supersedes: null,
      },
      "# Addition\nAdditionner deux nombres positifs, négatifs ou nuls. Sans réseau.",
    ),
  );
  let r = cmd(w, [
    "brief-approve",
    "--by",
    "Kelly",
    "--request",
    "Ce brief est validé.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  const setup = join(base, "setup.md");
  await writeFile(
    setup,
    "Node disponible. Vérification locale par assertions.",
  );
  r = cmd(w, [
    "setup-record",
    "--report",
    setup,
    "--by",
    "builder",
    "--request",
    "Prépare le socle.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  await applyPlan(
    w,
    [
      {
        title: "Addition",
        goal: "Additionner deux nombres",
        validation: "Positif, négatif et zéro vérifiés",
        tasks: [{ title: "Réaliser et vérifier l’addition" }],
      },
    ],
    "Kelly",
    "Construis la calculatrice.",
  );
  r = cmd(w, ["begin", "1", "--by", "Kelly", "--request", "Lance la phase 1."]);
  assert.equal(r.status, 0, r.stderr);
  const mandate = (await loadWorkflow(w)).phases[0].mandate;
  const diagnosed = spawnSync(process.execPath, [cli, "doctor", w, "--json"], {encoding: "utf8"});
  assert.equal(JSON.parse(diagnosed.stdout).items.some(x => x.code === "ADAPTER_NONE"), false);
  r = cmd(w, [
    "brief-approve",
    "--by",
    "Kelly",
    "--request",
    "Toujours validé.",
  ]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).reused, true);
  assert.deepEqual((await loadWorkflow(w)).phases[0].mandate, mandate);
  assert.equal(JSON.parse(cmd(w, ["context"]).stdout).phase.id, "p-1");
  assert.equal(cmd(w, ["recover-lock", "--help"]).status, 0);
  const current = await loadWorkflow(w);
  await writeFile(join(w, current.setup.ref), "Rapport altéré");
  assert.equal((await status(w)).setup_recorded, false);
});

test('phase workflow: aliased parent paths preserve the complete execution cycle', async t => {
  const {w, base} = await fixture(t, true);
  const p = (await loadWorkflow(w)).phases[0];
  const realWorkspace = join(base, 'real', 'ai-workspace');
  assert.equal(await sourceHash(w), await sourceHash(realWorkspace));
  await beginPhase(w, p.id, 'Kelly', 'Réalise la phase de fixture.');
  assert.equal((await runCheck(w, p)).passed, true);
  await recordProof(w, p.id, 'Kelly', 'Observation synthétique de fixture', 'observation', [p.tasks[1].id], {summary:'Cas observé dans cet exercice automatisé.'});
  await review(w, p, base);
  const accepted = cmd(w, ['accept', '1', '--by', 'Kelly', '--request', 'Acceptation synthétique réservée au test.']);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal((await status(realWorkspace)).phases[0].state, 'accepted');
});

test('phase workflow: canonicalizing the root still refuses a redirected state file', async t => {
  const {w, base} = await fixture(t, true);
  const statePath = join(w, '.starter/workflow.json');
  const outside = join(base, 'outside-state.json');
  await writeFile(outside, await readFile(statePath));
  await rm(statePath);
  await symlink(outside, statePath, 'file');
  await assert.rejects(() => loadWorkflow(w), /hors du workspace|symboliquement/);
});

test('phase workflow: canonicalizing the root still refuses an escaping intermediate directory', async t => {
  const {w, base} = await fixture(t, true);
  const outside = join(base, 'outside-state');
  await mkdir(outside);
  await writeFile(join(outside, 'workflow.json'), await readFile(join(w, '.starter/workflow.json')));
  await rm(join(w, '.starter'), {recursive:true});
  await symlink(outside, join(w, '.starter'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => loadWorkflow(w), /hors du workspace|symboliquement/);
});
