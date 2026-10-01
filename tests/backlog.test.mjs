import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";

import { parseFrontmatter, stringifyFrontmatter } from "../dist/lib/frontmatter.js";
import {
  VIEW_BEGIN,
  VIEW_END,
  derivePhaseState,
  deriveItemState,
  deriveTaskState,
  extractRoadmapBlock,
  renderRoadmap,
  replaceRoadmapBlock,
} from "../dist/lib/backlog.js";

const starterRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(starterRoot, "dist", "index.js");
const fixturesRoot = join(starterRoot, "tests", "fixtures");
const v2Fixture = join(fixturesRoot, "backlog-v2-roadmap");
const v1Fixture = join(fixturesRoot, "backlog-v1-legacy");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "universal-ai-backlog-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

/** Workspace réel avec le backlog v2 de référence et son unité héritée. */
async function prepareV2Workspace(sandbox, name) {
  const target = join(sandbox, name);
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", name, "--target", target, "--no-git"], sandbox).status, 0);
  await mkdir(join(workspace, "reports"), { recursive: true });
  await mkdir(join(workspace, "taches"), { recursive: true });
  await cp(join(v2Fixture, "BACKLOG.md"), join(workspace, "taches", "BACKLOG.md"));
  await cp(join(v2Fixture, "WORK-001.md"), join(workspace, "taches", "WORK-001.md"));
  await cp(join(v2Fixture, "setup-report.md"), join(workspace, "reports", "setup-report.md"));
  await cp(join(v2Fixture, "decisions.md"), join(workspace, "docs", "decisions.md"));
  return { target, workspace };
}

async function prepareV1Workspace(sandbox, name) {
  const target = join(sandbox, name);
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", name, "--target", target, "--no-git"], sandbox).status, 0);
  await mkdir(join(workspace, "reports"), { recursive: true });
  await mkdir(join(workspace, "taches"), { recursive: true });
  for (const file of await readdir(v1Fixture)) {
    await cp(join(v1Fixture, file), join(workspace, "taches", file));
  }
  await cp(join(v2Fixture, "setup-report.md"), join(workspace, "reports", "setup-report.md"));
  return { target, workspace };
}

async function readBacklog(workspace) {
  return parseFrontmatter(await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8"));
}

async function writeBacklog(workspace, attributes, body) {
  await writeFile(
    join(workspace, "taches", "BACKLOG.md"),
    stringifyFrontmatter(attributes, body),
  );
}

/** Modifie le frontmatter puis régénère la vue, afin que seul l'invariant testé échoue. */
async function mutateBacklog(workspace, mutate) {
  const parsed = await readBacklog(workspace);
  mutate(parsed.attributes);
  const units = [
    {
      id: "WORK-001",
      path: "",
      title: "Prototype du déplacement du curseur",
      status: "proposed",
      realizes: [],
      crossCutting: false,
      body: "",
    },
  ];
  const rendered = renderRoadmap(parsed.attributes, units);
  await writeBacklog(workspace, parsed.attributes, replaceRoadmapBlock(parsed.body, rendered));
}

function doctorReport(workspace, sandbox) {
  const result = runCli(["doctor", workspace, "--json"], sandbox);
  return JSON.parse(result.stdout);
}

function codes(report, severity) {
  return report.items
    .filter((item) => (severity ? item.severity === severity : true))
    .map((item) => item.code);
}

function findItem(attributes, id) {
  const item = attributes.items.find((entry) => entry.id === id);
  assert.ok(item, `résultat ${id} absent de la fixture`);
  return item;
}

// ---------------------------------------------------------------------------
// Rendu déterministe
// ---------------------------------------------------------------------------

test("le rendu de la roadmap correspond octet à octet à la référence", async () => {
  const parsed = parseFrontmatter(await readFile(join(v2Fixture, "BACKLOG.md"), "utf8"));
  const workUnit = parseFrontmatter(await readFile(join(v2Fixture, "WORK-001.md"), "utf8"));
  const units = [
    {
      id: workUnit.attributes.id,
      path: "",
      title: workUnit.attributes.title,
      status: workUnit.attributes.status,
      realizes: workUnit.attributes.realizes ?? [],
      crossCutting: workUnit.attributes.cross_cutting === true,
      body: workUnit.body,
    },
  ];
  const expected = await readFile(join(v2Fixture, "expected-view.md"), "utf8");
  assert.equal(`${renderRoadmap(parsed.attributes, units)}\n`, expected);
});

test("la vue de référence porte exactement les comptes attendus", async () => {
  const view = await readFile(join(v2Fixture, "expected-view.md"), "utf8");

  // Totaux globaux : 5 tâches obligatoires terminées sur 18 réellement déclarées.
  assert.match(view, /\*\*Construction : 5\/18 tâches obligatoires terminées\.\*\*/);
  assert.match(view, /\*\*Résultats obligatoires : 1\/18 acceptés\.\*\*/);
  assert.match(view, /\*\*Détail : 3 résultats détaillés, 16 encore sans tâche\.\*\*/);

  // Totaux par phase.
  assert.match(view, /### PH-0 — Socle du projet — `complete` · résultats 1\/1 · construction 5\/5/);
  assert.match(view, /### PH-1 — Prouver le pavé tactile — `not_started` · résultats 0\/2 · construction 0\/13/);
  assert.match(view, /### PH-2 — Compléter le pavé — `not_started` · résultats 0\/2 · non détaillée/);
  assert.match(view, /### PH-3 — Lien durable et sûr — `not_started` · résultats 0\/4 · non détaillée/);
  assert.match(view, /### PH-4 — Commandes courantes — `not_started` · résultats 0\/5 · non détaillée/);
  assert.match(view, /### PH-5 — Utilisable au quotidien — `not_started` · résultats 0\/4 · non détaillée/);

  // Une phase sans résultat obligatoire est `optional`, jamais `complete` à 0/0.
  assert.match(view, /### PH-6 — Expérimental — `optional` · résultats 0\/0 · non détaillée/);
  assert.doesNotMatch(view, /PH-6[^\n]*`complete`/);

  // Tâches obligatoires et optionnelles distinguées.
  assert.match(view, /#### BLG-009 — Clic par tap\n`ready` · P0 · après BLG-001 · construction 0\/4 \(\+1 optionnelle\)/);
  assert.match(view, /- \[ \] `TSK-019` Retour haptique au clic\. · ux · optionnelle/);

  // Résultats détaillés : cases cochées avec preuve, non cochées sans preuve.
  assert.match(view, /- \[x\] `TSK-001` Approuver le brief produit\. · produit · preuve : docs\/decisions\.md#DEC-013/);
  assert.match(view, /- \[ \] `TSK-006` Définir le message de déplacement partagé \(deltas\)\. · architecture/);
  assert.equal(view.match(/^- \[x\] /gm).length, 5);
  assert.equal(view.match(/^- \[ \] /gm).length, 14);

  // Résultats non détaillés : une ligne compacte, sans construction ni verdict de résultat.
  assert.match(view, /^- `BLG-002` — Défilement à deux doigts — `candidate` · P1 · après BLG-001$/m);
  assert.equal(view.match(/^- `BLG-/gm).length, 16);

  // Filiation, unité liée et lien historique visibles.
  assert.match(view, /issu de BLG-001/);
  assert.match(view, /Unités associées : `WORK-001` — Prototype du déplacement du curseur — `proposed`/);
  assert.match(view, /⚠ 1 lien historique à convertir : `BLG-001` ← `WORK-001`\./);
});

test("aucun état autre que done ne produit une case cochée", () => {
  const base = {
    id: "TSK-001",
    title: "t",
    category: "tech",
    required: true,
    disposition: "active",
    derived_from: [],
    origin: "planned",
    source_work: null,
    origin_reason: null,
    added_at: null,
    blocked_reason: null,
    dropped_by: null,
    dropped_at: null,
    dropped_reason: null,
    evidence_log: [],
  };
  const valid = {
    id: "EV-001",
    kind: "test",
    ref: "reports/work/WORK-001.md",
    recorded_at: "2026-09-02",
    observed_by: null,
    state: "valid",
    state_reason: null,
    state_at: null,
  };
  assert.equal(deriveTaskState(base), "todo");
  assert.equal(deriveTaskState({ ...base, disposition: "blocked" }), "blocked");
  assert.equal(deriveTaskState({ ...base, disposition: "dropped" }), "dropped");
  assert.equal(deriveTaskState({ ...base, evidence_log: [valid] }), "done");

  // Une preuve invalidée ramène seule la tâche à son état éditorial : aucun second statut.
  const invalidated = { ...valid, state: "invalidated", state_reason: "faux", state_at: "2026-09-03" };
  assert.equal(deriveTaskState({ ...base, evidence_log: [invalidated] }), "todo");
  assert.equal(
    deriveTaskState({ ...base, disposition: "blocked", evidence_log: [invalidated] }),
    "blocked",
  );
});

test("un résultat sans tâche obligatoire n'est jamais built ni done", async () => {
  const parsed = parseFrontmatter(await readFile(join(v2Fixture, "BACKLOG.md"), "utf8"));
  const empty = findItem(parsed.attributes, "BLG-002");
  assert.equal(empty.tasks.length, 0);
  assert.equal(deriveItemState(empty, []), "candidate");
  assert.equal(
    deriveItemState({ ...empty, outcome_accepted_by: "Kelly", outcome_accepted_at: "2026-09-02" }, []),
    "candidate",
  );

  const built = findItem(parsed.attributes, "BLG-008");
  assert.equal(deriveItemState(built, []), "done");
  assert.equal(
    deriveItemState({ ...built, outcome_accepted_by: null, outcome_accepted_at: null }, []),
    "built",
  );
});

test("une tâche obligatoire abandonnée continue de bloquer le résultat", async () => {
  const parsed = parseFrontmatter(await readFile(join(v2Fixture, "BACKLOG.md"), "utf8"));
  const item = structuredClone(findItem(parsed.attributes, "BLG-008"));
  const target = item.tasks[4];
  target.evidence_log = [];
  target.disposition = "dropped";
  target.dropped_by = "Kelly";
  target.dropped_at = "2026-09-02";
  target.dropped_reason = "hors périmètre";
  assert.equal(deriveTaskState(target), "dropped");
  assert.equal(deriveItemState(item, []), "in_progress");
});

test("une phase devient in_progress dès qu'une unité est active, sans aucune tâche terminée", async () => {
  const parsed = parseFrontmatter(await readFile(join(v2Fixture, "BACKLOG.md"), "utf8"));
  const phase = parsed.attributes.phases.find((entry) => entry.id === "PH-1");
  const items = parsed.attributes.items;
  const proposed = [
    { id: "WORK-001", path: "", title: "u", status: "proposed", realizes: [], crossCutting: false, body: "" },
  ];
  assert.equal(derivePhaseState(phase, items, proposed), "not_started");

  const approved = [{ ...proposed[0], status: "approved", realizes: ["TSK-006"] }];
  assert.equal(derivePhaseState(phase, items, approved), "in_progress");
});

// ---------------------------------------------------------------------------
// backlog sync-view
// ---------------------------------------------------------------------------

test("sync-view répare une vue périmée et reste idempotente", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "sync-view-test");
  const path = join(workspace, "taches", "BACKLOG.md");

  assert.equal(runCli(["backlog", "sync-view", workspace, "--check"], sandbox).status, 0);

  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace("Construction : 5/18", "Construction : 9/18"));

  const stale = runCli(["backlog", "sync-view", workspace, "--check"], sandbox);
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /ne correspond plus aux données structurées/);

  const repaired = runCli(["backlog", "sync-view", workspace], sandbox);
  assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);
  assert.equal(await readFile(path, "utf8"), original);

  runCli(["backlog", "sync-view", workspace], sandbox);
  assert.equal(await readFile(path, "utf8"), original, "sync-view doit être idempotente");
});

test("sync-view ne touche aucun octet du récit rédigé à la main", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "sync-view-narrative-test");
  const path = join(workspace, "taches", "BACKLOG.md");

  const narrativeOf = (body) =>
    body.slice(0, body.indexOf(VIEW_BEGIN)) + body.slice(body.indexOf(VIEW_END) + VIEW_END.length);

  const narrativeBefore = narrativeOf((await readBacklog(workspace)).body);

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-002").priority = "P0";
  });
  runCli(["backlog", "sync-view", workspace], sandbox);

  const after = await readBacklog(workspace);
  assert.equal(narrativeOf(after.body), narrativeBefore, "le récit doit rester identique octet à octet");
  assert.match(
    extractRoadmapBlock(after.body),
    /- `BLG-002` — Défilement à deux doigts — `candidate` · P0/,
  );
  assert.equal(runCli(["backlog", "sync-view", workspace, "--check"], sandbox).status, 0);
  assert.ok(await readFile(path, "utf8"));
});

test("un titre contenant des métacaractères Markdown traverse sync-view sans corruption", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "sync-view-hostile-title-test");
  const hostile = "Titre *gras* _souligné_ [lien] `code` — <!-- pas un marqueur -->";

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-002").title = hostile;
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.equal(runCli(["backlog", "sync-view", workspace, "--check"], sandbox).status, 0);

  const parsed = await readBacklog(workspace);
  assert.equal(findItem(parsed.attributes, "BLG-002").title, hostile);
  assert.ok(extractRoadmapBlock(parsed.body)?.includes(hostile));

  const report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("BACKLOG_")));
});

test("sync-view insère le bloc absent au lieu d'échouer", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "sync-view-insert-test");
  const path = join(workspace, "taches", "BACKLOG.md");

  const parsed = await readBacklog(workspace);
  const begin = parsed.body.indexOf(VIEW_BEGIN);
  const end = parsed.body.indexOf(VIEW_END) + VIEW_END.length;
  await writeBacklog(workspace, parsed.attributes, parsed.body.slice(0, begin) + parsed.body.slice(end));

  const missing = doctorReport(workspace, sandbox);
  assert.ok(codes(missing, "blocked").includes("BACKLOG_VIEW_MISSING"));

  const inserted = runCli(["backlog", "sync-view", workspace], sandbox);
  assert.equal(inserted.status, 0, inserted.stderr || inserted.stdout);
  assert.match(inserted.stdout, /Bloc de roadmap inséré/);
  assert.ok((await readFile(path, "utf8")).includes(VIEW_BEGIN));
});

// ---------------------------------------------------------------------------
// Invariants du Doctor
// ---------------------------------------------------------------------------

test("doctor accepte le backlog v2 de référence et signale seulement le lien historique", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-v2-valid-test");
  const report = doctorReport(workspace, sandbox);

  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("BACKLOG_")));
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("WORK_")));
  assert.ok(codes(report).includes("BACKLOG_ITEMS_VALID"));
  assert.ok(codes(report, "warning").includes("BACKLOG_LEGACY_LINK_PENDING"));
});

test("doctor bloque une vue générée périmée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-view-stale-test");
  const path = join(workspace, "taches", "BACKLOG.md");
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace("· produit ·", "· PRODUIT ·"));

  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_VIEW_STALE"));
});

test("doctor bloque un titre de section divergeant du frontmatter", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-heading-test");
  // Modifier uniquement le récit, après le bloc généré : la vue reste à jour,
  // seule la concordance des titres est en cause.
  const parsed = await readBacklog(workspace);
  const cut = parsed.body.indexOf(VIEW_END) + VIEW_END.length;
  const narrative = parsed.body
    .slice(cut)
    .replace("### BLG-009 — Clic par tap", "### BLG-009 — Autre chose");
  await writeBacklog(workspace, parsed.attributes, parsed.body.slice(0, cut) + narrative);

  const report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").includes("BACKLOG_VIEW_STALE"));
  assert.ok(codes(report, "blocked").includes("BACKLOG_HEADING_MISMATCH"));
});

test("doctor bloque un stage ready sans tâche obligatoire, mais jamais un candidate sans tâche", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-ready-task-test");

  // La fixture contient 16 résultats `candidate` sans tâche : la planification progressive est silencieuse.
  const silent = doctorReport(workspace, sandbox);
  assert.ok(!codes(silent).some((code) => code === "BACKLOG_READY_WITHOUT_TASK"));

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-002").stage = "ready";
  });
  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_READY_WITHOUT_TASK"));
});

test("doctor bloque une preuve manquante, superflue ou inexpliquée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-evidence-test");

  await mutateBacklog(workspace, (attributes) => {
    const task = findItem(attributes, "BLG-008").tasks[0];
    task.evidence_log[0].state = "superseded";
  });
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_EVIDENCE_STATE_UNEXPLAINED"));

  await mutateBacklog(workspace, (attributes) => {
    const task = findItem(attributes, "BLG-008").tasks[0];
    task.evidence_log[0].state = "valid";
    task.evidence_log.push({ ...task.evidence_log[0], id: "EV-006" });
    attributes.id_allocation.next_evidence = 7;
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_EVIDENCE_MULTIPLE_VALID"));
});

test("doctor bloque une preuve documentaire pointant un fichier inexistant", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-evidence-ref-test");
  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-008").tasks[0].evidence_log[0].ref = "docs/inexistant.md#DEC-013";
  });
  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_TASK_EVIDENCE_REF_MISSING"));
});

test("doctor refuse qu'une vérification humaine soit validée autrement que par une observation nommée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-human-evidence-test");

  // Une preuve automatisée ne peut pas valider une tâche `human`.
  await mutateBacklog(workspace, (attributes) => {
    const task = findItem(attributes, "BLG-001").tasks[8];
    assert.equal(task.category, "human");
    task.evidence_log = [
      {
        id: "EV-006",
        kind: "test",
        ref: "reports/setup-report.md",
        recorded_at: "2026-09-02",
        observed_by: null,
        state: "valid",
        state_reason: null,
        state_at: null,
      },
    ];
    attributes.id_allocation.next_evidence = 7;
  });
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_TASK_HUMAN_EVIDENCE_INVALID"));

  // Une observation sans observateur nommé est refusée elle aussi.
  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").tasks[8].evidence_log[0].kind = "observation";
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_TASK_EVIDENCE_OBSERVER_MISSING"));

  // Avec une personne nommée, la tâche est acceptée.
  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").tasks[8].evidence_log[0].observed_by = "Kelly";
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("BACKLOG_TASK_")));
});

test("doctor bloque une acceptation de résultat prématurée ou concurrente d'une unité active", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-acceptance-test");

  await mutateBacklog(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-001");
    item.outcome_accepted_by = "Kelly";
    item.outcome_accepted_at = "2026-09-02";
  });
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_ITEM_ACCEPTANCE_UNEXPECTED"));

  // Toutes les tâches terminées, mais une unité liée encore active : acceptation refusée.
  await writeFile(
    join(workspace, "taches", "WORK-001.md"),
    (await readFile(join(workspace, "taches", "WORK-001.md"), "utf8")).replace(
      "status: proposed",
      "status: in_progress",
    ),
  );
  await mutateBacklog(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-001");
    let next = attributes.id_allocation.next_evidence;
    for (const task of item.tasks) {
      task.evidence_log = [
        {
          id: `EV-${String(next).padStart(3, "0")}`,
          kind: task.category === "human" ? "observation" : "report",
          ref: task.category === "human" ? "constat direct" : "reports/setup-report.md",
          recorded_at: "2026-09-02",
          observed_by: task.category === "human" ? "Kelly" : null,
          state: "valid",
          state_reason: null,
          state_at: null,
        },
      ];
      next += 1;
    }
    attributes.id_allocation.next_evidence = next;
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_ITEM_DONE_WITH_ACTIVE_WORK"));
});

test("doctor bloque une dépendance vers l'aval et un ordre dupliqué dans une phase", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-order-test");

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").depends_on = ["BLG-009"];
  });
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_DEPENDENCY_FORWARD"));

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").depends_on = [];
    findItem(attributes, "BLG-009").order = 1;
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_ORDER_DUPLICATE"));
});

test("doctor protège la stabilité des identifiants de phases, résultats, tâches et preuves", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-id-stability-test");

  for (const [key, mutate] of [
    ["next_phase", (attributes) => attributes.phases.push({
      id: "PH-9",
      title: "Phase hors compteur",
      goal: "Créée sans avancer le compteur.",
      disposition: "active",
      prepared_by: null,
      prepared_at: null,
    })],
    ["next_item", (attributes) => { findItem(attributes, "BLG-002").id = "BLG-099"; }],
    ["next_task", (attributes) => { findItem(attributes, "BLG-008").tasks[0].id = "TSK-099"; }],
    ["next_evidence", (attributes) => {
      findItem(attributes, "BLG-008").tasks[0].evidence_log[0].id = "EV-099";
    }],
  ]) {
    const fresh = await prepareV2Workspace(sandbox, `doctor-id-${key}-test`);
    await mutateBacklog(fresh.workspace, mutate);
    const report = doctorReport(fresh.workspace, sandbox);
    assert.ok(
      codes(report, "blocked").includes("BACKLOG_ID_ALLOCATION_VIOLATION"),
      `${key} devrait être protégé par son compteur`,
    );
  }

  // Une filiation vers un identifiant jamais alloué est refusée.
  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-009").derived_from = ["BLG-777"];
  });
  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_DERIVED_FROM_UNKNOWN"));
});

// Les invariants d'identité sont vérifiés dans l'état courant (unicité, format,
// compteur, filiations). Le starter ne compare pas le document à un état antérieur :
// voir le modèle de confiance dans core/contracts/planning.md §6bis.

test("doctor encadre une tâche découverte pendant une unité approuvée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-discovered-test");

  const workPath = join(workspace, "taches", "WORK-001.md");
  const work = await readFile(workPath, "utf8");
  await writeFile(
    workPath,
    work
      .replace("status: proposed", "status: approved")
      .replace("realizes: []", "realizes: [TSK-006]"),
  );

  const addDiscovered = (attributes, overrides = {}) => {
    const item = findItem(attributes, overrides.itemId ?? "BLG-001");
    item.tasks.push({
      id: "TSK-020",
      title: "Ajouter un encodage de secours découvert pendant le prototype.",
      category: "tech",
      required: true,
      disposition: "active",
      derived_from: [],
      origin: "discovered",
      source_work: overrides.sourceWork ?? "WORK-001",
      origin_reason: "Le protocole minimal ne couvrait pas les paquets hors ordre.",
      added_at: "2026-09-10",
      blocked_reason: null,
      dropped_by: null,
      dropped_at: null,
      dropped_reason: null,
      evidence_log: [],
    });
    attributes.id_allocation.next_task = 21;
    attributes.items = attributes.items.filter((entry) => entry.id !== "BLG-001" || true);
  };

  // Sans mention dans le rapport d'unité, la découverte est refusée.
  await mutateBacklog(workspace, (attributes) => addDiscovered(attributes));
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_TASK_DISCOVERED_UNREPORTED"));

  await mkdir(join(workspace, "reports", "work"), { recursive: true });
  await writeFile(
    join(workspace, "reports", "work", "WORK-001.md"),
    "# Rapport WORK-001\n\nTâche découverte : TSK-020 — paquets hors ordre.\n",
  );
  report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("BACKLOG_TASK_DISCOVERED")));

  // Une découverte visant un autre résultat que celui de l'unité est refusée.
  const foreign = await prepareV2Workspace(sandbox, "doctor-discovered-foreign-test");
  await cp(workPath, join(foreign.workspace, "taches", "WORK-001.md"));
  await mkdir(join(foreign.workspace, "reports", "work"), { recursive: true });
  await writeFile(
    join(foreign.workspace, "reports", "work", "WORK-001.md"),
    "# Rapport WORK-001\n\nTSK-020\n",
  );
  await mutateBacklog(foreign.workspace, (attributes) =>
    addDiscovered(attributes, { itemId: "BLG-009" }),
  );
  report = doctorReport(foreign.workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_TASK_DISCOVERED_INVALID"));
});

test("doctor bloque une unité traversant plusieurs résultats sans justification", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-cross-cutting-test");
  const workPath = join(workspace, "taches", "WORK-001.md");
  const work = await readFile(workPath, "utf8");

  await writeFile(workPath, work.replace("realizes: []", "realizes: [TSK-006, TSK-015]"));
  runCli(["backlog", "sync-view", workspace], sandbox);
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("WORK_CROSSES_ITEMS"));

  await writeFile(
    workPath,
    work
      .replace("realizes: []", "realizes: [TSK-006, TSK-015]")
      .replace("cross_cutting: false", "cross_cutting: true"),
  );
  runCli(["backlog", "sync-view", workspace], sandbox);
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("WORK_CROSS_CUTTING_UNJUSTIFIED"));

  await writeFile(
    workPath,
    `${work
      .replace("realizes: []", "realizes: [TSK-006, TSK-015]")
      .replace("cross_cutting: false", "cross_cutting: true")}\n## Justification du lot transversal\n\nLe protocole partagé change pour les deux gestes en même temps.\n`,
  );
  runCli(["backlog", "sync-view", workspace], sandbox);
  report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("WORK_CROSS")));
});

test("doctor bloque une unité réalisant une tâche inexistante", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-unknown-task-test");
  const workPath = join(workspace, "taches", "WORK-001.md");
  await writeFile(
    workPath,
    (await readFile(workPath, "utf8")).replace("realizes: []", "realizes: [TSK-999]"),
  );
  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("WORK_REALIZES_UNKNOWN_TASK"));
});

test("doctor bloque une phase vide seulement à l'approbation", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-phase-empty-test");

  await mutateBacklog(workspace, (attributes) => {
    attributes.items = attributes.items.filter((item) => item.phase !== "PH-6");
  });
  let report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "warning").includes("BACKLOG_PHASE_EMPTY"));
  assert.ok(!codes(report, "blocked").includes("BACKLOG_PHASE_EMPTY"));

  await mutateBacklog(workspace, (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-02";
  });
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("BACKLOG_PHASE_EMPTY"));
});

test("doctor avertit quand tous les résultats obligatoires d'une phase sont reportés", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "doctor-phase-deferred-test");
  await mutateBacklog(workspace, (attributes) => {
    for (const item of attributes.items) {
      if (item.phase === "PH-2") item.disposition = "deferred";
    }
    findItem(attributes, "BLG-002").disposition = "active";
    findItem(attributes, "BLG-002").required = false;
  });
  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "warning").includes("BACKLOG_PHASE_ALL_REQUIRED_DEFERRED"));
});

// ---------------------------------------------------------------------------
// Compatibilité v1 et migration
// ---------------------------------------------------------------------------

test("un backlog v1 produit un avertissement de migration, jamais un blocage", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "legacy-compat-test");
  const report = doctorReport(workspace, sandbox);

  assert.equal(report.verdict, "WARNING");
  assert.ok(codes(report, "warning").includes("BACKLOG_SCHEMA_LEGACY"));
  assert.ok(codes(report).includes("BACKLOG_CANDIDATES_VALID"));
  assert.ok(!codes(report, "blocked").some((code) => code.startsWith("BACKLOG_")));
});

test("backlog migrate --dry-run n'écrit ni backlog ni archive", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "migrate-dry-run-test");
  const path = join(workspace, "taches", "BACKLOG.md");
  const before = await readFile(path, "utf8");

  const result = runCli(["backlog", "migrate", workspace, "--dry-run"], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Aucun fichier écrit/);
  assert.equal(await readFile(path, "utf8"), before);

  await assert.rejects(
    readdir(join(workspace, "docs", "internal", "backlog-history")),
    /ENOENT/,
  );
});

test("backlog migrate transpose la structure sans rien inventer ni perdre", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "migrate-test");
  const workBefore = new Map();
  for (const id of ["WORK-001", "WORK-002"]) {
    workBefore.set(id, await readFile(join(workspace, "taches", `${id}.md`), "utf8"));
  }

  const result = runCli(["backlog", "migrate", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Liens historiques conservés : 2/);
  assert.match(result.stdout, /restent une décision de planification/);

  // Aucune unité n'est modifiée par la migration.
  for (const [id, content] of workBefore) {
    assert.equal(await readFile(join(workspace, "taches", `${id}.md`), "utf8"), content);
  }

  const archive = join(workspace, "docs", "internal", "backlog-history", "BACKLOG-v1-schema1.md");
  const archived = parseFrontmatter(await readFile(archive, "utf8"));
  assert.equal(archived.attributes.schema_version, 1);

  const parsed = await readBacklog(workspace);
  const attributes = parsed.attributes;
  assert.equal(attributes.schema_version, 2);
  assert.equal(attributes.backlog_version, 1, "un brouillon ne change pas de version");
  assert.equal(attributes.status, "draft");
  assert.equal(attributes.phases.length, 1);
  assert.equal(attributes.phases[0].id, "PH-1");

  // Correction 4 : aucun identifiant réservé pour des éléments qui n'existent pas.
  assert.deepEqual(attributes.id_allocation, {
    next_phase: 2,
    next_item: 5,
    next_task: 1,
    next_evidence: 1,
  });

  // Titres repris du corps v1, aucune tâche inventée, liens conservés.
  assert.equal(findItem(attributes, "BLG-001").title, "Pavé tactile de base : déplacement et clic réels du curseur");
  assert.ok(attributes.items.every((item) => item.tasks.length === 0));
  assert.deepEqual(findItem(attributes, "BLG-001").legacy_work_items, ["WORK-001"]);
  assert.deepEqual(findItem(attributes, "BLG-003").legacy_work_items, ["WORK-002"]);
  assert.equal(findItem(attributes, "BLG-004").disposition, "deferred");

  // Un élément migré ne peut pas être `ready` : il n'a aucune tâche obligatoire.
  assert.ok(attributes.items.every((item) => item.stage === "candidate"));
  assert.match(result.stdout, /BLG-001 était `ready` en v1 : ramené à `candidate`/);
  assert.match(result.stdout, /BLG-003 était `selected` en v1 : ramené à `candidate`/);

  // La migration ne laisse jamais un workspace bloqué.
  const report = doctorReport(workspace, sandbox);
  assert.notEqual(report.verdict, "BLOCKED");
  assert.ok(codes(report, "warning").includes("BACKLOG_LEGACY_LINK_PENDING"));
});

test("backlog migrate d'un backlog approuvé efface l'approbation et incrémente la version", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "migrate-approved-test");
  const path = join(workspace, "taches", "BACKLOG.md");
  const parsed = parseFrontmatter(await readFile(path, "utf8"));
  parsed.attributes.status = "approved";
  parsed.attributes.approved_by = "Kelly";
  parsed.attributes.approved_at = "2026-08-06";
  await writeFile(path, stringifyFrontmatter(parsed.attributes, parsed.body));

  const result = runCli(["backlog", "migrate", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /statut ramené à draft, approbation effacée/);

  const migrated = await readBacklog(workspace);
  assert.equal(migrated.attributes.backlog_version, 2);
  assert.equal(migrated.attributes.status, "draft");
  assert.equal(migrated.attributes.approved_by, null);
  assert.equal(migrated.attributes.approved_at, null);
});

test("backlog migrate refuse un backlog déjà en v2", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "migrate-already-v2-test");
  const before = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");

  const result = runCli(["backlog", "migrate", workspace], sandbox);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /déjà en schema_version 2/);
  assert.equal(await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8"), before);
});

// ---------------------------------------------------------------------------
// Correction 1 : la conversion des liens historiques n'est pas une impasse
// ---------------------------------------------------------------------------

// Le parcours complet de conversion des liens historiques — migration, création des
// tâches, report de `realizes`, retrait de `legacy_work_items`, levée du blocage
// PLAN_READY — est couvert par « parcours 8 » dans tests/backlog-workflow.test.mjs,
// sur des commandes réelles du produit.

test("la conversion des liens ne touche jamais le contenu contractuel de l'unité", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "legacy-conversion-contract-test");
  assert.equal(runCli(["backlog", "migrate", workspace], sandbox).status, 0);

  const workPath = join(workspace, "taches", "WORK-002.md");
  const before = parseFrontmatter(await readFile(workPath, "utf8"));

  await mutateLegacy(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-003");
    item.stage = "ready";
    item.tasks = [
      {
        id: "TSK-001",
        title: "Persister l'association entre sessions.",
        category: "data",
        required: true,
        disposition: "active",
        derived_from: [],
        origin: "planned",
        source_work: null,
        origin_reason: null,
        added_at: null,
        blocked_reason: null,
        dropped_by: null,
        dropped_at: null,
        dropped_reason: null,
        evidence_log: [],
      },
    ];
    attributes.id_allocation.next_task = 2;
  });

  // Seuls les trois champs structurels autorisés changent.
  await writeFile(
    workPath,
    stringifyFrontmatter(
      { ...before.attributes, title: "Association persistante", realizes: ["TSK-001"], cross_cutting: false },
      before.body,
    ),
  );
  runCli(["backlog", "sync-view", workspace], sandbox);

  const after = parseFrontmatter(await readFile(workPath, "utf8"));
  assert.equal(after.body, before.body, "le contenu contractuel de l'unité est intact");
  assert.equal(after.attributes.status, before.attributes.status);
  assert.equal(after.attributes.approved_by, before.attributes.approved_by);
  assert.equal(after.attributes.approved_at, before.attributes.approved_at);
  assert.equal(after.attributes.source_request, before.attributes.source_request);

  // Aucune tâche n'est cochée par la conversion : la construction reste à zéro.
  const parsed = await readBacklog(workspace);
  assert.ok(
    parsed.attributes.items.every((item) =>
      item.tasks.every((task) => task.evidence_log.length === 0),
    ),
    "aucune implémentation ne commence pendant la conversion",
  );
  assert.match(extractRoadmapBlock(parsed.body), /\*\*Construction : 0\/1 tâches obligatoires terminées\.\*\*/);
});

test("PLAN_READY reste refusé tant qu'un lien historique n'est pas converti", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1Workspace(sandbox, "legacy-plan-ready-test");
  assert.equal(runCli(["backlog", "migrate", workspace], sandbox).status, 0);

  const statePath = join(workspace, "PROJECT_STATE.md");
  const state = parseFrontmatter(await readFile(statePath, "utf8"));
  state.attributes.plan_version = 1;
  await writeFile(statePath, stringifyFrontmatter(state.attributes, state.body));

  const report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("PLAN_READY_LEGACY_LINKS_PENDING"));
});

/** Variante de `mutateBacklog` pour les workspaces issus de la fixture v1. */
async function mutateLegacy(workspace, mutate) {
  const parsed = await readBacklog(workspace);
  mutate(parsed.attributes);
  await writeBacklog(workspace, parsed.attributes, parsed.body);
  runCli(["backlog", "sync-view", workspace], workspace);
}

// ---------------------------------------------------------------------------
// Modèles et stratégie d'agents
// ---------------------------------------------------------------------------

test("les modèles livrés respectent leur schéma et leur vue générée", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  const backlogSchema = JSON.parse(
    await readFile(join(starterRoot, "core", "schemas", "backlog.schema.json"), "utf8"),
  );
  const backlogTemplate = parseFrontmatter(
    await readFile(
      join(starterRoot, "core", "skills", "project-plan", "assets", "backlog-template.md"),
      "utf8",
    ),
  );
  assert.ok(
    ajv.validate(backlogSchema, backlogTemplate.attributes),
    `backlog-template.md invalide : ${JSON.stringify(ajv.errors)}`,
  );
  assert.equal(
    extractRoadmapBlock(backlogTemplate.body),
    `\n\n${renderRoadmap(backlogTemplate.attributes, [])}\n\n`,
    "le modèle de backlog doit porter une vue générée à jour",
  );

  const strategySchema = JSON.parse(
    await readFile(join(starterRoot, "core", "schemas", "agent-strategy.schema.json"), "utf8"),
  );
  const strategyTemplate = parseFrontmatter(
    await readFile(
      join(starterRoot, "core", "skills", "project-plan", "assets", "agent-strategy-template.md"),
      "utf8",
    ),
  );
  assert.ok(
    ajv.validate(strategySchema, strategyTemplate.attributes),
    `agent-strategy-template.md invalide : ${JSON.stringify(ajv.errors)}`,
  );

  const workSchema = JSON.parse(
    await readFile(join(starterRoot, "core", "schemas", "work-item.schema.json"), "utf8"),
  );
  const workTemplate = parseFrontmatter(
    await readFile(
      join(starterRoot, "core", "skills", "project-work", "assets", "work-item-template.md"),
      "utf8",
    ),
  );
  assert.ok(
    ajv.validate(workSchema, workTemplate.attributes),
    `work-item-template.md invalide : ${JSON.stringify(ajv.errors)}`,
  );
});

test("le schéma de stratégie accepte les phases et refuse les tâches", async () => {
  const schema = JSON.parse(
    await readFile(join(starterRoot, "core", "schemas", "agent-strategy.schema.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const base = {
    schema_version: 1,
    strategy_version: 1,
    status: "draft",
    approved_by: null,
    approved_at: null,
    source_backlog_version: 1,
    entries: [],
  };

  assert.equal(
    validate({ ...base, entries: [{ id: "STR-001", covers: ["PH-1"], mode: "core_agent", agent_id: "builder" }] }),
    true,
  );
  assert.equal(
    validate({ ...base, entries: [{ id: "STR-001", covers: ["BLG-001"], mode: "main_conversation", agent_id: null }] }),
    true,
  );
  assert.equal(
    validate({ ...base, entries: [{ id: "STR-001", covers: ["TSK-001"], mode: "core_agent", agent_id: "builder" }] }),
    false,
    "aucun agent ne peut être recommandé pour une micro-tâche",
  );
});

test("une stratégie couvrant une phase inconnue est bloquée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "strategy-phase-test");
  const strategyPath = join(workspace, "docs", "agent-strategy.md");

  const write = async (covers) => {
    await writeFile(
      strategyPath,
      stringifyFrontmatter(
        {
          schema_version: 1,
          strategy_version: 1,
          status: "draft",
          approved_by: null,
          approved_at: null,
          source_backlog_version: 1,
          entries: [{ id: "STR-001", covers, mode: "main_conversation", agent_id: null }],
        },
        "\n# Stratégie d'agents\n\n## STR-001 — Test\n\n## Responsabilités volontairement sans agent\n",
      ),
    );
  };

  await write(["PH-0"]);
  let report = doctorReport(workspace, sandbox);
  assert.ok(!codes(report, "blocked").includes("AGENT_STRATEGY_CANDIDATE_MISSING"));

  await write(["PH-42"]);
  report = doctorReport(workspace, sandbox);
  assert.ok(codes(report, "blocked").includes("AGENT_STRATEGY_CANDIDATE_MISSING"));
});

// ---------------------------------------------------------------------------
// Non-régression de l'autorité
// ---------------------------------------------------------------------------

test("régénérer la vue ne dé-approuve jamais le backlog", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "sync-view-approval-test");

  await mutateBacklog(workspace, (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-02";
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  const parsed = await readBacklog(workspace);
  assert.equal(parsed.attributes.status, "approved");
  assert.equal(parsed.attributes.approved_by, "Kelly");
  assert.equal(parsed.attributes.approved_at, "2026-09-02");
  assert.equal(parsed.attributes.backlog_version, 1);
});

test("les résultats reportés et retirés restent visibles mais sortent des dénominateurs", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2Workspace(sandbox, "deferred-counters-test");

  await mutateBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-004").disposition = "deferred";
    findItem(attributes, "BLG-014").disposition = "retired";
  });

  const parsed = await readBacklog(workspace);
  const view = extractRoadmapBlock(parsed.body);
  assert.match(view, /\*\*Résultats obligatoires : 1\/16 acceptés\.\*\*/);
  assert.match(view, /1 résultat reporté, 1 retiré\./);
  assert.match(view, /`BLG-004` — Réglage du volume — `deferred`/);
  assert.match(view, /`BLG-014` — Lecture \/ pause — `retired`/);
});
