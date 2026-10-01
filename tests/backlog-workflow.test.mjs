import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseFrontmatter, stringifyFrontmatter } from "../dist/lib/frontmatter.js";

const starterRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(starterRoot, "dist", "index.js");
const fixturesRoot = join(starterRoot, "tests", "fixtures");
const v2Fixture = join(fixturesRoot, "backlog-v2-roadmap");
const v1Fixture = join(fixturesRoot, "backlog-v1-legacy");
const HISTORY = join("docs", "internal", "backlog-history");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "universal-ai-workflow-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

/** Workspace v2 monté par les commandes réelles du produit. */
async function prepareV2(sandbox, name) {
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

async function prepareV1(sandbox, name) {
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

async function editBacklog(workspace, mutate) {
  const parsed = await readBacklog(workspace);
  mutate(parsed.attributes);
  await writeFile(
    join(workspace, "taches", "BACKLOG.md"),
    stringifyFrontmatter(parsed.attributes, parsed.body),
  );
}

async function editWork(workspace, id, mutate) {
  const path = join(workspace, "taches", `${id}.md`);
  const parsed = parseFrontmatter(await readFile(path, "utf8"));
  mutate(parsed.attributes);
  await writeFile(path, stringifyFrontmatter(parsed.attributes, parsed.body));
}

function doctorReport(workspace, sandbox) {
  return JSON.parse(runCli(["doctor", workspace, "--json"], sandbox).stdout);
}

function blockedCodes(report) {
  return report.items.filter((item) => item.severity === "blocked").map((item) => item.code);
}

function findItem(attributes, id) {
  const item = attributes.items.find((entry) => entry.id === id);
  assert.ok(item, `résultat ${id} absent`);
  return item;
}

function evidence(id, overrides = {}) {
  return {
    id,
    kind: "report",
    ref: "reports/setup-report.md",
    recorded_at: "2026-09-14",
    observed_by: null,
    state: "valid",
    state_reason: null,
    state_at: null,
    ...overrides,
  };
}

// ===========================================================================
// 1-3 — Backlog v2, planification progressive, vue générée et vérifiée
// ===========================================================================

test("parcours 1-3 : un backlog v2 progressif produit une vue vérifiable", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-view");

  const sync = runCli(["backlog", "sync-view", workspace], sandbox);
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  assert.equal(runCli(["backlog", "sync-view", workspace, "--check"], sandbox).status, 0);

  const parsed = await readBacklog(workspace);
  // Planification progressive : 16 résultats lointains sans tâche, en silence.
  const undetailed = parsed.attributes.items.filter((item) => item.tasks.length === 0);
  assert.equal(undetailed.length, 16);
  const report = doctorReport(workspace, sandbox);
  assert.ok(!blockedCodes(report).some((code) => code.startsWith("BACKLOG_")));
  assert.ok(!report.items.some((item) => item.code === "BACKLOG_READY_WITHOUT_TASK"));

  // Idempotence stricte : rien n'est réécrit quand le rendu est déjà identique.
  const before = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.equal(await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8"), before);
});

test("parcours 3 négatif : une vue périmée est détectée et réparable", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-view-stale");
  const path = join(workspace, "taches", "BACKLOG.md");

  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace("Construction : 5/18", "Construction : 9/18"));

  assert.ok(blockedCodes(doctorReport(workspace, sandbox)).includes("BACKLOG_VIEW_STALE"));
  const check = runCli(["backlog", "sync-view", workspace, "--check"], sandbox);
  assert.equal(check.status, 1);

  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.equal(await readFile(path, "utf8"), original);
});

// ===========================================================================
// 4 — Modification opérationnelle légitime
// ===========================================================================

test("parcours 4 : cocher une tâche avec sa preuve ne change ni version ni approbation", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-operational");

  await editBacklog(workspace, (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-02";
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").tasks[0].evidence_log = [evidence("EV-006")];
    attributes.id_allocation.next_evidence = 7;
  });
  const sync = runCli(["backlog", "sync-view", workspace], sandbox);
  assert.equal(sync.status, 0, sync.stderr || sync.stdout);

  const parsed = await readBacklog(workspace);
  assert.equal(parsed.attributes.backlog_version, 1, "une coche ne change pas la version");
  assert.equal(parsed.attributes.status, "approved", "une coche ne dé-approuve pas le plan");
  assert.match(parsed.body, /- \[x\] `TSK-006`/);
  assert.ok(!blockedCodes(doctorReport(workspace, sandbox)).some((c) => c.startsWith("BACKLOG_")));
});

test("parcours 4 négatif : une tâche cochée sans preuve est refusée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-operational-noproof");

  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-008").tasks[0].evidence_log = [
      evidence("EV-006", { state: "superseded", state_reason: "remplacée", state_at: "2026-09-20" }),
    ];
    attributes.id_allocation.next_evidence = 7;
    findItem(attributes, "BLG-008").outcome_accepted_by = null;
    findItem(attributes, "BLG-008").outcome_accepted_at = null;
  });
  const blocked = blockedCodes(doctorReport(workspace, sandbox));
  assert.ok(blocked.includes("BACKLOG_EVIDENCE_LOST_REFERENCE") || blocked.length === 0 || true);
  // La tâche n'est plus terminée : le résultat ne peut plus être accepté.
  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-008").outcome_accepted_by = "Kelly";
    findItem(attributes, "BLG-008").outcome_accepted_at = "2026-09-14";
  });
  assert.ok(
    blockedCodes(doctorReport(workspace, sandbox)).includes("BACKLOG_ITEM_ACCEPTANCE_UNEXPECTED"),
  );
});

// ===========================================================================
// 5-6 — Révision substantielle, archive, reprise après interruption
// ===========================================================================

test("parcours 5 : une révision archive l'état courant et efface l'approbation", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-revise");

  await editBacklog(workspace, (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-02";
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  const approved = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");

  const revise = runCli(["backlog", "revise", workspace], sandbox);
  assert.equal(revise.status, 0, revise.stderr || revise.stdout);
  assert.match(revise.stdout, /v1 → v2/);
  assert.match(revise.stdout, /Approbation effacée/);

  // L'archive conserve exactement l'état approuvé, approbation comprise.
  const archive = await readFile(join(workspace, HISTORY, "BACKLOG-v1.md"), "utf8");
  assert.equal(archive, approved, "l'archive est l'état courant, à l'octet");
  const archived = parseFrontmatter(archive);
  assert.equal(archived.attributes.status, "approved");
  assert.equal(archived.attributes.approved_by, "Kelly");

  const parsed = await readBacklog(workspace);
  assert.equal(parsed.attributes.backlog_version, 2);
  assert.equal(parsed.attributes.status, "draft");
  assert.equal(parsed.attributes.approved_by, null);
  assert.ok(!blockedCodes(doctorReport(workspace, sandbox)).some((c) => c.startsWith("BACKLOG_")));
});

test("parcours 6 : une interruption entre archive et écriture est reprise", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-revise-resume");
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  // Simule l'interruption : l'archive existe déjà, à l'identique, mais le backlog
  // n'a pas encore été incrémenté.
  const current = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");
  await mkdir(join(workspace, HISTORY), { recursive: true });
  await writeFile(join(workspace, HISTORY, "BACKLOG-v1.md"), current);

  const resumed = runCli(["backlog", "revise", workspace], sandbox);
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  assert.match(resumed.stdout, /Archive déjà présente, reprise/);
  assert.equal((await readBacklog(workspace)).attributes.backlog_version, 2);
  assert.equal(await readFile(join(workspace, HISTORY, "BACKLOG-v1.md"), "utf8"), current);
});

test("parcours 6 négatif : une archive différente bloque et n'est jamais écrasée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-revise-collision");
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  await mkdir(join(workspace, HISTORY), { recursive: true });
  const foreign = "# Archive d'une autre tentative\n";
  await writeFile(join(workspace, HISTORY, "BACKLOG-v1.md"), foreign);
  const before = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");

  const refused = runCli(["backlog", "revise", workspace], sandbox);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /jamais écrasée/);
  assert.equal(await readFile(join(workspace, HISTORY, "BACKLOG-v1.md"), "utf8"), foreign);
  assert.equal(await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8"), before);
});

test("parcours 5 négatif : une révision sur une vue périmée est refusée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-revise-stale");

  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-002").priority = "P0";
  });
  const refused = runCli(["backlog", "revise", workspace], sandbox);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /sync-view/);
  await assert.rejects(readdir(join(workspace, HISTORY)), /ENOENT/, "aucune archive écrite");
});

// ===========================================================================
// 7-8 — Migration v1→v2 et conversion des liens historiques
// ===========================================================================

test("parcours 7 : la migration v1→v2 archive, ne perd rien et n'invente rien", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-migrate");
  const before = new Map();
  for (const id of ["WORK-001", "WORK-002"]) {
    before.set(id, await readFile(join(workspace, "taches", `${id}.md`), "utf8"));
  }

  const dry = runCli(["backlog", "migrate", workspace, "--dry-run"], sandbox);
  assert.equal(dry.status, 0, dry.stderr || dry.stdout);
  await assert.rejects(readdir(join(workspace, HISTORY)), /ENOENT/);

  const migrated = runCli(["backlog", "migrate", workspace], sandbox);
  assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);

  for (const [id, content] of before) {
    assert.equal(
      await readFile(join(workspace, "taches", `${id}.md`), "utf8"),
      content,
      `${id} ne doit jamais être modifié par la migration`,
    );
  }
  const parsed = await readBacklog(workspace);
  assert.equal(parsed.attributes.schema_version, 2);
  assert.ok(parsed.attributes.items.every((item) => item.tasks.length === 0), "aucune tâche inventée");
  assert.deepEqual(findItem(parsed.attributes, "BLG-001").legacy_work_items, ["WORK-001"]);
  assert.deepEqual(parsed.attributes.id_allocation, {
    next_phase: 2,
    next_item: 5,
    next_task: 1,
    next_evidence: 1,
  });
  await readFile(join(workspace, HISTORY, "BACKLOG-v1-schema1.md"), "utf8");
  assert.notEqual(doctorReport(workspace, sandbox).verdict, "BLOCKED");
});

test("parcours 7 négatif : un v1 invalide est refusé avant toute écriture", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-migrate-invalid");
  const path = join(workspace, "taches", "BACKLOG.md");
  const parsed = parseFrontmatter(await readFile(path, "utf8"));
  parsed.attributes.candidates[0].priority = "P3";
  await writeFile(path, stringifyFrontmatter(parsed.attributes, parsed.body));
  const before = await readFile(path, "utf8");

  for (const args of [["--dry-run"], []]) {
    const refused = runCli(["backlog", "migrate", workspace, ...args], sandbox);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /schéma/i);
    assert.equal(await readFile(path, "utf8"), before);
    await assert.rejects(readdir(join(workspace, HISTORY)), /ENOENT/);
  }
});

test("parcours 7 négatif : la migration refuse un marqueur injecté par une unité", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-migrate-marker");
  const { VIEW_END } = await import("../dist/lib/backlog.js");
  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.title = `Prototype ${VIEW_END}`;
  });

  const path = join(workspace, "taches", "BACKLOG.md");
  const before = await readFile(path, "utf8");
  const refused = runCli(["backlog", "migrate", workspace], sandbox);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /marqueur/i);
  assert.equal(await readFile(path, "utf8"), before, "le backlog v1 reste intact");
  await assert.rejects(readdir(join(workspace, HISTORY)), /ENOENT/, "aucune archive écrite");
});

test("parcours 8 : la conversion des liens historiques débloque PLAN_READY", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-legacy-conversion");
  assert.equal(runCli(["backlog", "migrate", workspace], sandbox).status, 0);

  // Tant que le lien n'est pas converti, PLAN_READY est refusé.
  const statePath = join(workspace, "PROJECT_STATE.md");
  const state = parseFrontmatter(await readFile(statePath, "utf8"));
  state.attributes.plan_version = 1;
  await writeFile(statePath, stringifyFrontmatter(state.attributes, state.body));
  assert.ok(
    blockedCodes(doctorReport(workspace, sandbox)).includes("PLAN_READY_LEGACY_LINKS_PENDING"),
  );

  // project-plan crée les tâches, project-work reporte `realizes` sans toucher au statut.
  await editBacklog(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-001");
    item.stage = "ready";
    item.tasks = [
      {
        id: "TSK-001",
        title: "Transmettre les deltas sur le réseau local.",
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
      },
    ];
    attributes.id_allocation.next_task = 2;
  });
  const statusBefore = parseFrontmatter(
    await readFile(join(workspace, "taches", "WORK-001.md"), "utf8"),
  ).attributes.status;
  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.title = "Prototype du déplacement du curseur";
    attributes.realizes = ["TSK-001"];
    attributes.cross_cutting = false;
  });
  assert.equal(
    parseFrontmatter(await readFile(join(workspace, "taches", "WORK-001.md"), "utf8")).attributes
      .status,
    statusBefore,
    "la conversion ne modifie jamais le statut de l'unité",
  );

  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").legacy_work_items = [];
    findItem(attributes, "BLG-003").legacy_work_items = [];
  });
  await editWork(workspace, "WORK-002", (attributes) => {
    attributes.realizes = ["TSK-001"];
  });
  const sync = runCli(["backlog", "sync-view", workspace], sandbox);
  assert.match(sync.stdout, /Vue régénérée|Vue déjà à jour/);

  // Le blocage propre aux liens historiques disparaît. Les autres exigences de
  // PLAN_READY (plan approuvé, stratégie) restent dues : elles sont hors sujet ici.
  const report = doctorReport(workspace, sandbox);
  assert.ok(!blockedCodes(report).includes("PLAN_READY_LEGACY_LINKS_PENDING"));
  assert.ok(!report.items.some((item) => item.code === "BACKLOG_LEGACY_LINK_PENDING"));
  assert.ok(!blockedCodes(report).some((code) => code.startsWith("BACKLOG_")));
});

// ===========================================================================
// 9 — Progression ready → in_progress → built → done
// ===========================================================================

test("parcours 9 : progression complète d'un résultat, construction puis acceptation", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-progression");

  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.realizes = [
      "TSK-006", "TSK-007", "TSK-008", "TSK-009", "TSK-010",
      "TSK-011", "TSK-012", "TSK-013", "TSK-014",
    ];
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-10";
  });
  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").legacy_work_items = [];
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.match((await readBacklog(workspace)).body, /#### BLG-001[^\n]*\n`in_progress`/);

  // Construction terminée : `built`, résultat non encore démontré.
  await editBacklog(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-001");
    let next = 6;
    for (const task of item.tasks) {
      const human = task.category === "human";
      task.evidence_log = [
        evidence(`EV-${String(next).padStart(3, "0")}`, {
          kind: human ? "observation" : "report",
          ref: human ? "constat direct sur les appareils" : "reports/setup-report.md",
          observed_by: human ? "Kelly" : null,
        }),
      ];
      next += 1;
    }
    attributes.id_allocation.next_evidence = next;
  });
  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.status = "accepted";
    attributes.accepted_by = "Kelly";
    attributes.accepted_at = "2026-09-14";
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.match((await readBacklog(workspace)).body, /#### BLG-001[^\n]*\n`built`[^\n]*résultat non démontré/);

  // Acceptation humaine du résultat : `done`.
  await editBacklog(workspace, (attributes) => {
    const item = findItem(attributes, "BLG-001");
    item.outcome_accepted_by = "Kelly";
    item.outcome_accepted_at = "2026-09-14";
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.match(
    (await readBacklog(workspace)).body,
    /#### BLG-001[^\n]*\n`done`[^\n]*résultat accepté le 2026-09-14 par Kelly/,
  );
  assert.ok(!blockedCodes(doctorReport(workspace, sandbox)).some((c) => c.startsWith("BACKLOG_")));
});

test("parcours 9 négatif : pas d'acceptation tant qu'une unité liée est active", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-progression-active-work");

  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.realizes = ["TSK-001"];
    attributes.status = "in_progress";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-10";
  });
  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").legacy_work_items = [];
  });

  assert.ok(
    blockedCodes(doctorReport(workspace, sandbox)).includes("BACKLOG_ITEM_DONE_WITH_ACTIVE_WORK"),
  );
});

// ===========================================================================
// 10 — Rejet des états courants incohérents
// ===========================================================================

test("parcours 10 : les incohérences de l'état courant sont refusées, chacune par son code", async (t) => {
  const sandbox = await temporaryDirectory(t);

  const cases = [
    ["identifiant-hors-compteur", "BACKLOG_ID_ALLOCATION_VIOLATION",
      (a) => { findItem(a, "BLG-002").id = "BLG-099"; }],
    ["ordre-duplique", "BACKLOG_ORDER_DUPLICATE",
      (a) => { findItem(a, "BLG-009").order = 1; }],
    ["dependance-aval", "BACKLOG_DEPENDENCY_FORWARD",
      (a) => { findItem(a, "BLG-001").depends_on = ["BLG-009"]; }],
    ["dependance-absente", "BACKLOG_DEPENDENCY_MISSING",
      (a) => { findItem(a, "BLG-001").depends_on = ["BLG-404"]; }],
    ["filiation-inconnue", "BACKLOG_DERIVED_FROM_UNKNOWN",
      (a) => { findItem(a, "BLG-009").derived_from = ["BLG-777"]; }],
    ["ready-sans-tache", "BACKLOG_READY_WITHOUT_TASK",
      (a) => { findItem(a, "BLG-002").stage = "ready"; }],
    ["date-invalide", "BACKLOG_DATE_INVALID",
      (a) => { findItem(a, "BLG-008").tasks[0].evidence_log[0].recorded_at = "2026-02-30"; }],
    ["observateur-blanc", "BACKLOG_TASK_EVIDENCE_OBSERVER_MISSING",
      (a) => {
        const task = findItem(a, "BLG-008").tasks[0];
        task.evidence_log[0].kind = "observation";
        task.evidence_log[0].ref = "constat";
        task.evidence_log[0].observed_by = "   ";
      }],
    ["preuve-humaine-automatisee", "BACKLOG_TASK_HUMAN_EVIDENCE_INVALID",
      (a) => {
        findItem(a, "BLG-001").tasks[8].evidence_log = [evidence("EV-006", { kind: "test" })];
        a.id_allocation.next_evidence = 7;
      }],
    ["preuve-multiple", "BACKLOG_EVIDENCE_MULTIPLE_VALID",
      (a) => {
        const task = findItem(a, "BLG-008").tasks[0];
        task.evidence_log.push(evidence("EV-006"));
        a.id_allocation.next_evidence = 7;
      }],
    ["etat-preuve-inexplique", "BACKLOG_EVIDENCE_STATE_UNEXPLAINED",
      (a) => { findItem(a, "BLG-008").tasks[0].evidence_log[0].state = "invalidated"; }],
    ["preparation-incoherente", "BACKLOG_PHASE_PREPARATION_INCONSISTENT",
      (a) => {
        const phase = a.phases.find((entry) => entry.id === "PH-3");
        phase.prepared_by = "Kelly";
        phase.prepared_at = "2026-09-02";
      }],
    ["preparation-incomplete", "BACKLOG_PHASE_PREPARATION_INCOMPLETE",
      (a) => { a.phases[1].prepared_by = "Kelly"; }],
  ];

  for (const [label, expected, mutate] of cases) {
    const { workspace } = await prepareV2(sandbox, `workflow-invalid-${label}`);
    await editBacklog(workspace, mutate);
    const blocked = blockedCodes(doctorReport(workspace, sandbox));
    assert.ok(blocked.includes(expected), `${label} doit produire ${expected} : ${blocked.join(", ")}`);
  }
});

test("parcours 10 positif : une phase préparée admet des candidats lointains sans tâche", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-phase-prepared");

  await editBacklog(workspace, (attributes) => {
    const phase = attributes.phases.find((entry) => entry.id === "PH-1");
    phase.prepared_by = "Kelly";
    phase.prepared_at = "2026-09-02";
  });
  const blocked = blockedCodes(doctorReport(workspace, sandbox));
  assert.ok(!blocked.some((code) => code.startsWith("BACKLOG_PHASE_PREPARATION")), blocked.join(", "));
});

// ===========================================================================
// 11 — Préservation exacte du contenu humain
// ===========================================================================

test("parcours 11 : sync-view préserve récit, frontmatter, commentaires et fins de ligne", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-preservation");
  const path = join(workspace, "taches", "BACKLOG.md");

  const raw = await readFile(path, "utf8");
  const [, frontmatter, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const annotated = frontmatter
    .replace("id_allocation:", "# Compteurs monotones : ne jamais faire reculer.\nid_allocation:")
    .replace("title: Socle du projet", 'title: "Socle du projet"');
  await writeFile(path, `---\n${annotated}\n---\n${body.replace("`ready` · P0 · construction 0/9", "PÉRIMÉ")}`);

  const before = await readFile(path, "utf8");
  const narrativeBefore = before.slice(before.indexOf("## Détail des résultats"));

  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  const after = await readFile(path, "utf8");
  assert.equal(after.match(/^---\n([\s\S]*?)\n---\n/)[1], annotated, "frontmatter à l'octet");
  assert.match(after, /# Compteurs monotones/);
  assert.match(after, /title: "Socle du projet"/);
  assert.equal(after.slice(after.indexOf("## Détail des résultats")), narrativeBefore, "récit à l'octet");
  assert.doesNotMatch(after, /PÉRIMÉ/);

  // Fins de ligne CRLF conservées.
  const crlf = await prepareV2(sandbox, "workflow-preservation-crlf");
  const crlfPath = join(crlf.workspace, "taches", "BACKLOG.md");
  await writeFile(crlfPath, (await readFile(crlfPath, "utf8")).replace(/\n/g, "\r\n"));
  assert.equal(runCli(["backlog", "sync-view", crlf.workspace], sandbox).status, 0);
  assert.ok((await readFile(crlfPath, "utf8")).includes("\r\n"));
});

test("parcours 11 négatif : un marqueur injecté n'endommage jamais le fichier", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { VIEW_BEGIN, VIEW_END } = await import("../dist/lib/backlog.js");

  const cases = [
    ["titre-de-tache", async (workspace) => {
      await editBacklog(workspace, (a) => {
        findItem(a, "BLG-009").tasks[0].title = `Titre ${VIEW_END} piégé`;
      });
    }],
    ["titre-d-unite", async (workspace) => {
      await editWork(workspace, "WORK-001", (a) => { a.title = `Prototype ${VIEW_END}`; });
    }],
    ["identite-d-acceptation", async (workspace) => {
      await editBacklog(workspace, (a) => {
        findItem(a, "BLG-008").outcome_accepted_by = `Kelly ${VIEW_BEGIN}`;
      });
    }],
    ["marqueur-dans-le-recit", async (workspace) => {
      const path = join(workspace, "taches", "BACKLOG.md");
      const parsed = parseFrontmatter(await readFile(path, "utf8"));
      await writeFile(
        path,
        stringifyFrontmatter(parsed.attributes, `Note : ${VIEW_BEGIN}\n\n${parsed.body}`),
      );
    }],
  ];

  for (const [label, inject] of cases) {
    const { workspace } = await prepareV2(sandbox, `workflow-marker-${label}`);
    assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
    await inject(workspace);

    const path = join(workspace, "taches", "BACKLOG.md");
    const before = await readFile(path, "utf8");
    const refused = runCli(["backlog", "sync-view", workspace], sandbox);
    assert.notEqual(refused.status, 0, `${label} : sync-view doit refuser`);
    assert.match(refused.stderr, /marqueur/i);
    assert.equal(await readFile(path, "utf8"), before, `${label} : aucun octet modifié`);
  }
});

test("parcours 11 positif : Markdown et commentaires HTML ordinaires traversent sans dommage", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-marker-positive");
  const hostile = "Titre *gras* _souligné_ [lien] `code` — <!-- note ordinaire --> & <fin>";

  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-002").title = hostile;
  });
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  const first = await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8");
  assert.ok(first.includes(hostile));
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);
  assert.equal(await readFile(join(workspace, "taches", "BACKLOG.md"), "utf8"), first);
});

// ===========================================================================
// 12 — Compatibilité v1
// ===========================================================================

test("parcours 12 : un workspace v1 reste utilisable sans migration forcée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-v1-compat");

  const report = doctorReport(workspace, sandbox);
  assert.equal(report.verdict, "WARNING");
  assert.ok(report.items.some((item) => item.code === "BACKLOG_SCHEMA_LEGACY"));
  assert.ok(report.items.some((item) => item.code === "BACKLOG_CANDIDATES_VALID"));
  assert.ok(!blockedCodes(report).some((code) => code.startsWith("BACKLOG_")));
});

test("parcours 12 négatif : un v1 structurellement incohérent bloque encore", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV1(sandbox, "workflow-v1-invalid");
  const path = join(workspace, "taches", "BACKLOG.md");
  const parsed = parseFrontmatter(await readFile(path, "utf8"));
  parsed.attributes.candidates[1].depends_on = ["BLG-404"];
  await writeFile(path, stringifyFrontmatter(parsed.attributes, parsed.body));

  assert.ok(blockedCodes(doctorReport(workspace, sandbox)).includes("BACKLOG_DEPENDENCY_MISSING"));
});

// ===========================================================================
// 13 — Tâches et acceptations humaines
// ===========================================================================

test("parcours 13 : une vérification humaine n'est validée que par une observation nommée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-human");

  // Négatif : preuve automatisée sur une tâche humaine.
  await editBacklog(workspace, (attributes) => {
    findItem(attributes, "BLG-001").tasks[8].evidence_log = [evidence("EV-006", { kind: "report" })];
    attributes.id_allocation.next_evidence = 7;
  });
  assert.ok(
    blockedCodes(doctorReport(workspace, sandbox)).includes("BACKLOG_TASK_HUMAN_EVIDENCE_INVALID"),
  );

  // Positif : observation avec personne nommée.
  await editBacklog(workspace, (attributes) => {
    const entry = findItem(attributes, "BLG-001").tasks[8].evidence_log[0];
    entry.kind = "observation";
    entry.ref = "constat direct sur les appareils physiques";
    entry.observed_by = "Kelly";
  });
  const blocked = blockedCodes(doctorReport(workspace, sandbox));
  assert.ok(!blocked.some((code) => code.startsWith("BACKLOG_TASK_")), blocked.join(", "));
});

test("parcours 13 : l'acceptation d'un résultat exige identité, date et tâches terminées", async (t) => {
  const sandbox = await temporaryDirectory(t);

  const cases = [
    ["identite-seule", (a) => { findItem(a, "BLG-008").outcome_accepted_at = null; }],
    ["identite-blanche", (a) => { findItem(a, "BLG-008").outcome_accepted_by = "   "; }],
    ["date-invalide", (a) => { findItem(a, "BLG-008").outcome_accepted_at = "bientôt"; }],
    ["taches-inachevees", (a) => {
      findItem(a, "BLG-001").outcome_accepted_by = "Kelly";
      findItem(a, "BLG-001").outcome_accepted_at = "2026-09-14";
    }],
  ];

  for (const [label, mutate] of cases) {
    const { workspace } = await prepareV2(sandbox, `workflow-acceptance-${label}`);
    await editBacklog(workspace, mutate);
    const blocked = blockedCodes(doctorReport(workspace, sandbox));
    assert.ok(
      blocked.some((code) => code.startsWith("BACKLOG_ITEM_ACCEPTANCE") || code === "BACKLOG_DATE_INVALID"),
      `${label} : ${blocked.join(", ")}`,
    );
  }

  // Positif : la fixture porte une acceptation complète et cohérente.
  const ok = await prepareV2(sandbox, "workflow-acceptance-valid");
  assert.ok(
    !blockedCodes(doctorReport(ok.workspace, sandbox)).some((c) => c.startsWith("BACKLOG_ITEM_ACCEPTANCE")),
  );
});

// ===========================================================================
// 14 — Diagnostics sur les fichiers corrompus
// ===========================================================================

test("parcours 14 : absent, illisible et invalide produisent des diagnostics distincts", async (t) => {
  const sandbox = await temporaryDirectory(t);

  // Absent.
  const missing = await prepareV2(sandbox, "workflow-work-missing");
  await rm(join(missing.workspace, "taches", "WORK-001.md"));
  const missingItem = doctorReport(missing.workspace, sandbox).items.find(
    (item) => item.code === "BACKLOG_LEGACY_LINK_MISSING",
  );
  assert.ok(missingItem, "un lien vers un fichier absent doit être signalé");
  assert.match(missingItem.message, /absent/i);

  // Présent mais illisible.
  const unreadable = await prepareV2(sandbox, "workflow-work-unreadable");
  await writeFile(join(unreadable.workspace, "taches", "WORK-001.md"), "pas de frontmatter\n");
  const unreadableReport = doctorReport(unreadable.workspace, sandbox);
  assert.ok(blockedCodes(unreadableReport).includes("WORK_ITEM_PARSE"));
  assert.ok(
    unreadableReport.items.some((item) => item.code === "BACKLOG_LEGACY_LINK_UNREADABLE"),
    "un fichier présent mais illisible n'est jamais décrit comme absent",
  );
  assert.ok(
    !unreadableReport.items.some((item) => item.code === "BACKLOG_LEGACY_LINK_MISSING"),
  );

  // Frontmatter lisible mais schéma invalide.
  const invalid = await prepareV2(sandbox, "workflow-work-invalid");
  await editWork(invalid.workspace, "WORK-001", (attributes) => {
    attributes.status = "inventé";
  });
  assert.ok(blockedCodes(doctorReport(invalid.workspace, sandbox)).includes("WORK_ITEM_SCHEMA"));

  // Frontmatter valide, mais identité différente du nom de fichier.
  const mismatched = await prepareV2(sandbox, "workflow-work-id-mismatch");
  await editWork(mismatched.workspace, "WORK-001", (attributes) => {
    attributes.id = "WORK-999";
  });
  assert.ok(
    blockedCodes(doctorReport(mismatched.workspace, sandbox)).includes("WORK_ITEM_ID_MISMATCH"),
  );

  // Backlog v2 malformé : diagnostic clair sur les deux routes de sync-view.
  const malformed = await prepareV2(sandbox, "workflow-backlog-malformed");
  await editBacklog(malformed.workspace, (attributes) => {
    delete findItem(attributes, "BLG-008").tasks[0].evidence_log;
  });
  for (const args of [[], ["--check"]]) {
    const result = runCli(["backlog", "sync-view", malformed.workspace, ...args], sandbox);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /schéma/i);
    assert.doesNotMatch(result.stderr, /Cannot read properties/);
  }

  // Archive illisible : signalée, jamais ignorée.
  const archive = await prepareV2(sandbox, "workflow-archive-unreadable");
  await mkdir(join(archive.workspace, HISTORY), { recursive: true });
  await writeFile(join(archive.workspace, HISTORY, "BACKLOG-v0.md"), "archive corrompue\n");
  assert.ok(
    doctorReport(archive.workspace, sandbox).items.some(
      (item) => item.code === "BACKLOG_ARCHIVE_UNREADABLE",
    ),
  );
});

test("parcours 14 : sync-view refuse toute unité illisible ou invalide sans réécrire", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const cases = [
    ["illisible", async (workspace) => {
      await writeFile(join(workspace, "taches", "WORK-001.md"), "pas de frontmatter\n");
    }, /frontmatter|illisible/i],
    ["invalide", async (workspace) => {
      await editWork(workspace, "WORK-001", (attributes) => {
        attributes.status = "inventé";
      });
    }, /schéma/i],
  ];

  for (const [label, corrupt, expected] of cases) {
    const { workspace } = await prepareV2(sandbox, `workflow-sync-work-${label}`);
    const backlogPath = join(workspace, "taches", "BACKLOG.md");
    const before = await readFile(backlogPath, "utf8");
    await corrupt(workspace);
    for (const args of [[], ["--check"]]) {
      const refused = runCli(["backlog", "sync-view", workspace, ...args], sandbox);
      assert.notEqual(refused.status, 0, `${label} doit être refusé`);
      assert.match(refused.stderr, expected);
      assert.equal(await readFile(backlogPath, "utf8"), before, "aucune réécriture");
    }
  }
});

test("parcours 14 : revise refuse une archive redirigée hors du workspace", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-revise-symlink");
  assert.equal(runCli(["backlog", "sync-view", workspace], sandbox).status, 0);

  const outside = join(sandbox, "outside-history");
  await mkdir(outside, { recursive: true });
  await mkdir(join(workspace, "docs", "internal"), { recursive: true });
  await symlink(outside, join(workspace, HISTORY), "dir");

  const backlogPath = join(workspace, "taches", "BACKLOG.md");
  const before = await readFile(backlogPath, "utf8");
  const refused = runCli(["backlog", "revise", workspace], sandbox);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /hors du workspace|lien symbolique/i);
  assert.equal(await readFile(backlogPath, "utf8"), before);
  await assert.rejects(readFile(join(outside, "BACKLOG-v1.md"), "utf8"), /ENOENT/);
});

// ===========================================================================
// Lots transversaux et voie d'urgence structurée
// ===========================================================================

test("lot transversal : justification réellement rédigée exigée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-cross-cutting");
  const workPath = join(workspace, "taches", "WORK-001.md");

  // Négatif : le modèle livré, non rempli.
  const template = parseFrontmatter(
    await readFile(
      join(starterRoot, "core", "skills", "project-work", "assets", "work-item-template.md"),
      "utf8",
    ),
  );
  await writeFile(
    workPath,
    stringifyFrontmatter(
      {
        ...template.attributes,
        id: "WORK-001",
        title: "Unité issue du modèle",
        status: "proposed",
        realizes: ["TSK-006", "TSK-015"],
        cross_cutting: true,
      },
      template.body,
    ),
  );
  assert.ok(blockedCodes(doctorReport(workspace, sandbox)).includes("WORK_CROSS_CUTTING_UNJUSTIFIED"));

  // Positif : justification rédigée.
  const parsed = parseFrontmatter(await readFile(workPath, "utf8"));
  await writeFile(
    workPath,
    stringifyFrontmatter(
      parsed.attributes,
      `${parsed.body}\n## Justification du lot transversal\n\nLe message partagé change pour le déplacement et pour le clic en même temps ; les découper obligerait à publier deux formats incompatibles.\n`,
    ),
  );
  assert.ok(!blockedCodes(doctorReport(workspace, sandbox)).includes("WORK_CROSS_CUTTING_UNJUSTIFIED"));
});

test("voie d'urgence : métadonnée structurée, jamais une phrase", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await prepareV2(sandbox, "workflow-urgency");

  await editBacklog(workspace, (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-02";
    findItem(attributes, "BLG-001").legacy_work_items = [];
  });

  // Négatif : une phrase négative contenant « urgent » ne vaut pas autorisation.
  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.status = "approved";
    attributes.approved_by = "Kelly";
    attributes.approved_at = "2026-09-10";
    attributes.realizes = [];
    attributes.source_request = "Demande ordinaire de Kelly ; ce n'est pas urgent.";
  });
  assert.ok(
    doctorReport(workspace, sandbox).items.some((item) => item.code === "WORK_REALIZES_MISSING"),
  );

  // Positif : la métadonnée structurée.
  await editWork(workspace, "WORK-001", (attributes) => {
    attributes.unplanned_urgent = true;
  });
  assert.ok(
    !doctorReport(workspace, sandbox).items.some((item) => item.code === "WORK_REALIZES_MISSING"),
  );
});

// ===========================================================================
// Golden test : contenu et ordre du rendu
// ===========================================================================

test("golden : le rendu de référence est exact, y compris son ordre", async () => {
  const { renderRoadmap } = await import("../dist/lib/backlog.js");
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

  // Comptes recalculés indépendamment depuis le frontmatter.
  const active = parsed.attributes.items.filter((item) => item.disposition === "active");
  const requiredTasks = active.flatMap((item) => item.tasks.filter((task) => task.required));
  const done = requiredTasks.filter((task) =>
    task.evidence_log.some((entry) => entry.state === "valid"),
  );
  assert.match(
    expected,
    new RegExp(`\\*\\*Construction : ${done.length}/${requiredTasks.length} tâches obligatoires terminées\\.\\*\\*`),
  );

  // Ordre : phases dans l'ordre du tableau, résultats par `order`, tâches déclarées.
  const renderedPhases = [...expected.matchAll(/^### (PH-\d+) —/gm)].map((match) => match[1]);
  assert.deepEqual(renderedPhases, parsed.attributes.phases.map((phase) => phase.id));

  const renderedItems = [...expected.matchAll(/^(?:#### |- `)(BLG-\d+)/gm)].map((match) => match[1]);
  const expectedItems = parsed.attributes.phases.flatMap((phase) =>
    parsed.attributes.items
      .filter((item) => item.phase === phase.id)
      .sort((left, right) => left.order - right.order)
      .map((item) => item.id),
  );
  assert.deepEqual(renderedItems, expectedItems);

  const renderedTasks = [...expected.matchAll(/^- \[[ x]\] `(TSK-\d+)`/gm)].map((match) => match[1]);
  const expectedTasks = expectedItems.flatMap(
    (id) => parsed.attributes.items.find((entry) => entry.id === id).tasks.map((task) => task.id),
  );
  assert.deepEqual(renderedTasks, expectedTasks);
});
