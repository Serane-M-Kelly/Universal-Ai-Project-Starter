import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, cp, rename, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Ajv2020 } from "ajv/dist/2020.js";
import { createWorkspace } from "../dist/lib/workspace.js";
import { loadProfile } from "../dist/lib/profiles.js";
import {
  initializeWorkflow, applyPlan, loadWorkflow, beginPhase, recordProof, status, sourceHash, hash,
} from "../dist/lib/phase-workflow.js";
import { carryObservation, previewContinuity } from "../dist/lib/evidence-continuity.js";
import { fingerprintSource } from "../dist/lib/phase-sources.js";
import { contextView } from "../dist/lib/context-output.js";
import { stringifyFrontmatter } from "../dist/lib/frontmatter.js";

const cli = resolve("dist/index.js");
const run = (w, args) => spawnSync(process.execPath, [cli, "workflow", ...args, "--workspace", w], { encoding: "utf8" });
const README = "# Calculatrice\n\nAddition locale de deux nombres.\n\n## Commandes\n\n```bash\nnode --test\n```\n";

async function product(t, { files = {}, sources = false } = {}) {
  const base = await mkdtemp(join(tmpdir(), "starter-025-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  const code = join(base, "app"), w = join(base, "ai-workspace");
  const initial = {
    "calc.js": "export const add = (a, b) => a + b;\n",
    "README.md": README,
    "package.json": JSON.stringify({ name: "fixture", private: true, scripts: { test: "node --test" } }, null, 2) + "\n",
    "styles.css": "body { color: #222; }\n",
    ...files,
  };
  for (const [path, content] of Object.entries(initial)) {
    await mkdir(join(code, path, ".."), { recursive: true });
    await writeFile(join(code, path), content);
  }
  await createWorkspace({ workspacePath: w, codeRoot: code, repositoryRoot: code, name: "Fixture", entryMode: "existing", profile: await loadProfile("generic") });
  await initializeWorkflow(w);
  await writeFile(join(w, "PROJECT_BRIEF.md"), stringifyFrontmatter(
    { schema_version: 1, brief_version: 1, status: "draft", approved_by: null, approved_at: null, supersedes: null },
    "# Calculatrice\nAddition locale. Critères : additionner correctement. Pas de réseau."));
  assert.equal(run(w, ["brief-approve", "--by", "Fixture", "--request", "Brief synthétique de test."]).status, 0);
  await writeFile(join(base, "setup.md"), "Socle JavaScript inspecté.");
  assert.equal(run(w, ["setup-record", "--report", join(base, "setup.md"), "--by", "builder", "--request", "Socle."]).status, 0);
  const phase = {
    title: "Addition", goal: "Additionner deux nombres", validation: "Positifs et négatifs corrects",
    tasks: [{ title: "Vérifier l'addition", human: false }, { title: "Essai réel de l'addition", human: true }],
  };
  if (sources) {
    await mkdir(join(w, "design"), { recursive: true });
    await writeFile(join(w, "design/RULES.md"), "# Règles\nL'addition accepte les négatifs.\n");
    const { path, sha256 } = await fingerprintSource(w, "design/RULES.md");
    phase.sources = [{ path, sha256 }];
  }
  await applyPlan(w, [phase], "Fixture", "Plan synthétique.");
  const p = (await loadWorkflow(w)).phases[0];
  await beginPhase(w, p.id, "Fixture", "Réalise la phase.");
  return { base, code, w, p, check: p.tasks[0].id, human: p.tasks[1].id };
}
const check = (f) => recordProof(f.w, f.p.id, "builder", "Contrôle", "check", [f.check], {
  command: [process.execPath, "--input-type=module", "-e", "import {add} from './calc.js'; if (add(2,3)!==5||add(-2,-3)!==-5) process.exit(1)"],
});
const observe = (f, summary = "Addition essayée dans le navigateur : 2 + 3 affiche 5.") =>
  recordProof(f.w, f.p.id, "Fixture", "Observation synthétique de test", "observation", [f.human], { summary });
async function review(f, verdict = "passed") {
  const context = await status(f.w, f.p.id), report = join(f.base, `review-${Date.now()}.json`);
  await writeFile(report, JSON.stringify({ code_hash: context.code_hash, contract_hash: context.contract_hash, summary: "Revue synthétique du changement et de la continuité." }));
  return recordProof(f.w, f.p.id, "reviewer", "Revue distincte synthétique", "review", [], { report, verdict, independent: true });
}
const carry = (f, origin, paths, extra = {}) => carryObservation(f.w, f.p.id, {
  origin, paths, by: "coordinateur", request: "Conserver l'essai si le changement est sans rapport.",
  criteria: "Essai réel : affichage du résultat de l'addition.", reason: "Seule la documentation du dépôt a changé ; elle n'est ni rendue ni lue par l'application.",
  checks: "Relecture des liens et commandes du README ; node --test relancé.", limits: "Réglages de publication extérieurs au dépôt non vérifiables.", ...extra,
});
const humanDone = async (f) => (await status(f.w, f.p.id)).status.done.includes(f.human);
const stateBytes = (f) => readFile(join(f.w, ".starter/workflow.json"), "utf8");

test("continuité 1 : réorganisation du README sans effet produit, essai conservé sans nouvelle déclaration", async (t) => {
  const f = await product(t);
  await check(f);
  const origin = await observe(f);
  const before = (await loadWorkflow(f.w)).proofs.find(p => p.id === origin.proof);
  const originReport = await readFile(join(f.w, before.ref), "utf8");
  await writeFile(join(f.code, "README.md"), "# Calculatrice\n\n## Présentation\n\nAddition locale.\n\n## Architecture\n\n[Détails](docs/architecture.md)\n");
  await mkdir(join(f.code, "docs"));
  await writeFile(join(f.code, "docs/architecture.md"), "# Architecture\n\n`calc.js` contient la fonction.\n");
  assert.equal(await humanDone(f), false, "l'ancien comportement prudent reste la base");
  const unchanged = await stateBytes(f);
  const preview = await previewContinuity(f.w, f.p.id, origin.proof);
  assert.equal(await stateBytes(f), unchanged, "l'aperçu n'écrit rien");
  assert.equal(preview.recordable, true, JSON.stringify(preview.blockers));
  assert.deepEqual(preview.declare_paths, ["README.md", "docs/architecture.md"]);
  assert.deepEqual(preview.changes.map(c => [c.path, c.change, c.category]), [["README.md", "modified", "documentation"], ["docs/architecture.md", "added", "documentation"]]);
  await check(f); // Documentary change controlled on the new revision before the continuity.
  const kept = await carry(f, origin.proof, ["README.md", "docs/architecture.md"]);
  const s = await loadWorkflow(f.w);
  // The original human statement is untouched: same words, date, revision and report bytes.
  assert.deepEqual(s.proofs.find(p => p.id === origin.proof), before);
  assert.equal(await readFile(join(f.w, before.ref), "utf8"), originReport);
  assert.equal(s.proofs.filter(p => p.kind === "observation").length, 1, "aucune observation fabriquée");
  const record = s.proofs.find(p => p.id === kept.proof);
  assert.equal(record.kind, "continuity");
  assert.equal(record.origin, origin.proof);
  assert.equal(record.independent, false);
  assert.equal(record.code, await sourceHash(f.w));
  const report = JSON.parse(await readFile(join(f.w, record.ref), "utf8"));
  assert.equal(report.origin.code, before.code);
  assert.equal(report.compared.to_code, record.code);
  assert.deepEqual(report.changes.map(c => c.path), ["README.md", "docs/architecture.md"]);
  assert.ok(report.criteria && report.justification && report.checks_declared && report.limits_declared);
  assert.equal(report.checks_recorded_at_this_revision.length, 1);
  assert.match(report.engine.not_verified, /effet métier/);
  const st = (await status(f.w, f.p.id)).status;
  assert.deepEqual(st.carried, [f.human]);
  assert.equal(st.state, "ready_for_review", "la revue du changement reste exigée");
  await review(f);
  assert.equal((await status(f.w, f.p.id)).status.state, "ready_for_acceptance");
  assert.match(await readFile(join(f.w, "BACKLOG.md"), "utf8"), /essai antérieur conservé après examen des changements/);
  const compact = (await contextView(f.w, f.p.id)).output;
  assert.deepEqual(compact.continuity_origins?.map(p => p.id), [origin.proof], "l'essai d'origine reste visible pour la revue");
  assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte (test synthétique)."]).status, 0);
});

test("continuité 2 : une règle métier modifiée après l'essai rend la preuve périmée", async (t) => {
  const f = await product(t);
  const origin = await observe(f);
  await writeFile(join(f.code, "calc.js"), "export const add = (a, b) => Math.round(a + b);\n");
  await writeFile(join(f.code, "README.md"), README + "\nArrondi appliqué.\n");
  const preview = await previewContinuity(f.w, f.p.id, origin.proof);
  assert.equal(preview.recordable, false);
  assert.ok(preview.blockers.some(b => b.startsWith("calc.js (modified, code)")));
  assert.ok(preview.required_controls.some(c => /refaire l'essai humain/.test(c)));
  const before = await stateBytes(f);
  await assert.rejects(carry(f, origin.proof, ["README.md", "calc.js"]), /Continuité refusée[\s\S]*calc\.js[\s\S]*Contrôles requis/);
  assert.equal(await stateBytes(f), before);
  assert.equal(await humanDone(f), false);
  // Criteria changed in the plan: contract mismatch even with a pure README change.
  const g = await product(t);
  const o2 = await observe(g);
  await writeFile(join(g.code, "README.md"), README + "\nPrécision.\n");
  const plan = (await loadWorkflow(g.w)).phases.map(p => ({ ...p, validation: "Positifs, négatifs et décimaux corrects" }));
  await applyPlan(g.w, plan, "Fixture", "Nouveau critère.", true);
  await beginPhase(g.w, g.p.id, "Fixture", "Reprends avec le nouveau critère.");
  const refused = await previewContinuity(g.w, g.p.id, o2.proof);
  assert.ok(refused.blockers.some(b => /Critères, tâches/.test(b)));
});

test("continuité 3 : Markdown publié, consommé ou épinglé détecté, jamais traité comme documentation sans impact", async (t) => {
  const cases = [
    { name: "page", files: { "src/pages/about.md": "# À propos\n" }, edit: ["src/pages/about.md", "# À propos\nNouveau texte.\n"], reason: /dossier habituellement publié/ },
    { name: "frontmatter", files: { "NOTES.md": "---\ntitle: Notes\n---\n# Notes\n" }, edit: ["NOTES.md", "---\ntitle: Notes\n---\n# Notes v2\n"], reason: /frontmatter/ },
    { name: "cité", files: { "guide.md": "# Guide\n", "view.js": "import guide from './guide.md?raw';\nexport default guide;\n" }, edit: ["guide.md", "# Guide v2\n"], reason: /cité par view\.js/ },
    { name: "motif", files: { "loader.js": "export const pattern = 'docs/**/*.md';\n", "docs/a.md": "# A\n" }, edit: ["docs/a.md", "# A v2\n"], reason: /extension \.md mentionnée par loader\.js/ },
    // Review findings: dynamic reads, regex filters, build copies, nested or other site generators.
    { name: "gabarit", files: { "agent.js": "import { readFileSync } from 'node:fs';\nexport const prompt = (name) => readFileSync(`prompts/${name}.md`, 'utf8');\n", "prompts/system.md": "Ton neutre.\n" }, edit: ["prompts/system.md", "Ton familier.\n"], reason: /extension \.md mentionnée par agent\.js/ },
    { name: "python", files: { "rules.py": "def load(rule):\n    return open(f\"rules/{rule}.md\").read()\n", "rules/pricing.md": "Remise : 10 %\n" }, edit: ["rules/pricing.md", "Remise : 20 %\n"], reason: /extension \.md mentionnée par rules\.py/ },
    { name: "regex", files: { "help.js": "import { readdirSync } from 'node:fs';\nexport const pages = readdirSync('manuel').filter(f => /\\.md$/.test(f));\n", "manuel/install.md": "# Installer\n" }, edit: ["manuel/install.md", "# Installer v2\n"], reason: /extension \.md mentionnée par help\.js/ },
    { name: "copie", files: { "package.json": JSON.stringify({ name: "f", private: true, scripts: { build: "vite build && cp -r guide dist/guide" } }), "guide/index.md": "# Guide\n" }, edit: ["guide/index.md", "# Guide v2\n"], reason: /fichier ou dossier cité par package\.json/ },
    { name: "pages-docs", files: { "docs/_config.yml": "title: Docs\n", "docs/install.md": "# Installer\n" }, edit: ["docs/install.md", "# Installer v2\n"], reason: /générateur ou publication de site détecté : docs\/_config\.yml/ },
    { name: "sphinx", files: { "docs/source/conf.py": "project = 'x'\n", "docs/source/install.rst": "Installer\n" }, edit: ["docs/source/install.rst", "Installer v2\n"], reason: /docs\/source\/conf\.py/ },
    { name: "vuepress", files: { "docs/.vuepress/config.js": "export default {}\n", "docs/guide.md": "# Guide\n" }, edit: ["docs/guide.md", "# Guide v2\n"], reason: /docs\/\.vuepress\/config\.js/ },
    { name: "jekyll", files: { "_config.yml": "title: Site\n" }, edit: ["README.md", README + "\nAjout.\n"], reason: /générateur ou publication de site détecté : _config\.yml/ },
    { name: "mkdocs", files: { "mkdocs.yml": "site_name: Docs\n", "docs/index.md": "# Docs\n" }, edit: ["docs/index.md", "# Docs v2\n"], reason: /documentation publiée par mkdocs\.yml/ },
  ];
  for (const c of cases) {
    const f = await product(t, { files: c.files });
    const origin = await observe(f);
    await writeFile(join(f.code, c.edit[0]), c.edit[1]);
    const preview = await previewContinuity(f.w, f.p.id, origin.proof);
    assert.equal(preview.recordable, false, c.name);
    const change = preview.changes.find(x => x.path === c.edit[0]);
    assert.equal(change.category, "published_documentation", c.name);
    assert.ok(change.reasons.some(r => c.reason.test(r)), `${c.name}: ${change.reasons}`);
  }
  // A comment line that points to the documentation does not make the product read it (Calepio layout).
  const commented = await product(t, { files: { "src/calc.ts": "/**\n * Règles : docs/calcul.md\n */\n// voir README.md\nexport const x = 1;\n", "docs/calcul.md": "# Calcul\n" } });
  const oc = await observe(commented);
  await writeFile(join(commented.code, "README.md"), README + "\nRéorganisé.\n");
  await writeFile(join(commented.code, "docs/calcul.md"), "# Calcul\nPrécision.\n");
  const pc = await previewContinuity(commented.w, commented.p.id, oc.proof);
  assert.equal(pc.recordable, true, pc.blockers.join("\n"));
  // A trailing comment on a code line stays analysed.
  await writeFile(join(commented.code, "src/calc.ts"), "export const x = 1; // docs/calcul.md\n");
  assert.equal((await previewContinuity(commented.w, commented.p.id, oc.proof)).recordable, false);
  // A linter setting that mentions *.md does not make the product consume Markdown.
  const lint = await product(t, { files: { ".markdownlint.json": "{\"globs\": [\"**/*.md\"]}\n" } });
  const o = await observe(lint);
  await writeFile(join(lint.code, "README.md"), README + "\nAjout.\n");
  assert.equal((await previewContinuity(lint.w, lint.p.id, o.proof)).recordable, true);
  // A pinned PA/AD source that changed blocks the continuity like every other proof.
  const pinned = await product(t, { sources: true });
  const o3 = await observe(pinned);
  await writeFile(join(pinned.code, "README.md"), README + "\nAjout.\n");
  await writeFile(join(pinned.w, "design/RULES.md"), "# Règles\nL'addition refuse les négatifs.\n");
  const refused = await previewContinuity(pinned.w, pinned.p.id, o3.proof);
  assert.ok(refused.blockers.some(b => /Référence épinglée modifiée ou absente : design\/RULES\.md/.test(b)));
  await assert.rejects(carry(pinned, o3.proof, ["README.md"]), /Référence épinglée/);
});

test("continuité 4 : configuration, dépendance et asset visuel exigent un contrôle adapté", async (t) => {
  const edits = [
    ["package.json", JSON.stringify({ name: "fixture", private: true, scripts: { test: "node --test" }, dependencies: { leftpad: "1.0.0" } }), "dependency", /dépendances : réinstaller/],
    [".env.example", "API_URL=\n", "configuration", /configuration : vérifier l'environnement/],
    ["styles.css", "body { color: #000; }\n", "asset", /asset visuel ou style : contrôle visuel/],
    ["logo.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n", "asset", /contrôle visuel/],
    ["LICENSE.md", "MIT\n", "legal", /licence ou mentions/],
    ["docs/politique-de-confidentialite.md", "# Confidentialité\n", "legal", /licence ou mentions/],
  ];
  for (const [path, content, category, control] of edits) {
    const f = await product(t);
    const origin = await observe(f);
    await mkdir(join(f.code, path, ".."), { recursive: true });
    await writeFile(join(f.code, path), content);
    await writeFile(join(f.code, "README.md"), README + "\nMise à jour.\n");
    const preview = await previewContinuity(f.w, f.p.id, origin.proof);
    assert.equal(preview.recordable, false, path);
    assert.equal(preview.changes.find(c => c.path === path).category, category, path);
    assert.ok(preview.required_controls.some(c => control.test(c)), `${path}: ${preview.required_controls}`);
  }
});

test("continuité 5 : un diff mêlant README et code ne peut pas masquer le code", async (t) => {
  const f = await product(t);
  const origin = await observe(f);
  await writeFile(join(f.code, "README.md"), README + "\nCorrection.\n");
  await writeFile(join(f.code, "calc.js"), "export const add = (a, b) => a + b + 0;\n");
  const before = await stateBytes(f);
  // Declaring only the README is refused, and declaring everything is refused as well.
  await assert.rejects(carry(f, origin.proof, ["README.md"]), /calc\.js \(modified, code\)/);
  await assert.rejects(carry(f, origin.proof, ["README.md", "calc.js"]), /calc\.js \(modified, code\)/);
  const cliRun = run(f.w, ["carry", "1", "--proof", origin.proof, "--path", "README.md", "--criteria", "c", "--reason", "r", "--checks", "k", "--limits", "l", "--by", "coordinateur", "--request", "Conserver."]);
  assert.equal(cliRun.status, 2);
  assert.match(cliRun.stderr, /Continuité refusée/);
  assert.equal(await stateBytes(f), before);
  assert.equal(await humanDone(f), false);
});

test("continuité 6 : fichier déplacé, périmètre incomplet, inventaire absent ou modifié, impact inconnu", async (t) => {
  const moved = await product(t);
  const o1 = await observe(moved);
  await mkdir(join(moved.code, "docs"));
  await rename(join(moved.code, "README.md"), join(moved.code, "docs/README.md"));
  const p1 = await previewContinuity(moved.w, moved.p.id, o1.proof);
  assert.ok(p1.blockers.some(b => /^README\.md \(deleted, deleted_documentation\) : suppression ou déplacement/.test(b)), p1.blockers.join("\n"));

  const partial = await product(t);
  const o2 = await observe(partial);
  await writeFile(join(partial.code, "README.md"), README + "\nA.\n");
  await writeFile(join(partial.code, "CHANGELOG.md"), "# Journal\n");
  await assert.rejects(carry(partial, o2.proof, ["README.md"]), /Non déclarés : CHANGELOG\.md[\s\S]*--dry-run/);
  await assert.rejects(carry(partial, o2.proof, ["README.md", "CHANGELOG.md", "absent.md"]), /Inexistants : absent\.md/);
  await assert.rejects(carry(partial, o2.proof, ["README.md", "CHANGELOG.md"], { limits: " " }), /--limits requis/);

  const lost = await product(t);
  const o3 = await observe(lost);
  const origin = (await loadWorkflow(lost.w)).proofs.find(p => p.id === o3.proof);
  await writeFile(join(lost.code, "README.md"), README + "\nB.\n");
  const inventory = join(lost.w, "reports/trees", `${origin.code}.json`);
  const raw = await readFile(inventory, "utf8");
  await writeFile(inventory, raw.replace("calc.js", "calc2.js"));
  assert.ok((await previewContinuity(lost.w, lost.p.id, o3.proof)).blockers.some(b => /Inventaire de révision modifié/.test(b)));
  await rm(inventory);
  const p3 = await previewContinuity(lost.w, lost.p.id, o3.proof);
  assert.ok(p3.blockers.some(b => /Inventaire détaillé de la révision observée indisponible/.test(b)));
  assert.ok(p3.required_controls.some(c => /nouvelle observation humaine : Essai réel de l'addition/.test(c)));

  const unknown = await product(t);
  const o4 = await observe(unknown);
  await writeFile(join(unknown.code, "data.bin"), Buffer.from([0, 1, 2]));
  assert.ok((await previewContinuity(unknown.w, unknown.p.id, o4.proof)).blockers.some(b => /^data\.bin \(added, code\)/.test(b)));

  // Only a human observation can be carried; an automated check is re-run.
  const c = await check(unknown);
  assert.ok((await previewContinuity(unknown.w, unknown.p.id, c.proof)).blockers.some(b => /Seules les observations humaines/.test(b)));
  await assert.rejects(previewContinuity(unknown.w, unknown.p.id, "e-999"), /Preuve d'origine inconnue/);
});

test("continuité 7 : une revue négative ou un essai plus récent ne disparaissent pas", async (t) => {
  const f = await product(t);
  await check(f);
  const origin = await observe(f);
  await review(f, "changes_required");
  await writeFile(join(f.code, "README.md"), README + "\nCorrection.\n");
  await check(f);
  const kept = await carry(f, origin.proof, ["README.md"]);
  assert.equal(kept.latest_review_negative.verdict, "changes_required");
  const st = (await status(f.w, f.p.id)).status;
  assert.equal(st.review, false);
  assert.equal(st.state, "ready_for_review");
  const compact = (await contextView(f.w, f.p.id)).output;
  assert.equal(compact.latest_review_if_historical?.verdict ?? compact.proofs.find(p => p.kind === "review")?.verdict, "changes_required");
  assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte."]).status, 2);

  const g = await product(t);
  const first = await observe(g);
  const failed = await recordProof(g.w, g.p.id, "Fixture", "Observation synthétique d'échec", "observation", [g.human], { summary: "Échec : 2 + 3 affiche 23.", verdict: "failed" });
  assert.equal(failed.passed, false);
  await writeFile(join(g.code, "README.md"), README + "\nC.\n");
  const preview = await previewContinuity(g.w, g.p.id, first.proof);
  assert.ok(preview.blockers.some(b => b.includes(`Observation plus récente pour ${g.human} : ${failed.proof}`)));
});

test("continuité 8 : workspace 0.24 réel lu sans requalification ni écriture incompatible", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "starter-v024-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));
  await cp(resolve("tests/fixtures/workspace-v024"), base, { recursive: true });
  const w = join(base, "ai-workspace"), code = join(base, "app");
  const s = await loadWorkflow(w);
  const observation = s.proofs.find(p => p.kind === "observation");
  assert.ok(observation && !("origin" in observation));
  assert.equal((await status(w, "1")).status.state, "ready_for_review", "état 0.24 relu tel quel");
  await writeFile(join(code, "README.md"), (await readFile(join(code, "README.md"), "utf8")) + "\nRéorganisé.\n");
  assert.equal((await status(w, "1")).status.done.includes(observation.tasks[0]), false);
  const preview = await previewContinuity(w, "1", observation.id);
  assert.equal(preview.recordable, false);
  assert.equal(preview.embedded_runtime.version, "0.24.0");
  assert.equal(preview.embedded_runtime.compatible, false);
  assert.ok(preview.blockers.some(b => /antérieure au runtime 0\.25\.0/.test(b)));
  const before = await readFile(join(w, ".starter/workflow.json"), "utf8");
  const reports = await readdir(join(w, "reports/phases/p-1"));
  await assert.rejects(carryObservation(w, "1", { origin: observation.id, paths: ["README.md"], criteria: "c", reason: "r", checks: "k", limits: "l", by: "coordinateur", request: "Conserver." }),
    /Runtime du workspace 0\.24\.0[\s\S]*Rien n'a été écrit/);
  assert.equal(await readFile(join(w, ".starter/workflow.json"), "utf8"), before);
  assert.deepEqual(await readdir(join(w, "reports/phases/p-1")), reports);
  // A new observation recorded by 0.25 keeps the state readable by the 0.24 schema of this workspace.
  await recordProof(w, "1", "Fixture", "Observation synthétique de test", "observation", [observation.tasks[0]], { summary: "Nouvel essai synthétique." });
  const old = JSON.parse(await readFile(join(base, "workflow.schema.v024.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  assert.equal(ajv.validate(old, JSON.parse(await readFile(join(w, ".starter/workflow.json"), "utf8"))), true, ajv.errorsText());
  // A continuity entry would not be readable by that runtime, hence the guard above.
  const withContinuity = JSON.parse(before);
  withContinuity.proofs.push({ ...observation, id: "e-99", kind: "continuity", origin: observation.id });
  assert.equal(ajv.validate(old, withContinuity), false);
  // The 0.25 schema requires origin exactly for continuity entries.
  await writeFile(join(w, ".starter/workflow.json"), JSON.stringify({ ...withContinuity, proofs: [...JSON.parse(before).proofs, { ...observation, id: "e-99", kind: "continuity" }] }));
  await assert.rejects(loadWorkflow(w), /État du workflow invalide/);
  await writeFile(join(w, ".starter/workflow.json"), JSON.stringify({ ...withContinuity, proofs: [...JSON.parse(before).proofs, { ...observation, id: "e-99", origin: observation.id }] }));
  await assert.rejects(loadWorkflow(w), /État du workflow invalide/);
});

test("continuité 9 : commit préparé et vérifié sur le contenu exact, changement après revue détecté", async (t) => {
  const f = await product(t);
  const git = (args) => { const r = spawnSync("git", args, { cwd: f.code, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git(["init", "-b", "main"]); git(["config", "user.name", "Fixture"]); git(["config", "user.email", "fixture@local.invalid"]);
  git(["add", "-A"]); git(["commit", "-m", "baseline"]);
  await writeFile(join(f.code, "calc.js"), "export const add = (a, b) => {\n  return a + b;\n};\n");
  await check(f);
  const origin = await observe(f);
  await writeFile(join(f.code, "README.md"), README + "\n## Limites\n\nNombres JavaScript uniquement.\n");
  await check(f);
  await carry(f, origin.proof, ["README.md"]);
  await review(f);
  // A change after the review is detected before preparing the commit.
  await writeFile(join(f.code, "README.md"), README + "\n## Limites\n\nNombres JavaScript seulement.\n");
  assert.equal((await status(f.w, f.p.id)).status.state, "in_progress");
  assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte."]).status, 2);
  await writeFile(join(f.code, "README.md"), README + "\n## Limites\n\nNombres JavaScript uniquement.\n");
  assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte (test synthétique)."]).status, 0);
  await writeFile(join(f.code, "notes.txt"), "après acceptation");
  const stale = run(f.w, ["prepare-commit", "1", "--path", "calc.js", "--path", "README.md", "--message", "Addition"]);
  assert.equal(stale.status, 2);
  assert.match(stale.stderr, /Revue actuelle requise/);
  await rm(join(f.code, "notes.txt"));
  const prepared = run(f.w, ["prepare-commit", "1", "--path", "calc.js", "--path", "README.md", "--message", "Addition"]);
  assert.equal(prepared.status, 0, prepared.stderr);
  git(["add", "--", "calc.js", "README.md"]);
  await writeFile(join(f.code, "README.md"), README + "\nModifié entre préparation et vérification.\n");
  git(["add", "--", "README.md"]);
  git(["commit", "-m", "Addition"]);
  const refused = run(f.w, ["verify-commit"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /Le code a changé depuis la préparation/);
});

test("continuité : réouverture d'une phase acceptée et brief réapprouvé", async (t) => {
  const f = await product(t);
  await check(f);
  const origin = await observe(f);
  await review(f);
  assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte."]).status, 0);
  await writeFile(join(f.code, "README.md"), README + "\nRéorganisé après acceptation.\n");
  assert.equal(run(f.w, ["reopen", "1", "--by", "Fixture", "--request", "Rouvrir pour intégrer le README au commit."]).status, 0);
  await beginPhase(f.w, f.p.id, "Fixture", "Reprends la phase pour le README.");
  const preview = await previewContinuity(f.w, f.p.id, origin.proof);
  assert.equal(preview.recordable, true, preview.blockers.join("\n"));
  assert.equal(preview.criteria_iteration, 1);
  assert.match(preview.acceptance_snapshot, /^\.starter\/history\/revision-\d+-/);
  assert.ok(preview.events_since_origin.some(e => e.action === "reopen"));
  // The old acceptance stays historical; the new revision is not accepted automatically.
  const s = await loadWorkflow(f.w);
  assert.equal(s.phases[0].acceptance, null);
  assert.ok(s.events.some(e => e.action === "accept"));

  const g = await product(t);
  const o = await observe(g);
  await writeFile(join(g.code, "README.md"), README + "\nX.\n");
  const brief = join(g.w, "PROJECT_BRIEF.md");
  await writeFile(brief, (await readFile(brief, "utf8")).replace("Pas de réseau.", "Pas de réseau. Les décimales sont arrondies."));
  assert.equal(run(g.w, ["brief-approve", "--by", "Fixture", "--request", "Nouvelle règle d'arrondi (test)."]).status, 0);
  await beginPhase(g.w, g.p.id, "Fixture", "Reprends.");
  assert.ok((await previewContinuity(g.w, g.p.id, o.proof)).blockers.some(b => /Brief réapprouvé après l'essai/.test(b)));
});

test("revue distincte : essai portant sur la documentation, réouverture non acceptée, dépendance réacceptée", async (t) => {
  // The trial itself concerns the README: a declarative justification cannot carry it.
  const f = await product(t);
  const o = await recordProof(f.w, f.p.id, "Fixture", "Observation synthétique", "observation", [f.human], { summary: "Installé en suivant le README : commandes correctes." });
  await writeFile(join(f.code, "README.md"), README + "\nNouvelle commande.\n");
  const doc = await previewContinuity(f.w, f.p.id, o.proof);
  assert.ok(doc.blockers.some(b => /portent sur la documentation \(README\.md\)/.test(b)), doc.blockers.join("\n"));

  // A reopening before any acceptance may concern the trial itself: refused, and its words are shown.
  const g = await product(t);
  const o2 = await observe(g);
  assert.equal(run(g.w, ["reopen", "1", "--by", "Fixture", "--request", "L'essai a été fait sur la mauvaise URL, à refaire."]).status, 0);
  await writeFile(join(g.code, "README.md"), README + "\nX.\n");
  await beginPhase(g.w, g.p.id, "Fixture", "Reprends.");
  const reopened = await previewContinuity(g.w, g.p.id, o2.proof);
  assert.ok(reopened.blockers.some(b => /rouverte ou réinitialisée depuis l'essai sans acceptation/.test(b)));
  await assert.rejects(carry(g, o2.proof, ["README.md"]), /reopen par Fixture : « L'essai a été fait sur la mauvaise URL, à refaire\. »/);

  // The compact context exposes the identifier needed by --proof, even once historical.
  const compact = (await contextView(g.w, g.p.id)).output;
  assert.equal(compact.latest_human_observations?.[g.human]?.proof, o2.proof);
});

test("revue distincte : readme-check reste consultatif sur un encodage invalide et lit « This package »", async (t) => {
  const { checkReadme } = await import("../dist/lib/readme-check.js");
  const base = await mkdtemp(join(tmpdir(), "starter-readme-review-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  await writeFile(join(base, "LICENSE"), "Apache License\nVersion 2.0, January 2004\n");
  await writeFile(join(base, "README.md"), "# Outil\n\n[taux](docs/100%.md) et [ancre](#100%).\n\nThis package is released under the MIT License.\n");
  const result = await checkReadme(base);
  assert.ok(result.findings.some(f => f.code === "LINK_MISSING"));
  assert.ok(result.findings.some(f => f.code === "ANCHOR_MISSING"));
  assert.ok(result.findings.some(f => f.code === "LICENSE_MISMATCH" && /MIT.*Apache/.test(f.message)));
  const cli = spawnSync(process.execPath, [resolve("dist/index.js"), "workflow", "readme-check", "--code-root", base], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
});

test("revue ChatGPT 1-2 : commentaire suivi de code et script composé restent analysés", async (t) => {
  const consumed = [
    ["bloc-en-ligne", { "show.js": "import fs from 'node:fs';\n/* affichage */ console.log(fs.readFileSync('docs/value.md', 'utf8'));\n" }],
    ["script-composé", { "package.json": JSON.stringify({ name: "f", private: true, scripts: { build: "prettier --check . && mkdir -p dist && cp docs/value.md dist/value.md" } }) }],
    ["gabarit-multiligne", { "page.js": "import { readFileSync } from 'node:fs';\nexport const page = `\n// ${readFileSync('docs/value.md', 'utf8')}\n`;\n" }],
    ["python-triple", { "build.py": "TEMPLATE = \"\"\"\n# {open('docs/value.md').read()}\n\"\"\"\n" }],
    ["shell-heredoc", { "build.sh": "cat <<EOF > dist/x.html\n# $(cat docs/value.md)\nEOF\n" }],
    ["fin-de-bloc", { "show.ts": "/*\n * Affichage\n */ export const v = readFileSync('docs/value.md');\n" }],
  ];
  for (const [name, files] of consumed) {
    const f = await product(t, { files: { ...files, "docs/value.md": "2\n" } });
    const origin = await observe(f);
    await writeFile(join(f.code, "docs/value.md"), "3\n");
    const preview = await previewContinuity(f.w, f.p.id, origin.proof);
    assert.equal(preview.recordable, false, `${name} : ${JSON.stringify(preview.changes)}`);
    await assert.rejects(carry(f, origin.proof, ["docs/value.md"]), /Continuité refusée/, name);
  }
  // Whole-line comments only, in recognised languages, are ignored; a lone formatter script too.
  const ignored = {
    "a.js": "// voir docs/value.md\n/*\n * docs/value.md\n */\nexport const a = 1;\n",
    "b.py": "# docs/value.md\nVALUE = 1\n",
    "package.json": JSON.stringify({ name: "f", private: true, scripts: { format: "prettier --write \"**/*.md\"" } }),
  };
  const f = await product(t, { files: { ...ignored, "docs/value.md": "2\n" } });
  const origin = await observe(f);
  await writeFile(join(f.code, "docs/value.md"), "3\n");
  const ok = await previewContinuity(f.w, f.p.id, origin.proof);
  assert.equal(ok.recordable, true, ok.blockers.join("\n"));
});

test("revue ChatGPT 3 : l'acceptation d'une autre phase n'autorise pas la continuité après réouverture", async (t) => {
  const f = await product(t);
  await applyPlan(f.w, [...(await loadWorkflow(f.w)).phases.map(p => ({ ...p })),
    { title: "Soustraction", goal: "Soustraire", validation: "5 - 3 = 2", tasks: [{ title: "Vérifier la soustraction", human: false }] }],
    "Fixture", "Ajout indépendant.");
  const second = (await loadWorkflow(f.w)).phases[1];
  await check(f);
  const origin = await observe(f);
  await review(f); // Reviewed, never accepted.
  assert.equal(run(f.w, ["reopen", "1", "--by", "Fixture", "--request", "Essai sur mauvaise URL, à refaire."]).status, 0);
  await beginPhase(f.w, second.id, "Fixture", "Réalise la phase 2.");
  await recordProof(f.w, second.id, "builder", "Contrôle", "check", [second.tasks[0].id], { command: [process.execPath, "-e", "process.exit(0)"] });
  const context = await status(f.w, second.id), report = join(f.base, "review-2.json");
  await writeFile(report, JSON.stringify({ code_hash: context.code_hash, contract_hash: context.contract_hash, summary: "Revue synthétique phase 2." }));
  await recordProof(f.w, second.id, "reviewer", "Revue", "review", [], { report, verdict: "passed", independent: true });
  assert.equal(run(f.w, ["accept", "2", "--by", "Fixture", "--request", "J'accepte la phase 2."]).status, 0);
  await writeFile(join(f.code, "README.md"), README + "\nRéorganisé.\n");
  await beginPhase(f.w, f.p.id, "Fixture", "Reprends la phase 1.");
  const preview = await previewContinuity(f.w, f.p.id, origin.proof);
  assert.equal(preview.recordable, false);
  assert.ok(preview.blockers.some(b => /sans acceptation retrouvée de cette phase, à cette itération/.test(b)), preview.blockers.join("\n"));
  await assert.rejects(carry(f, origin.proof, ["README.md"]), /Essai sur mauvaise URL, à refaire/);
  assert.equal((await status(f.w, f.p.id)).status.done.includes(f.human), false);
});

test("revue adverse : directives, interpolations, fins de ligne et scripts de rendu ne sont jamais ignorés", async (t) => {
  const { examineChanges } = await import("../dist/lib/evidence-continuity.js");
  const { tree } = await import("../dist/lib/phase-workflow.js");
  const cases = {
    "go-embed": { "main.go": "package main\n\nimport _ \"embed\"\n\n//go:embed docs/value.md\nvar value string\n" },
    "jsx-js": { "page.js": "import fs from 'node:fs';\nexport const P = () => <main><p>\n    //{fs.readFileSync(\"docs/value.md\", \"utf8\")}\n  </p></main>;\n" },
    "php-annotation": { "Controller.php": "<?php\n/** @Template(\"docs/value.md\") */\nclass C {}\n" },
    "ruby-squiggly": { "gen.rb": "page = <<~HTML\n  #{File.read(\"docs/value.md\")}\nHTML\n" },
    "ruby-percent": { "gen.rb": "page = %(\n#{File.read(\"docs/value.md\")}\n)\n" },
    "shell-backslash-heredoc": { "gen.sh": "cat > gen.rb <<\\EOF\n#{File.read(\"docs/value.md\")}\nEOF\n" },
    "js-cr-only": { "a.js": "// header\rconst v = require(\"fs\").readFileSync(\"docs/value.md\",\"utf8\");\r" },
    "js-u2028": { "a.js": "// note const v = require(\"fs\").readFileSync(\"docs/value.md\");\n" },
    "py-cr-only": { "a.py": "# header\rprint(open(\"docs/value.md\").read())\r" },
    "webpack-magic": { "load.js": "export const load = (base, name) => import(\n  /* webpackInclude: /\\.md$/ */\n  `./${base}/${name}`\n);\n", doc: "manuel/value.md" },
    "remark-output": { "package.json": JSON.stringify({ name: "f", scripts: { build: "remark docs/value.md --use remark-html -o public/value.html" } }) },
    "prefix-binary": { "package.json": JSON.stringify({ name: "f", scripts: { build: "prettier-copy docs/value.md dist/" } }) },
    "eslint-output": { "package.json": JSON.stringify({ name: "f", scripts: { lint: "eslint docs/value.md -o dist/value.md" } }) },
    "npm-files": { "package.json": JSON.stringify({ name: "f", files: ["dist", "docs/value.md"] }) },
  };
  for (const [name, spec] of Object.entries(cases)) {
    const { doc = "docs/value.md", ...files } = spec;
    const root = await mkdtemp(join(tmpdir(), "starter-adverse-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [path, content] of Object.entries({ ...files, [doc]: "v1\n" })) {
      await mkdir(join(root, path, ".."), { recursive: true });
      await writeFile(join(root, path), content);
    }
    const before = await tree(root);
    await writeFile(join(root, doc), "v2\n");
    const { changes } = await examineChanges(root, before, await tree(root));
    assert.equal(changes[0].eligible, false, name);
  }
});

test("revue adverse : réouverture mettant en cause l'essai et restauration d'état empêchent la continuité", async (t) => {
  async function accepted(t) {
    const f = await product(t);
    await check(f);
    const origin = await observe(f);
    await review(f);
    assert.equal(run(f.w, ["accept", "1", "--by", "Fixture", "--request", "J'accepte."]).status, 0);
    return { f, origin };
  }
  // S1: the reopen reason questions the trial.
  const a = await accepted(t);
  assert.equal(run(a.f.w, ["reopen", "1", "--by", "Fixture", "--request", "L'essai était faux : en vrai 2 + 3 affiche 6, à refaire."]).status, 0);
  await beginPhase(a.f.w, a.f.p.id, "Fixture", "Reprends.");
  await writeFile(join(a.f.code, "README.md"), README + "\nX.\n");
  assert.ok((await previewContinuity(a.f.w, a.f.p.id, a.origin.proof)).blockers.some(b => /Motif de réouverture mettant en cause l'essai/.test(b)));

  // S2: a failed re-trial erased by restore-state cannot be overridden by the older observation.
  const b = await accepted(t);
  const history = join(b.f.w, ".starter/history");
  let snapshot = null;
  for (const name of (await readdir(history)).filter(n => n.startsWith("revision-")).sort((x, y) => Number(x.split("-")[1]) - Number(y.split("-")[1])))
    if (JSON.parse(await readFile(join(history, name), "utf8")).phases[0]?.acceptance) { snapshot = name; break; }
  assert.ok(snapshot);
  assert.equal(run(b.f.w, ["reopen", "1", "--by", "Fixture", "--request", "Rouvrir pour le commit."]).status, 0);
  await beginPhase(b.f.w, b.f.p.id, "Fixture", "Reprends.");
  await recordProof(b.f.w, b.f.p.id, "Fixture", "Observation synthétique", "observation", [b.f.human], { summary: "Échec.", verdict: "failed" });
  assert.equal(run(b.f.w, ["restore-state", "--snapshot", `.starter/history/${snapshot}`, "--by", "Fixture", "--request", "Restaurer (test)."]).status, 0);
  await beginPhase(b.f.w, b.f.p.id, "Fixture", "Reprends après restauration.");
  await writeFile(join(b.f.code, "README.md"), README + "\nY.\n");
  const restored = await previewContinuity(b.f.w, b.f.p.id, b.origin.proof);
  assert.equal(restored.recordable, false);
  assert.ok(restored.blockers.some(b => /État restauré depuis l'essai/.test(b)), restored.blockers.join("\n"));
});
