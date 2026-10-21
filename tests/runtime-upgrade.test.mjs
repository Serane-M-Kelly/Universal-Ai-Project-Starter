import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, lstat, readlink, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

const cli = resolve("dist/index.js");
const fixture = resolve("tests/fixtures/runtime-v024");
const DEPENDENCIES = ["ajv", "fast-deep-equal", "fast-uri", "json-schema-traverse", "require-from-string", "yaml"];
const run = (args, env = {}) => spawnSync(process.execPath, [cli, "workflow", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
const json = (r) => { assert.equal(r.status, 0, r.stderr || r.stdout); return JSON.parse(r.stdout); };

/** The original 0.24.0 runtime (fixture) with its JavaScript dependencies, used as a distribution. */
async function distribution024(base) {
  const root = join(base, "dist024");
  await cp(fixture, root, { recursive: true });
  for (const name of DEPENDENCIES) await cp(resolve("node_modules", name), join(root, "node_modules", name), { recursive: true });
  return join(root, "dist/index.js");
}

/** A real workspace produced by the 0.24.0 runtime: phase 1 accepted, phase 2 active with proofs. */
async function workspace024(t) {
  const base = await mkdtemp(join(tmpdir(), "starter-upgrade-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const old = await distribution024(base);
  await mkdir(join(base, "app"));
  await writeFile(join(base, "app/a.js"), "export const a = 1;\n");
  const init = spawnSync(process.execPath, [old, "workflow", "init", base, "--name", "Essai", "--owner", "Essai", "--code-root", join(base, "app"), "--adapter", "codex,claude-code"], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  const w = join(base, "ai-workspace");
  const own = (...args) => {
    const r = spawnSync(process.execPath, [join(w, ".starter/run.mjs"), "workflow", "--workspace", w, ...args], { encoding: "utf8" });
    assert.equal(r.status, 0, `${args.join(" ")} : ${r.stderr}`);
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  await writeFile(join(w, "PROJECT_BRIEF.md"), "---\nschema_version: 1\nbrief_version: 1\nstatus: draft\napproved_by: null\napproved_at: null\nsupersedes: null\n---\n# Essai\nUne valeur. Critères : valeur correcte.\n");
  own("brief-approve", "--by", "Essai", "--request", "Brief synthétique.");
  await writeFile(join(base, "setup.md"), "Socle.");
  own("setup-record", "--report", join(base, "setup.md"), "--by", "builder", "--request", "Socle.");
  await writeFile(join(base, "plan.json"), JSON.stringify([
    { title: "Valeur", goal: "Exposer a", validation: "a vaut 1", tasks: [{ title: "Test", human: false }, { title: "Essai réel", human: true }] },
    { title: "Suite", goal: "Exposer b", validation: "b vaut 2", tasks: [{ title: "Test b", human: false }, { title: "Essai b", human: true }] }]));
  own("plan", "--file", join(base, "plan.json"), "--by", "Essai", "--request", "Plan synthétique.");
  own("begin", "1", "--by", "Essai", "--request", "Phase 1.");
  own("check", "1", "--task", "t-2", "--by", "builder", "--request", "Test.", "--", process.execPath, "-e", "process.exit(0)");
  own("observe", "1", "--task", "t-3", "--summary", "Essai synthétique.", "--by", "Essai", "--request", "Observation synthétique.");
  const context = own("context", "1");
  await writeFile(join(base, "review.json"), JSON.stringify({ code_hash: context.code_hash, contract_hash: context.contract_hash, summary: "Revue synthétique." }));
  own("review", "1", "--report", join(base, "review.json"), "--verdict", "passed", "--independent", "--by", "reviewer", "--request", "Revue synthétique.");
  own("accept", "1", "--by", "Essai", "--request", "J'accepte (synthétique).");
  own("begin", "2", "--by", "Essai", "--request", "Phase 2.");
  own("check", "2", "--task", "t-5", "--by", "builder", "--request", "Test b.", "--", process.execPath, "-e", "process.exit(0)");
  own("observe", "2", "--task", "t-6", "--summary", "Essai b synthétique.", "--by", "Essai", "--request", "Observation synthétique.");
  return { base, w, app: join(base, "app"), own };
}

/** Whole-workspace fingerprint; migration records and lock excluded on request. */
async function snapshot(w, exclude = [".starter/migrations", ".starter/write.lock"]) {
  const out = {};
  async function visit(dir) {
    for (const name of (await readdir(dir)).sort()) {
      // Portable keys: "/" on every platform, as in the engine's own fingerprints.
      const path = join(dir, name), rel = relative(w, path).split(sep).join("/");
      if (exclude.some(e => rel === e || rel.startsWith(e + "/"))) continue;
      const details = await lstat(path);
      if (details.isSymbolicLink()) out[rel] = `link:${await readlink(path)}`;
      else if (details.isDirectory()) await visit(path);
      else out[rel] = createHash("sha256").update(await readFile(path)).digest("hex");
    }
  }
  await visit(w);
  return out;
}
const behaviour = (f) => ({ status: f.own("status"), contexts: [f.own("context", "1"), f.own("context", "2")] });
const preview = (w) => json(run(["runtime-upgrade", "--workspace", w, "--dry-run"]));
const apply = (w, plan, env) => run(["runtime-upgrade", "--workspace", w, "--plan", plan, "--by", "Essai", "--request", "Migration synthétique."], env);
const version = async (w) => JSON.parse(await readFile(join(w, ".starter/runtime/package.json"), "utf8")).version;

test("migration 0.24 → 0.25.1 : aperçu complet, état et historique à l'octet près, même comportement", async (t) => {
  const f = await workspace024(t);
  const before = await snapshot(f.w), behaviourBefore = behaviour(f);
  const dry = preview(f.w);
  assert.equal(dry.ready, true, JSON.stringify(dry));
  assert.equal(dry.from, "0.24.0");
  assert.equal(dry.to, "0.25.1");
  assert.deepEqual(dry.touched.map(x => x.path), [".starter/runtime", ".starter/WORKFLOW.md",
    ...["project-setup", "project-plan", "project-phase", "project-review", "project-ship"].flatMap(id => [`skills/${id}`, `.agents/skills/${id}`, `.claude/skills/${id}`]), "project.yaml"]);
  assert.ok(dry.never_written.includes.includes(".starter/workflow.json") && dry.never_written.includes.includes(".starter/history/"));
  assert.deepEqual(await snapshot(f.w), before, "l'aperçu n'écrit rien");
  const result = json(apply(f.w, dry.plan_hash));
  assert.equal(result.upgraded, true);
  assert.equal(await version(f.w), "0.25.1");
  const after = await snapshot(f.w);
  const preserved = Object.keys(before).filter(p => !p.startsWith(".starter/runtime/") && p !== ".starter/WORKFLOW.md" && p !== "project.yaml" && !/(^|\/)skills\/project-(setup|plan|phase|review|ship)\//.test(p));
  for (const path of preserved) assert.equal(after[path], before[path], `${path} modifié`);
  assert.ok(preserved.includes(".starter/workflow.json") && preserved.some(p => p.startsWith(".starter/history/")) && preserved.some(p => p.startsWith(".claude/agents/")));
  assert.equal(Object.keys(after).filter(p => p.startsWith(".starter/history/")).length, Object.keys(before).filter(p => p.startsWith(".starter/history/")).length);
  assert.deepEqual(behaviour(f), behaviourBefore, "statut et contextes identiques");
  const config = YAML.parse(await readFile(join(f.w, "project.yaml"), "utf8"));
  assert.equal(config.starter_version, "0.25.1");
  assert.equal(config.skills.find(s => s.id === "project-phase").version, 5);
  assert.equal(await readFile(join(f.w, ".claude/skills/project-phase/SKILL.md"), "utf8"), await readFile(resolve("core/skills/project-phase/SKILL.md"), "utf8"));
  assert.equal(await readFile(join(f.w, ".claude/skills/project-plan/SKILL.md"), "utf8"), await readFile(resolve("core/skills/project-plan/SKILL.md"), "utf8"));
  const doctor = spawnSync(process.execPath, [join(f.w, ".starter/run.mjs"), "doctor", f.w, "--json"], { encoding: "utf8" });
  assert.notEqual(JSON.parse(doctor.stdout).verdict, "BLOCKED");
  // The new runtime is really in use: carry exists, and pre-0.25 observations stay non-carryable.
  await writeFile(join(f.app, "README.md"), "# Essai\n");
  const observation = f.own("context", "2").proofs.filter(p => p.kind === "observation").at(-1).id;
  const carry = f.own("carry", "2", "--proof", observation, "--dry-run");
  assert.equal(carry.recordable, false);
  assert.ok(carry.blockers.some(b => /antérieure au runtime 0\.25\.0/.test(b)));
  const again = preview(f.w);
  assert.equal(again.up_to_date, true);
});

test("migration : l'application revérifie l'aperçu ; personnalisations et incompatibilités bloquent sans écrire", async (t) => {
  const f = await workspace024(t);
  const dry = preview(f.w);
  f.own("block", "2", "--reason", "Attente synthétique.", "--by", "Essai", "--request", "Bloquer (test).");
  const changed = await snapshot(f.w);
  const stale = apply(f.w, dry.plan_hash);
  assert.equal(stale.status, 2);
  assert.match(stale.stderr, /a changé depuis l'aperçu/);
  assert.deepEqual(await snapshot(f.w), changed);
  assert.equal(await readdir(join(f.w, ".starter/migrations")).catch(() => []).then(x => x.length), 0);

  await writeFile(join(f.w, ".claude/skills/project-phase/SKILL.md"), "---\nname: project-phase\ndescription: x\n---\nRetouche locale.\n");
  await writeFile(join(f.w, ".starter/WORKFLOW.md"), "# Contrat personnalisé\n");
  const personal = preview(f.w);
  assert.equal(personal.ready, false);
  assert.ok(personal.personalizations.some(p => p.startsWith(".claude/skills/project-phase")));
  assert.ok(personal.personalizations.some(p => p.startsWith(".starter/WORKFLOW.md")));
  const refused = apply(f.w, personal.plan_hash);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /rien n'a été écrit/);
  assert.equal(await version(f.w), "0.24.0");

  const g = await workspace024(t);
  const pkg = join(g.w, ".starter/runtime/package.json");
  await writeFile(pkg, (await readFile(pkg, "utf8")).replace('"version": "0.24.0"', '"version": "0.23.0"'));
  assert.ok(preview(g.w).incompatibilities.some(i => /0\.23\.0 : migration prise en charge depuis 0\.24\.0 ou 0\.25\.0/.test(i)));
  await mkdir(join(g.w, ".starter/write.lock"));
  assert.ok(preview(g.w).incompatibilities.some(i => /verrou/.test(i)));
});

for (const step of ["backup-started", "staged", "marked", "old-runtime-saved", "runtime-installed", "target-removed", "files-updated"]) {
  test(`migration interrompue après « ${step} » : jamais utilisable comme réussie, puis restaurée`, async (t) => {
    const f = await workspace024(t);
    const before = await snapshot(f.w), behaviourBefore = behaviour(f);
    const crash = apply(f.w, preview(f.w).plan_hash, { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: step });
    assert.equal(crash.status, 70);
    const own = spawnSync(process.execPath, [join(f.w, ".starter/run.mjs"), "workflow", "status", "--workspace", f.w], { encoding: "utf8" });
    if (["backup-started", "staged", "marked"].includes(step)) {
      // Nothing applied yet: the previous runtime and all its files are intact and consistent.
      assert.equal(own.status, 0);
      assert.equal(await version(f.w), "0.24.0");
    } else {
      assert.notEqual(own.status, 0, "un mélange de runtimes ne doit pas fonctionner");
      if (step !== "old-runtime-saved") assert.match(own.stderr, /du runtime interrompue ou en cours/);
    }
    const preview2 = json(run(["runtime-rollback", "--workspace", f.w, "--dry-run"]));
    assert.equal(preview2.interrupted, true);
    const restored = json(run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Restaurer après interruption (test)."]));
    assert.equal(restored.rolled_back, true);
    assert.deepEqual(await snapshot(f.w), before, "workspace identique à l'état d'avant migration");
    assert.deepEqual(behaviour(f), behaviourBefore);
    const retry = json(apply(f.w, preview(f.w).plan_hash));
    assert.equal(retry.upgraded, true);
  });
}

test("migration : un échec de vérification annule automatiquement ; une annulation interrompue reprend", async (t) => {
  const f = await workspace024(t);
  const before = await snapshot(f.w);
  const failed = apply(f.w, preview(f.w).plan_hash, { STARTER_TEST_FAIL_RUNTIME_UPGRADE: "files-updated" });
  assert.equal(failed.status, 2);
  assert.match(failed.stderr, /Migration annulée et workspace restauré/);
  assert.deepEqual(await snapshot(f.w), before);
  const [id] = await readdir(join(f.w, ".starter/migrations"));
  assert.equal(JSON.parse(await readFile(join(f.w, ".starter/migrations", id, "journal.json"), "utf8")).status, "rolled-back");

  const g = await workspace024(t);
  const original = await snapshot(g.w);
  json(apply(g.w, preview(g.w).plan_hash));
  const cut = run(["runtime-rollback", "--workspace", g.w, "--by", "Essai", "--request", "Annuler (test)."], { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: "rollback-runtime-moved" });
  assert.equal(cut.status, 70);
  json(run(["runtime-rollback", "--workspace", g.w, "--by", "Essai", "--request", "Reprendre l'annulation (test)."]));
  assert.deepEqual(await snapshot(g.w), original);
});

test("annulation après migration : bloquée dès que le suivi change, sauf compatibilité démontrée et acceptée", async (t) => {
  const f = await workspace024(t);
  const original = await snapshot(f.w);
  json(apply(f.w, preview(f.w).plan_hash));
  const clean = json(run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Annuler la migration (test)."]));
  assert.equal(clean.rolled_back, true);
  assert.deepEqual(await snapshot(f.w), original);
  assert.equal(await version(f.w), "0.24.0");

  // State changed after migration, still readable by 0.24: blocked by default, allowed explicitly.
  json(apply(f.w, preview(f.w).plan_hash));
  f.own("block", "2", "--reason", "Attente synthétique.", "--by", "Essai", "--request", "Bloquer (test).");
  const blocked = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Annuler."]);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Le workspace a changé depuis la migration \(.*\.starter\/workflow\.json/);
  const accepted = json(run(["runtime-rollback", "--workspace", f.w, "--accept-state-changes", "--by", "Essai", "--request", "Annuler en gardant le blocage (test)."]));
  assert.equal(accepted.rolled_back, true);
  assert.match(accepted.notes.join(" "), /schéma du runtime 0\.24\.0/);
  assert.equal(f.own("status").phases[1].state, "blocked");

  // A continuity proof is unreadable by 0.24: rollback impossible even when accepted.
  const g = await workspace024(t);
  json(apply(g.w, preview(g.w).plan_hash));
  g.own("observe", "2", "--task", "t-6", "--summary", "Nouvel essai synthétique.", "--by", "Essai", "--request", "Observation synthétique.");
  await writeFile(join(g.app, "README.md"), "# Essai\n");
  const proof = g.own("context", "2").proofs.at(-1).id;
  g.own("carry", "2", "--proof", proof, "--path", "README.md", "--criteria", "c", "--reason", "r", "--checks", "k", "--limits", "l", "--by", "coordinateur", "--request", "Conserver.");
  const impossible = run(["runtime-rollback", "--workspace", g.w, "--accept-state-changes", "--by", "Essai", "--request", "Annuler."]);
  assert.equal(impossible.status, 2);
  assert.match(impossible.stderr, /illisible par le runtime 0\.24\.0/);

  // A migrated file changed after the migration also blocks.
  const h = await workspace024(t);
  json(apply(h.w, preview(h.w).plan_hash));
  await writeFile(join(h.w, "skills/project-phase/SKILL.md"), "---\nname: project-phase\ndescription: x\n---\nModifié.\n");
  assert.match(run(["runtime-rollback", "--workspace", h.w, "--dry-run"]).stdout, /skills\/project-phase a changé depuis la migration/);
});

test("restauration après interruption : un fichier modifié entre-temps n'est jamais écrasé", async (t) => {
  const f = await workspace024(t);
  const crash = apply(f.w, preview(f.w).plan_hash, { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: "marked" });
  assert.equal(crash.status, 70);
  // The previous runtime stayed usable: a skill copy is personalised before the recovery.
  await writeFile(join(f.w, ".claude/skills/project-phase/SKILL.md"), "---\nname: project-phase\ndescription: x\n---\nRetouche après interruption.\n");
  const refused = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Restaurer (test)."]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /\.claude\/skills\/project-phase a été modifié après l'interruption/);
  assert.match(await readFile(join(f.w, ".claude/skills/project-phase/SKILL.md"), "utf8"), /Retouche après interruption/);
});

test("revue adverse : annulation interrompue en pleine copie reprise, 0.25.0 migrée, liens, commentaires, concurrence, nonce, empreinte complète", async (t) => {
  // B2: rollback killed while a file is moved into place (target absent), then resumed.
  const f = await workspace024(t);
  const original = await snapshot(f.w);
  json(apply(f.w, preview(f.w).plan_hash));
  const cut = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Annuler (test)."], { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: "target-removed" });
  assert.equal(cut.status, 70);
  const resumed = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Reprendre (test)."]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.deepEqual(await snapshot(f.w), original);

  // B3: a 0.25.0 workspace (0.25.1 runtime relabelled 0.25.0: simulated source) migrates.
  const base = await mkdtemp(join(tmpdir(), "starter-0250-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3 }));
  await mkdir(join(base, "app"));
  json(run(["init", base, "--name", "Essai", "--owner", "Essai", "--code-root", join(base, "app"), "--adapter", "claude-code"]));
  const w = join(base, "ai-workspace");
  const pkg = join(w, ".starter/runtime/package.json");
  await writeFile(pkg, (await readFile(pkg, "utf8")).replace('"version": "0.25.1"', '"version": "0.25.0"'));
  const yaml = join(w, "project.yaml");
  await writeFile(yaml, "# Projet client : ne pas supprimer ce commentaire\n" + (await readFile(yaml, "utf8")).replace("starter_version: 0.25.1", "starter_version: 0.25.0 # version installée"));
  const dry = preview(w);
  assert.deepEqual(dry.touched.map(x => x.path), [".starter/runtime", "project.yaml"]);
  assert.equal(json(apply(w, dry.plan_hash)).upgraded, true);
  const text = await readFile(yaml, "utf8");
  assert.match(text, /^# Projet client : ne pas supprimer ce commentaire/);
  assert.match(text, /starter_version: 0\.25\.1 # version installée/);

  // S1: a symlinked skill copy is refused at preview time.
  const g = await workspace024(t);
  await rm(join(g.w, "skills/project-phase"), { recursive: true });
  const { symlink } = await import("node:fs/promises");
  await symlink(join(g.w, ".claude/skills/project-phase"), join(g.w, "skills/project-phase"));
  assert.ok(preview(g.w).incompatibilities.some(i => /Lien symbolique non pris en charge : skills\/project-phase/.test(i)));

  // M2: any workspace file changed after the preview invalidates the plan.
  const h = await workspace024(t);
  const plan = preview(h.w).plan_hash;
  await writeFile(join(h.w, "PROJECT_STATE.md"), "Modifié après l'aperçu.\n");
  assert.match(apply(h.w, plan).stderr, /a changé depuis l'aperçu/);

  // M1 and S3: the migration id does not unlock commands; concurrent recoveries end in one clean state.
  const k = await workspace024(t);
  const before = await snapshot(k.w);
  assert.equal(apply(k.w, preview(k.w).plan_hash, { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: "files-updated" }).status, 70);
  const marker = JSON.parse(await readFile(join(k.w, ".starter/MIGRATION-IN-PROGRESS.json"), "utf8"));
  const bypass = spawnSync(process.execPath, [join(k.w, ".starter/run.mjs"), "workflow", "--workspace", k.w, "status"], { encoding: "utf8", env: { ...process.env, STARTER_RUNTIME_UPGRADE_VERIFY: marker.id } });
  assert.notEqual(bypass.status, 0);
  const { spawn } = await import("node:child_process");
  const once = () => new Promise(done => {
    const child = spawn(process.execPath, [cli, "workflow", "runtime-rollback", "--workspace", k.w, "--by", "Essai", "--request", "Restaurer (concurrence)."]);
    let err = ""; child.stderr.on("data", d => err += d); child.on("close", code => done({ code, err }));
  });
  const results = await Promise.all([once(), once(), once()]);
  assert.ok(results.filter(r => r.code === 0).length >= 1, JSON.stringify(results));
  for (const r of results.filter(r => r.code !== 0)) assert.match(r.err, /occupé|repris|en cours|déjà annulée|Verrou/);
  assert.deepEqual(await snapshot(k.w), before);
});

test("migration arrêtée avant son journal : seul son verrou orphelin est retiré", async (t) => {
  const f = await workspace024(t);
  const before = await snapshot(f.w, [".starter/migrations"]);
  assert.equal(apply(f.w, preview(f.w).plan_hash, { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: "locked" }).status, 70);
  assert.ok(preview(f.w).incompatibilities.some(i => /runtime-rollback/.test(i)));
  const released = json(run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Retirer le verrou (test)."]));
  assert.equal(released.lock_released, true);
  assert.deepEqual(await snapshot(f.w, [".starter/migrations"]), before);
  assert.equal(preview(f.w).ready, true);
});

test("revue ChatGPT 1 : un échec du nettoyage final conserve sauvegarde et journal ; terminer ou annuler reste possible", async (t) => {
  for (const ending of ["rollback", "finish"]) {
    const f = await workspace024(t);
    const original = await snapshot(f.w);
    const failed = apply(f.w, preview(f.w).plan_hash, { STARTER_TEST_FAIL_RUNTIME_UPGRADE: "applied-recorded" });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /nettoyage final incomplet[\s\S]*Sauvegarde et journal conservés/);
    const [id] = await readdir(join(f.w, ".starter/migrations"));
    const journal = JSON.parse(await readFile(join(f.w, ".starter/migrations", id, "journal.json"), "utf8"));
    assert.equal(journal.status, "applied");
    assert.equal(await version(f.w), "0.25.1");
    assert.ok((await readdir(join(f.w, ".starter/migrations", id, "backup/.starter/runtime"))).length > 0, "sauvegarde conservée");
    const blocked = spawnSync(process.execPath, [join(f.w, ".starter/run.mjs"), "workflow", "--workspace", f.w, "status"], { encoding: "utf8" });
    assert.notEqual(blocked.status, 0, "inutilisable tant que la migration n'est ni terminée ni annulée");
    if (ending === "rollback") {
      json(run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Annuler (test)."]));
      assert.deepEqual(await snapshot(f.w), original);
    } else {
      assert.equal(json(run(["runtime-upgrade", "--workspace", f.w, "--finish", "--by", "Essai", "--request", "Terminer (test)."])).finished, true);
      assert.equal(f.own("status").phases.length, 2);
      assert.equal(json(run(["runtime-rollback", "--workspace", f.w, "--dry-run"])).blockers.length, 0, "annulation encore possible");
    }
  }
});

for (const step of ["target-removed", "rollback-file-restored", "rollback-files-done", "rollback-runtime-moved", "rollback-runtime-restored"]) {
  test(`revue ChatGPT 2 : annulation interrompue après « ${step} » : aucune écriture sur un mélange de versions`, async (t) => {
    const f = await workspace024(t);
    const original = await snapshot(f.w);
    json(apply(f.w, preview(f.w).plan_hash));
    const cut = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Annuler (test)."], { STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE: step });
    assert.equal(cut.status, 70);
    const ownRun = (...args) => spawnSync(process.execPath, [join(f.w, ".starter/run.mjs"), "workflow", "--workspace", f.w, ...args], { encoding: "utf8" });
    ownRun("recover-lock", "--by", "Essai", "--request", "Reprendre le verrou (test).");
    const write = ownRun("block", "2", "--reason", "Écriture pendant l'interruption.", "--by", "Essai", "--request", "Tenter une écriture (test).");
    const now = await snapshot(f.w);
    const state = [".starter/workflow.json", "BACKLOG.md"];
    if (write.status === 0) {
      // Possible only with the previous runtime back, once every migrated file is restored.
      assert.equal(await version(f.w), "0.24.0", step);
      for (const path of Object.keys(original).filter(p => !state.includes(p) && !p.startsWith(".starter/history/")))
        assert.equal(now[path], original[path], `${step} : ${path} pas encore restauré alors qu'une écriture est possible`);
    }
    const resumed = run(["runtime-rollback", "--workspace", f.w, "--by", "Essai", "--request", "Reprendre l'annulation (test)."]);
    assert.equal(resumed.status, 0, resumed.stderr);
    const end = await snapshot(f.w);
    for (const path of Object.keys(original).filter(p => write.status !== 0 || (!state.includes(p) && !p.startsWith(".starter/history/"))))
      assert.equal(end[path], original[path], `${step} : ${path}`);
  });
}
