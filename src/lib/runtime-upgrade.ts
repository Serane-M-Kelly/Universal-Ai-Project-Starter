/**
 * In-place upgrade of a workspace's embedded runtime (.starter/runtime), run from the new distribution.
 *
 * Guarantees: only the files listed by the preview are written (runtime, contract copy, upgraded
 * skills and their native copies, project.yaml); every other workspace file, including
 * `.starter/workflow.json` and `.starter/history`, is fingerprinted in the plan and re-verified. The
 * plan hash given by the preview must match at application time. New content is prepared and verified
 * inside the migration directory, then moved into place by renames: a target never holds a partial
 * copy. Backups are verified when taken and again before any restoration. While a migration or a
 * rollback is in progress a marker makes the new runtime refuse ordinary commands, so an interrupted
 * migration is never usable as a successful one. Behaviour (status and every phase context) must be
 * identical before and after, or the migration is undone. Rollback is refused as soon as the
 * workspace changed after the migration, unless the current state is readable by the previous
 * runtime's schema and the change is explicitly accepted.
 */
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, readFile, readdir, readlink, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import YAML from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { canonicalPath, pathExists, writeFileAtomic } from "./fs-safe.js";
import { declaration, ensure } from "./phase-workflow.js";
import { packageRoot } from "./paths.js";
import { isPathInsideOrEqual } from "./text.js";
import { loadSkill } from "./skills.js";
import { NATIVE_ADAPTERS, installedNativeAdapters } from "./native-adapters.js";
import { hashDirectory } from "./content-hash.js";

export const RUNTIME_FILES = ["dist", "core", "profiles", "adapters", "node_modules", "package.json"];
export const RUN_MJS = "import './runtime/dist/index.js';\n";
export const MARKER = ".starter/MIGRATION-IN-PROGRESS.json";
export const MIGRATIONS = ".starter/migrations";
/**
 * Read-only verification reads during a migration carry the marker's random nonce in this variable.
 * It is a guard against accidental use, not an access control: anyone able to read the marker can set it.
 */
export const VERIFY_ENV = "STARTER_RUNTIME_UPGRADE_VERIFY";
/** Test hooks: simulate a crash (exit without cleanup) or a failure (exception) right after the named step. */
const INTERRUPT_ENV = "STARTER_TEST_INTERRUPT_RUNTIME_UPGRADE";
const FAIL_ENV = "STARTER_TEST_FAIL_RUNTIME_UPGRADE";
export const SUPPORTED_SOURCES = ["0.24.0", "0.25.0"];
const LOCK = ".starter/write.lock";
const NOT_FINGERPRINTED = [".starter/runtime", MIGRATIONS, LOCK, MARKER];

const sha = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");
type Operation = { path: string; kind: "file" | "directory"; action: "replace" | "unchanged"; before: string | null; after: string | null; source?: string };
type Rollback = { by: string; request: string; at: string; reason: string; state_changes_accepted?: boolean };
type Journal = {
  format: 2; id: string; status: "preparing" | "applying" | "applied" | "rolled-back" | "abandoned"; step: string;
  plan: Plan; plan_hash: string; by: string; request: string; started_at: string; finished_at?: string;
  behavior_before?: Behavior; doctor_before?: string[]; doctor_after?: string[];
  error?: string; rollback?: Rollback;
};
type Behavior = { status: unknown; contexts: unknown[] };
export type Plan = {
  format: 2; workspace: string; from: string | null; to: string; up_to_date: boolean;
  runtime: { before: string | null; after: string };
  operations: Operation[]; untouched: Record<string, string>;
  behavior: string | null; incompatibilities: string[]; personalizations: string[];
};

/** Tree hash tolerant of symbolic links (node_modules/.bin), compared by their target text. */
export async function treeHash(path: string): Promise<string | null> {
  if (!(await pathExists(path))) return null;
  const hash = createHash("sha256");
  async function visit(current: string): Promise<void> {
    const details = await lstat(current), rel = relative(path, current).split("\\").join("/");
    if (details.isSymbolicLink()) hash.update(`link\0${rel}\0${await readlink(current)}\0`);
    else if (details.isDirectory()) {
      hash.update(`dir\0${rel}\0`);
      for (const name of (await readdir(current)).sort()) if (name !== ".DS_Store") await visit(join(current, name));
    } else if (details.isFile()) hash.update(`file\0${rel}\0`).update(await readFile(current)).update("\0");
  }
  await visit(path);
  return hash.digest("hex");
}

async function runtimeHashFrom(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const name of RUNTIME_FILES) hash.update(`${name}\0${(await treeHash(join(root, name))) ?? "absent"}\0`);
  return hash.digest("hex");
}

async function fileHash(path: string): Promise<string | null> {
  try { return sha(await readFile(path)); } catch { return null; }
}

/** Content hash of an operation target; null when absent, "symlink" when it is a link. */
async function contentHash(path: string, kind: Operation["kind"]): Promise<string | null> {
  try { if ((await lstat(path)).isSymbolicLink()) return "symlink"; } catch { return null; }
  if (kind === "file") return fileHash(path);
  try { return await hashDirectory(path); } catch { return "unreadable"; }
}

async function version(path: string): Promise<string | null> {
  try { return JSON.parse(await readFile(path, "utf8")).version ?? null; } catch { return null; }
}

/** Every workspace file outside the runtime, the migration records and the replaced paths. */
async function fingerprint(w: string, replaced: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const skip = [...NOT_FINGERPRINTED, ...replaced];
  async function visit(dir: string): Promise<void> {
    for (const name of (await readdir(dir)).sort()) {
      if (name === ".DS_Store") continue;
      const path = join(dir, name), rel = relative(w, path).split("\\").join("/");
      if (skip.some(s => rel === s || rel.startsWith(s + "/"))) continue;
      const details = await lstat(path);
      if (details.isSymbolicLink()) out[rel] = `link:${await readlink(path)}`;
      else if (details.isDirectory()) await visit(path);
      else if (details.isFile()) out[rel] = sha(await readFile(path));
      else out[rel] = "special";
    }
  }
  await visit(w);
  return out;
}

/** First symbolic link on the way from the workspace to `rel`, if any. */
async function symlinkOnPath(w: string, rel: string): Promise<string | null> {
  let current = w;
  for (const part of rel.split("/")) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) return relative(w, current); } catch { return null; }
  }
  return null;
}

/** Status and every phase context, read by the runtime currently installed in the workspace. */
function behavior(w: string, nonce?: string): Behavior {
  const env = { ...process.env, [VERIFY_ENV]: nonce ?? "" };
  const read = (args: string[]) => {
    const run = spawnSync(process.execPath, [join(w, ".starter/run.mjs"), "workflow", ...args, "--workspace", w], { encoding: "utf8", env });
    ensure(run.status === 0, `Lecture du suivi impossible avec le runtime installé (${args.join(" ")}) : ${run.stderr.trim()}`);
    return JSON.parse(run.stdout);
  };
  const status = read(["status"]) as { phases: unknown[] };
  return { status, contexts: status.phases.map((_, index) => read(["context", String(index + 1)])) };
}

/** Doctor findings (warnings and blockers), without the lock held by the migration itself. */
function doctorFindings(w: string, nonce?: string): string[] {
  const env = { ...process.env, [VERIFY_ENV]: nonce ?? "" };
  const run = spawnSync(process.execPath, [join(w, ".starter/run.mjs"), "doctor", w, "--json"], { encoding: "utf8", env });
  let report: { items: { severity: string; code: string; message: string }[] };
  try { report = JSON.parse(run.stdout); } catch { return [`blocked:DOCTOR:sortie illisible (code ${run.status})`]; }
  return report.items.filter(i => i.severity !== "ok" && !(i.code === "PHASE_WORKFLOW" && /verrou résiduel/.test(i.message)))
    .map(i => `${i.severity}:${i.code}:${i.message}`).sort();
}

/** project.yaml edited through its document model, so comments and layout survive. */
async function upgradedConfig(w: string, to: string, skills: Map<string, { version: number; source_hash: string }>): Promise<string> {
  const doc = YAML.parseDocument(await readFile(join(w, "project.yaml"), "utf8"));
  ensure(!doc.errors.length, `project.yaml illisible : ${doc.errors[0]?.message}`);
  doc.setIn(["starter_version"], to);
  const list = doc.getIn(["skills"]) as YAML.YAMLSeq | undefined;
  (list?.items ?? []).forEach((item, index) => {
    const id = (item as YAML.YAMLMap).get("id") as string;
    const next = skills.get(id);
    if (!next) return;
    doc.setIn(["skills", index, "version"], next.version);
    doc.setIn(["skills", index, "source_hash"], next.source_hash);
  });
  return doc.toString();
}

export async function planUpgrade(workspace: string, options: { ownLock?: string } = {}): Promise<{ plan: Plan; plan_hash: string; behavior?: Behavior; config?: string }> {
  const w = await canonicalPath(workspace);
  const incompatibilities: string[] = [], personalizations: string[] = [];
  const to = (await version(join(packageRoot, "package.json")))!;
  const runtimeDir = join(w, ".starter/runtime");
  for (const required of ["project.yaml", ".starter/workflow.json", ".starter/run.mjs", ".starter/runtime/package.json"])
    if (!(await pathExists(join(w, required)))) incompatibilities.push(`Fichier requis absent : ${required} (workspace par phases v3 installé requis).`);
  if (await pathExists(join(w, MARKER))) incompatibilities.push(`Migration ou annulation interrompue (${MARKER}) : utiliser d'abord workflow runtime-rollback.`);
  const lockOwner = await readFile(join(w, LOCK, "owner.json"), "utf8").then(JSON.parse).catch(() => null);
  if (await pathExists(join(w, LOCK)) && !(options.ownLock && lockOwner?.runtime_upgrade === options.ownLock && lockOwner?.pid === process.pid))
    incompatibilities.push("Écriture en cours ou verrou résiduel (.starter/write.lock) : fermer les assistants ; après une migration interrompue, utiliser workflow runtime-rollback, sinon examiner puis workflow recover-lock.");
  if (isPathInsideOrEqual(packageRoot, w)) incompatibilities.push("Lancer depuis la nouvelle distribution (--workspace), pas depuis le runtime du workspace.");
  for (const rel of [".starter", ".starter/runtime", ".starter/WORKFLOW.md", "project.yaml", "skills"]) {
    const link = await symlinkOnPath(w, rel);
    if (link) incompatibilities.push(`Lien symbolique non pris en charge : ${link}.`);
  }
  const from = await version(join(runtimeDir, "package.json"));
  const upToDate = from === to;
  if (!upToDate && !SUPPORTED_SOURCES.includes(from ?? ""))
    incompatibilities.push(`Runtime ${from ?? "illisible"} : migration prise en charge depuis ${SUPPORTED_SOURCES.join(" ou ")} uniquement.`);
  if ((await readFile(join(w, ".starter/run.mjs"), "utf8").catch(() => null)) !== RUN_MJS)
    personalizations.push(".starter/run.mjs diffère du lanceur standard.");

  const operations: Operation[] = [];
  // Contract copy read by the agents: replaced only if it is still the previous runtime's version.
  const contractNow = await fileHash(join(w, ".starter/WORKFLOW.md"));
  const contractOld = await fileHash(join(runtimeDir, "core/contracts/phase-workflow.md"));
  const contractNew = (await fileHash(join(packageRoot, "core/contracts/phase-workflow.md")))!;
  if (contractNow !== contractOld) personalizations.push(".starter/WORKFLOW.md diffère du contrat du runtime installé : reporter la personnalisation avant la migration.");
  operations.push({ path: ".starter/WORKFLOW.md", kind: "file", action: contractNow === contractNew ? "unchanged" : "replace", before: contractNow, after: contractNew, source: "core/contracts/phase-workflow.md" });

  let config: any = null;
  try { config = YAML.parse(await readFile(join(w, "project.yaml"), "utf8")); } catch { incompatibilities.push("project.yaml illisible."); }
  let adapters: string[] = [];
  try { adapters = await installedNativeAdapters(w); } catch (error) { incompatibilities.push(`Assistants installés illisibles : ${error instanceof Error ? error.message : error}`); }
  const skills = new Map<string, { version: number; source_hash: string }>();
  for (const reference of config?.skills ?? []) {
    let loaded;
    try { loaded = await loadSkill(reference.id); } catch { incompatibilities.push(`Skill ${reference.id} absent de la distribution ${to}.`); continue; }
    if (reference.version > loaded.manifest.version) { incompatibilities.push(`Skill ${reference.id} v${reference.version} plus récent que la distribution.`); continue; }
    const after = await hashDirectory(loaded.sourcePath);
    skills.set(reference.id, { version: loaded.manifest.version, source_hash: after });
    const destinations = [`skills/${reference.id}`, ...adapters.map(id => `${NATIVE_ADAPTERS[id as keyof typeof NATIVE_ADAPTERS].skills}/${reference.id}`)];
    for (const destination of destinations) {
      const link = await symlinkOnPath(w, destination);
      if (link) { incompatibilities.push(`Lien symbolique non pris en charge : ${link} (copie de skill).`); continue; }
      const before = await contentHash(join(w, destination), "directory");
      if (before === null || before === "unreadable") { incompatibilities.push(`Copie de skill absente ou illisible : ${destination}.`); continue; }
      if (before !== reference.source_hash) personalizations.push(`${destination} diffère de la version installée de ${reference.id} (personnalisation ou copie divergente).`);
      operations.push({ path: destination, kind: "directory", action: before === after ? "unchanged" : "replace", before, after, source: `core/skills/${reference.id}` });
    }
  }
  const configBefore = await fileHash(join(w, "project.yaml"));
  let configText: string | undefined;
  try { configText = config ? await upgradedConfig(w, to, skills) : undefined; } catch (error) { incompatibilities.push((error as Error).message); }
  const configAfter = configText !== undefined ? sha(configText) : null;
  operations.push({ path: "project.yaml", kind: "file", action: configBefore === configAfter ? "unchanged" : "replace", before: configBefore, after: configAfter });

  const replaced = upToDate ? [] : operations.filter(o => o.action === "replace");
  let observed: Behavior | undefined;
  if (!incompatibilities.length) {
    try { observed = behavior(w); } catch (error) { incompatibilities.push(error instanceof Error ? error.message : String(error)); }
  }
  const plan: Plan = {
    format: 2, workspace: w, from, to, up_to_date: upToDate,
    runtime: { before: await runtimeHashFrom(runtimeDir), after: await runtimeHashFrom(packageRoot) },
    operations: upToDate ? [] : operations, untouched: await fingerprint(w, replaced.map(o => o.path)),
    behavior: observed ? sha(JSON.stringify(observed)) : null, incompatibilities, personalizations,
  };
  return { plan, plan_hash: sha(JSON.stringify(plan)), ...(observed ? { behavior: observed } : {}), ...(configText !== undefined ? { config: configText } : {}) };
}

export async function previewUpgrade(workspace: string) {
  const { plan, plan_hash } = await planUpgrade(workspace);
  const ready = !plan.up_to_date && !plan.incompatibilities.length && !plan.personalizations.length;
  const untouched = Object.keys(plan.untouched);
  return {
    dry_run: true, ready, plan_hash, from: plan.from, to: plan.to, up_to_date: plan.up_to_date,
    touched: [{ path: ".starter/runtime", action: "replace", note: "remplacé en entier ; l'ancien est conservé dans la sauvegarde" },
      ...plan.operations.filter(o => o.action === "replace").map(o => ({ path: o.path, action: o.action }))],
    unchanged: plan.operations.filter(o => o.action === "unchanged").map(o => o.path),
    never_written: { files: untouched.length, includes: [".starter/workflow.json", ".starter/history/", "reports/", "BACKLOG.md", ".starter/models.json"].filter(p => untouched.some(u => u === p || u.startsWith(p))),
      rule: "tous les autres fichiers du workspace sont relevés par empreinte et revérifiés" },
    added: [`${MIGRATIONS}/<identifiant>/ (journal et sauvegarde vérifiée, environ la taille du runtime)`],
    incompatibilities: plan.incompatibilities, personalizations: plan.personalizations,
    next: ready ? `Fermer les assistants, puis : workflow runtime-upgrade --workspace "${plan.workspace}" --plan ${plan_hash} --by PERSONNE --request MOTS_REELS` :
      plan.up_to_date ? "Runtime déjà à jour : rien à faire." : "Résoudre les points listés ; rien n'a été écrit.",
    limits: "Les fichiers sont comparés par empreinte ; un runtime embarqué retouché à la main est remplacé en entier (copie conservée). Le code applicatif, hors du workspace, n'est ni lu ni écrit.",
  };
}

const alive = (pid: unknown): boolean => {
  if (typeof pid !== "number") return true;
  try { process.kill(pid, 0); return true; } catch (e: any) { return e.code !== "ESRCH"; }
};

/**
 * Takes the workspace write lock. A lock left by a crashed run of the same migration (its process no
 * longer exists) is taken over atomically: it is renamed away, so two recoveries cannot both take it.
 */
async function takeLock(w: string, id: string, takeOverFrom?: string): Promise<void> {
  await mkdir(join(w, ".starter"), { recursive: true });
  if (takeOverFrom && await pathExists(join(w, LOCK))) {
    const owner = await readFile(join(w, LOCK, "owner.json"), "utf8").then(JSON.parse).catch(() => null);
    ensure(owner && owner.runtime_upgrade === takeOverFrom, "Verrou d'écriture détenu par une autre opération : examiner .starter/write.lock/owner.json.");
    ensure(!alive(owner.pid), "La migration ou l'annulation est encore en cours d'exécution : attendre sa fin.");
    const stale = join(w, `${LOCK}.stale-${randomUUID()}`);
    try { await rename(join(w, LOCK), stale); } catch { throw new Error("Verrou repris par une autre récupération : attendre sa fin."); }
    await rm(stale, { recursive: true, force: true });
  }
  try { await mkdir(join(w, LOCK)); } catch { throw new Error("Workspace occupé : examiner .starter/write.lock/owner.json."); }
  await writeFileAtomic(join(w, LOCK, "owner.json"), JSON.stringify({ pid: process.pid, at: new Date().toISOString(), runtime_upgrade: id }));
}

async function releaseLock(w: string): Promise<void> {
  await rm(join(w, LOCK), { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
}

function interruptAfter(step: string): void {
  if (process.env[INTERRUPT_ENV] === step) process.exit(70);
  if (process.env[FAIL_ENV] === step) throw new Error(`échec simulé après l'étape ${step}`);
}

async function saveJournal(w: string, journal: Journal): Promise<void> {
  await writeFileAtomic(join(w, MIGRATIONS, journal.id, "journal.json"), JSON.stringify(journal, null, 2) + "\n");
}

/** Copy verified by hash, into a location that does not exist yet (inside the migration directory). */
async function copyInto(source: string, target: string, kind: Operation["kind"], expected: string | null): Promise<void> {
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, verbatimSymlinks: true });
  ensure((await contentHash(target, kind)) === expected, `Copie non conforme : ${target}.`);
}

/**
 * Puts verified content at `rel` without ever leaving a partial copy there: the content is prepared
 * and verified in the migration directory, the current target is moved aside, then the prepared
 * content is renamed into place. A crash leaves the target either intact, absent, or complete.
 */
async function place(w: string, dir: string, source: string, rel: string, kind: Operation["kind"], expected: string | null): Promise<void> {
  const prepared = join(dir, "work/new", rel), aside = join(dir, "work/old", rel);
  await copyInto(source, prepared, kind, expected);
  await rm(aside, { recursive: true, force: true });
  await mkdir(dirname(aside), { recursive: true });
  if (await pathExists(join(w, rel))) await rename(join(w, rel), aside);
  interruptAfter("target-removed");
  await mkdir(dirname(join(w, rel)), { recursive: true });
  await rename(prepared, join(w, rel));
  await rm(aside, { recursive: true, force: true });
}

export async function applyUpgrade(workspace: string, planHash: string, by: string, request: string) {
  declaration(by, request);
  ensure(/^[a-f0-9]{64}$/.test(planHash ?? ""), "--plan EMPREINTE requis : lancer d'abord --dry-run et examiner l'aperçu.");
  const w = await canonicalPath(workspace);
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  await takeLock(w, id);
  let journal: Journal | null = null;
  try {
    interruptAfter("locked");
    const { plan, plan_hash, behavior: before, config } = await planUpgrade(w, { ownLock: id });
    ensure(!plan.up_to_date, "Runtime déjà à jour : rien à faire.");
    ensure(!plan.incompatibilities.length && !plan.personalizations.length, `Migration impossible ; rien n'a été écrit :\n- ${[...plan.incompatibilities, ...plan.personalizations].join("\n- ")}`);
    ensure(plan_hash === planHash, "Le workspace ou la distribution a changé depuis l'aperçu : relancer --dry-run et examiner le nouvel aperçu. Rien n'a été écrit.");
    const dir = join(w, MIGRATIONS, id), replaced = plan.operations.filter(o => o.action === "replace");
    journal = { format: 2, id, status: "preparing", step: "started", plan, plan_hash, by, request, started_at: new Date().toISOString(), behavior_before: before!, doctor_before: doctorFindings(w) };
    await saveJournal(w, journal);
    // 1. Stage the new runtime and the new project.yaml, back up every file that will change; all verified.
    for (const name of RUNTIME_FILES)
      if (await pathExists(join(packageRoot, name))) await cp(join(packageRoot, name), join(dir, "runtime.next", name), { recursive: true, verbatimSymlinks: true });
    ensure((await runtimeHashFrom(join(dir, "runtime.next"))) === plan.runtime.after, "Copie du nouveau runtime non conforme.");
    await writeFileAtomic(join(dir, "project.yaml.next"), config!);
    for (const op of replaced) { await copyInto(join(w, op.path), join(dir, "backup", op.path), op.kind, op.before); interruptAfter("backup-started"); }
    await mkdir(join(dir, "backup/.starter"), { recursive: true });
    journal.step = "staged"; await saveJournal(w, journal); interruptAfter("staged");
    // 2. From here the new runtime refuses ordinary commands until the migration completes or is undone.
    const nonce = randomUUID();
    await writeFileAtomic(join(w, MARKER), JSON.stringify({ id, operation: "runtime-upgrade", from: plan.from, to: plan.to, at: new Date().toISOString(), verify: nonce,
      recovery: `node "${join(packageRoot, "dist/index.js")}" workflow runtime-rollback --workspace "${w}" --by PERSONNE --request MOTS_REELS` }, null, 2));
    journal.status = "applying"; journal.step = "marked"; await saveJournal(w, journal); interruptAfter("marked");
    await rename(join(w, ".starter/runtime"), join(dir, "backup/.starter/runtime"));
    ensure((await runtimeHashFrom(join(dir, "backup/.starter/runtime"))) === plan.runtime.before, "Sauvegarde de l'ancien runtime non conforme.");
    journal.step = "old-runtime-saved"; await saveJournal(w, journal); interruptAfter("old-runtime-saved");
    await rename(join(dir, "runtime.next"), join(w, ".starter/runtime"));
    journal.step = "runtime-installed"; await saveJournal(w, journal); interruptAfter("runtime-installed");
    // 3. Contract copy, skills and project.yaml, each placed whole.
    for (const op of replaced) {
      journal.step = `writing:${op.path}`; await saveJournal(w, journal);
      const source = op.path === "project.yaml" ? join(dir, "project.yaml.next") : join(packageRoot, op.source!);
      await place(w, dir, source, op.path, op.kind, op.after);
    }
    journal.step = "files-updated"; await saveJournal(w, journal); interruptAfter("files-updated");
    // 4. Nothing else changed, same behaviour, no new diagnostic blocker; otherwise undo.
    const untouched = await fingerprint(w, replaced.map(o => o.path));
    const drift = [...new Set([...Object.keys(untouched), ...Object.keys(plan.untouched)])].filter(p => untouched[p] !== plan.untouched[p]);
    ensure(!drift.length, `Fichiers modifiés pendant la migration : ${drift.slice(0, 10).join(", ")}.`);
    const after = behavior(w, nonce);
    ensure(JSON.stringify(after) === JSON.stringify(before), "Comportement différent après migration (statuts ou contextes de phase) : migration annulée.");
    const doctorAfter = doctorFindings(w, nonce);
    journal.doctor_after = doctorAfter;
    const added = doctorAfter.filter(f => f.startsWith("blocked:") && !journal!.doctor_before!.includes(f));
    ensure(!added.length, `Nouveaux blocages du diagnostic après migration : ${added.join(" ; ")}. Migration annulée.`);
    journal.status = "applied"; journal.step = "verified"; journal.finished_at = new Date().toISOString();
    await saveJournal(w, journal); interruptAfter("applied-recorded");
    await finishCleanup(w, journal);
    return {
      upgraded: true, id, from: plan.from, to: plan.to, journal: `${MIGRATIONS}/${id}/journal.json`,
      behavior: "statut et contextes de toutes les phases identiques", untouched_files_verified: Object.keys(untouched).length,
      doctor: { before: journal.doctor_before, after: doctorAfter, rule: "aucun nouveau blocage ; le verrou de la migration est exclu de la comparaison" },
      rollback: `workflow runtime-rollback --workspace "${w}" --dry-run`,
      not_done: "Les observations enregistrées par un runtime 0.24 n'ont pas d'inventaire : workflow carry ne les conservera pas (celles d'un runtime 0.25.0 en ont un). Relancer les assistants et project-start.",
    };
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    // Applied and verified: backup and journal are kept; only the final cleanup is pending.
    if (journal && journal.status === "applied")
      throw new Error(`Migration appliquée et vérifiée, mais nettoyage final incomplet (${cause}). Sauvegarde et journal conservés. Terminer : workflow runtime-upgrade --workspace "${w}" --finish --by PERSONNE --request MOTS_REELS ; ou annuler : workflow runtime-rollback --workspace "${w}".`);
    if (journal && journal.status === "applying") {
      try {
        await restore(w, journal, { by: "runtime-upgrade", request: "Annulation automatique après échec", at: new Date().toISOString(), reason: cause });
      } catch (restoreError) {
        throw new Error(`Migration interrompue (${cause}) et restauration automatique impossible (${(restoreError as Error).message}). Le marqueur ${MARKER} reste en place : utiliser workflow runtime-rollback.`);
      }
      throw new Error(`Migration annulée et workspace restauré : ${cause}`);
    }
    if (journal?.status === "preparing") await abandon(w, journal, cause).catch(() => {});
    throw error;
  } finally {
    await releaseLock(w);
  }
}

/** Final cleanup of an applied, verified migration; safe to repeat. */
async function finishCleanup(w: string, journal: Journal): Promise<void> {
  await rm(join(w, MIGRATIONS, journal.id, "work"), { recursive: true, force: true });
  await rm(join(w, MIGRATIONS, journal.id, "project.yaml.next"), { force: true });
  await rm(join(w, MARKER), { force: true });
}

/** Completes a migration whose verification succeeded but whose final cleanup did not. */
export async function finishUpgrade(workspace: string, by: string, request: string) {
  declaration(by, request);
  const w = await canonicalPath(workspace);
  const { journal, marker } = await latestJournal(w);
  ensure(journal && journal.status === "applied", "Aucune migration appliquée à terminer.");
  ensure(!marker || (marker.id === journal.id && marker.operation === "runtime-upgrade"), "Le marqueur présent ne correspond pas à cette migration : utiliser runtime-rollback.");
  const lockOwner = await readFile(join(w, LOCK, "owner.json"), "utf8").then(JSON.parse).catch(() => null);
  await takeLock(w, journal.id, lockOwner?.runtime_upgrade === journal.id ? journal.id : undefined);
  try {
    ensure((await runtimeHashFrom(join(w, ".starter/runtime"))) === journal.plan.runtime.after, "Le runtime installé n'est pas celui de la migration : utiliser runtime-rollback.");
    for (const op of journal.plan.operations.filter(o => o.action === "replace"))
      ensure((await contentHash(join(w, op.path), op.kind)) === op.after, `${op.path} ne correspond pas à la migration : utiliser runtime-rollback.`);
    await finishCleanup(w, journal);
  } finally { await releaseLock(w); }
  return { finished: true, migration: journal.id, to: journal.plan.to, rollback: `workflow runtime-rollback --workspace "${w}" --dry-run` };
}

/** Before the marker nothing in the workspace changed: only the migration's own files are discarded. */
async function abandon(w: string, journal: Journal, reason: string): Promise<void> {
  const dir = join(w, MIGRATIONS, journal.id);
  // Only an operation that applied nothing may discard its backup.
  ensure(journal.status === "preparing", `Abandon refusé : la migration ${journal.id} est à l'état « ${journal.status} » ; sa sauvegarde est conservée.`);
  ensure((await runtimeHashFrom(join(w, ".starter/runtime"))) === journal.plan.runtime.before, "Abandon refusé : le runtime installé n'est plus celui d'avant la migration ; utiliser runtime-rollback.");
  for (const name of ["runtime.next", "backup", "work", "project.yaml.next"]) await rm(join(dir, name), { recursive: true, force: true });
  journal.status = "abandoned"; journal.error = reason; journal.finished_at = new Date().toISOString();
  await saveJournal(w, journal);
  const marker = await readFile(join(w, MARKER), "utf8").then(JSON.parse).catch(() => null);
  if (marker?.id === journal.id) await rm(join(w, MARKER), { force: true });
}

/**
 * Puts back the previous runtime and every backed-up file; never touches any other workspace file.
 * All needed backups are verified before the first write; files already in their original state are
 * left alone; each placement is journalled so an interrupted rollback can resume.
 */
async function restore(w: string, journal: Journal, rollback: Rollback): Promise<void> {
  const dir = join(w, MIGRATIONS, journal.id);
  const pending: Operation[] = [];
  for (const op of journal.plan.operations.filter(o => o.action === "replace")) {
    if ((await contentHash(join(w, op.path), op.kind)) === op.before) continue;
    ensure((await contentHash(join(dir, "backup", op.path), op.kind)) === op.before, `Sauvegarde invalide pour ${op.path} : aucune restauration effectuée.`);
    pending.push(op);
  }
  const saved = join(dir, "backup/.starter/runtime");
  const runtimeNow = await runtimeHashFrom(join(w, ".starter/runtime"));
  if (runtimeNow !== journal.plan.runtime.before)
    ensure((await runtimeHashFrom(saved)) === journal.plan.runtime.before, "Sauvegarde du runtime invalide : aucune restauration effectuée.");
  await writeFileAtomic(join(w, MARKER), JSON.stringify({ id: journal.id, operation: "runtime-rollback", at: rollback.at }, null, 2));
  // Files first, while the installed runtime (the new one, which honours the marker) refuses commands;
  // the previous runtime, which ignores the marker, comes back only once every file is restored.
  for (const op of pending) {
    journal.step = `restoring:${op.path}`; await saveJournal(w, journal);
    await place(w, dir, join(dir, "backup", op.path), op.path, op.kind, op.before);
    interruptAfter("rollback-file-restored");
  }
  for (const op of journal.plan.operations.filter(o => o.action === "replace"))
    ensure((await contentHash(join(w, op.path), op.kind)) === op.before, `Fichier non restauré : ${op.path}.`);
  interruptAfter("rollback-files-done");
  if (runtimeNow !== journal.plan.runtime.before) {
    journal.step = "restoring:.starter/runtime"; await saveJournal(w, journal);
    if (await pathExists(join(w, ".starter/runtime"))) {
      await rm(join(dir, "replaced-runtime"), { recursive: true, force: true });
      await rename(join(w, ".starter/runtime"), join(dir, "replaced-runtime"));
    }
    interruptAfter("rollback-runtime-moved");
    await rename(saved, join(w, ".starter/runtime"));
    interruptAfter("rollback-runtime-restored");
  }
  ensure((await runtimeHashFrom(join(w, ".starter/runtime"))) === journal.plan.runtime.before, "Runtime restauré non conforme à la sauvegarde.");
  for (const name of ["runtime.next", "replaced-runtime", "work", "project.yaml.next"]) await rm(join(dir, name), { recursive: true, force: true });
  journal.status = "rolled-back"; journal.step = "restored"; journal.rollback = rollback; journal.finished_at = new Date().toISOString();
  await saveJournal(w, journal);
  await rm(join(w, MARKER), { force: true });
}

async function latestJournal(w: string): Promise<{ journal: Journal | null; marker: any }> {
  const marker = await readFile(join(w, MARKER), "utf8").then(JSON.parse).catch(() => null);
  const ids = marker?.id ? [marker.id] : (await readdir(join(w, MIGRATIONS)).catch(() => [] as string[])).sort().reverse();
  for (const id of ids) {
    const journal = await readFile(join(w, MIGRATIONS, id, "journal.json"), "utf8").then(JSON.parse).catch(() => null);
    if (journal) return { journal, marker };
  }
  return { journal: null, marker };
}

/** Decision computed from the current files; recomputed under the lock before acting. */
async function assessRollback(w: string, acceptStateChanges: boolean) {
  const { journal, marker } = await latestJournal(w);
  ensure(journal, marker ? `Marqueur ${MARKER} présent sans journal lisible : examiner .starter/migrations avant toute action.` : "Aucune migration du runtime enregistrée dans ce workspace.");
  ensure(journal.format === 2, `Journal de migration au format ${journal.format} : non pris en charge par cette distribution.`);
  const resumingRollback = marker?.operation === "runtime-rollback" && marker?.id === journal.id;
  ensure(!["rolled-back", "abandoned"].includes(journal.status) || resumingRollback, `La dernière migration (${journal.id}) est déjà ${journal.status === "abandoned" ? "abandonnée" : "annulée"}.`);
  const mode: "abandon" | "interrupted" | "applied" = journal.status === "preparing" && !resumingRollback ? "abandon"
    : journal.status === "applied" && !resumingRollback ? "applied" : "interrupted";
  const blockers: string[] = [], notes: string[] = [];
  const replaced = journal.plan.operations.filter(o => o.action === "replace");
  const inFlight = journal.step.replace(/^(writing|restoring):/, "");
  if (mode === "abandon") notes.push(`Migration ${journal.id} interrompue avant toute modification du workspace : seuls ses propres fichiers sont retirés.`);
  else if (mode === "applied") {
    if ((await runtimeHashFrom(join(w, ".starter/runtime"))) !== journal.plan.runtime.after) blockers.push("Le runtime installé a changé depuis la migration.");
    for (const op of replaced)
      if ((await contentHash(join(w, op.path), op.kind)) !== op.after) blockers.push(`${op.path} a changé depuis la migration : reporter ce changement avant d'annuler.`);
    const now = await fingerprint(w, replaced.map(o => o.path));
    const changed = [...new Set([...Object.keys(now), ...Object.keys(journal.plan.untouched)])].filter(p => now[p] !== journal.plan.untouched[p]);
    if (changed.length) {
      if (!acceptStateChanges) blockers.push(`Le workspace a changé depuis la migration (${changed.slice(0, 5).join(", ")}${changed.length > 5 ? "…" : ""}) : annulation bloquée. Avec --accept-state-changes, elle n'est permise que si le suivi actuel est lisible par le runtime précédent.`);
      else {
        const schema = JSON.parse(await readFile(join(w, MIGRATIONS, journal.id, "backup/.starter/runtime/core/schemas/workflow.schema.json"), "utf8"));
        const ajv = new Ajv2020({ allErrors: true, strict: false });
        if (!ajv.validate(schema, JSON.parse(await readFile(join(w, ".starter/workflow.json"), "utf8"))))
          blockers.push(`État actuel illisible par le runtime ${journal.plan.from} (${ajv.errorsText()}) : annulation impossible sans perdre des preuves.`);
        else notes.push(`Changements acceptés explicitement (${changed.length} fichier(s)) : suivi validé par le schéma du runtime ${journal.plan.from}.`);
      }
    }
  } else {
    notes.push(`${resumingRollback ? "Annulation" : "Migration"} ${journal.id} interrompue à l'étape « ${journal.step} » : restauration depuis la sauvegarde vérifiée.`);
    // Never overwrite a change made after the interruption (the previous runtime may have stayed usable).
    const runtimeNow = await runtimeHashFrom(join(w, ".starter/runtime"));
    const runtimeAbsent = !(await pathExists(join(w, ".starter/runtime")));
    if (!runtimeAbsent && runtimeNow !== journal.plan.runtime.before && runtimeNow !== journal.plan.runtime.after)
      blockers.push("Le runtime installé ne correspond ni à l'ancien ni au nouveau : examiner avant toute restauration.");
    for (const op of replaced) {
      const now = await contentHash(join(w, op.path), op.kind);
      if (now === op.before || now === op.after || (op.path === inFlight && now === null)) continue;
      blockers.push(`${op.path} a été modifié après l'interruption : reporter ce changement, puis relancer l'annulation.`);
    }
  }
  return { journal, marker, mode, blockers, notes };
}

export async function rollbackUpgrade(workspace: string, options: { dryRun: boolean; acceptStateChanges: boolean; by: string; request: string }) {
  const w = await canonicalPath(workspace);
  // A migration killed while planning leaves only its lock (no journal, nothing written): release it.
  const owner = await readFile(join(w, LOCK, "owner.json"), "utf8").then(JSON.parse).catch(() => null);
  if (owner?.runtime_upgrade && !alive(owner.pid) && !(await pathExists(join(w, MIGRATIONS, owner.runtime_upgrade, "journal.json"))) && !(await pathExists(join(w, MARKER)))) {
    if (options.dryRun) return { dry_run: true, mode: "stale-lock", notes: [`Verrou laissé par la migration ${owner.runtime_upgrade}, arrêtée avant toute écriture : il sera retiré.`], blockers: [] };
    declaration(options.by, options.request);
    const stale = join(w, `${LOCK}.stale-${randomUUID()}`);
    await rename(join(w, LOCK), stale);
    await rm(stale, { recursive: true, force: true });
    return { dry_run: false, mode: "stale-lock", lock_released: true, notes: ["Migration arrêtée avant toute écriture : seul son verrou a été retiré."] };
  }
  const first = await assessRollback(w, options.acceptStateChanges);
  const summary = (a: typeof first) => ({ dry_run: options.dryRun, migration: a.journal.id, from: a.journal.plan.from, to: a.journal.plan.to,
    mode: a.mode, interrupted: a.mode !== "applied", blockers: a.blockers, notes: a.notes,
    restores: a.mode === "abandon" ? [] : [".starter/runtime", ...a.journal.plan.operations.filter(o => o.action === "replace").map(o => o.path)],
    never_written: "tous les autres fichiers du workspace, dont .starter/workflow.json, .starter/history/, reports/ et BACKLOG.md" });
  if (options.dryRun) return summary(first);
  if (first.blockers.length) throw new Error(`Annulation refusée ; rien n'a été écrit :\n- ${first.blockers.join("\n- ")}`);
  declaration(options.by, options.request);
  // A crashed migration or rollback may have left its own lock; it is taken over atomically.
  const lockOwner = await readFile(join(w, LOCK, "owner.json"), "utf8").then(JSON.parse).catch(() => null);
  await takeLock(w, first.journal.id, lockOwner?.runtime_upgrade === first.journal.id ? first.journal.id : undefined);
  let decided: typeof first;
  try {
    // Re-assessed under the lock: another recovery may have finished in the meantime.
    decided = await assessRollback(w, options.acceptStateChanges);
    if (decided.blockers.length) throw new Error(`Annulation refusée ; rien n'a été écrit :\n- ${decided.blockers.join("\n- ")}`);
    const record = { by: options.by, request: options.request, at: new Date().toISOString(),
      reason: decided.mode === "applied" ? "annulation demandée" : `interrompue à l'étape ${decided.journal.step}`, state_changes_accepted: options.acceptStateChanges };
    if (decided.mode === "abandon") await abandon(w, decided.journal, `abandon demandé : ${options.request}`);
    else await restore(w, decided.journal, record);
  } finally { await releaseLock(w); }
  let readable = "non vérifié";
  try { behavior(w); readable = "suivi relu par le runtime restauré"; } catch (error) { readable = `lecture impossible : ${(error as Error).message}`; }
  return { ...summary(decided), dry_run: false, rolled_back: true, verification: readable };
}

/** Engine guard: while a migration marker exists, only recovery commands run (and the migration's own reads). */
export async function assertNoMigrationInProgress(w: string, action: string): Promise<void> {
  const raw = await readFile(join(w, MARKER), "utf8").catch(() => null);
  if (raw === null) return;
  let marker: any = {};
  try { marker = JSON.parse(raw); } catch {}
  if (["runtime-upgrade", "runtime-rollback", "recover-lock", "help"].includes(action)) return;
  if (marker.verify && process.env[VERIFY_ENV] === marker.verify && ["status", "context"].includes(action)) return;
  throw new Error(`Migration ou annulation du runtime interrompue ou en cours (${marker.id ?? "identifiant illisible"}). Ce workspace ne doit pas être utilisé. Restaurer avec la distribution : ${marker.recovery ?? "workflow runtime-rollback --workspace CHEMIN --by PERSONNE --request MOTS_REELS"}`);
}
