/** Phase execution integrated into the Node CLI. One authoritative plan and execution file. */
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, lstat, mkdir, rm } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";
import YAML from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { writeFileAtomic, pathExists, canonicalPath } from "./fs-safe.js";
import { hashDirectory } from "./content-hash.js";
import { schemasRoot } from "./paths.js";
import { isPathInsideOrEqual } from "./text.js";
import { inspectPhaseSources, requireCurrentSources, type PhaseSource } from "./phase-sources.js";
import { NATIVE_ADAPTERS, installedNativeAdapters, isNativeAdapter, workflowCommand } from "./native-adapters.js";

export const STATE = ".starter/workflow.json";
export const VIEW = "BACKLOG.md";
export const ignored = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  ".DS_Store",
  ".next",
  "dist",
  "build",
  "coverage",
  ".pytest_cache",
  ".coverage",
  "BuildArtifacts",
  "DerivedData",
  ".build",
]);
export type Approval = {
  by: string;
  request: string;
  at: string;
  hash: string;
};
export type Task = { id: string; title: string; human: boolean };
export type Phase = {
  id: string;
  iteration: number;
  title: string;
  goal: string;
  validation: string;
  excludes: string;
  depends_on: string[];
  optional: boolean;
  agent: string;
  tasks: Task[];
  sources?: PhaseSource[];
  mandate: Approval | null;
  acceptance: Approval | null;
  blocked: string | null;
  baseline: string[];
};
export type Proof = {
  id: string;
  phase: string;
  tasks: string[];
  kind: "check" | "observation" | "review";
  contract: string;
  code: string;
  ref: string;
  report_hash: string;
  by: string;
  request: string;
  at: string;
  passed: boolean;
  verdict: string;
  independent: boolean;
};
export type Workflow = {
  schema_version: 3;
  revision: number;
  next_id: number;
  active: string | null;
  brief: Approval | null;
  setup: { ref: string; hash: string } | null;
  phases: Phase[];
  proofs: Proof[];
  retired_ids: string[];
  events: { at: string; action: string; by: string; request: string }[];
  view_hash: string | null;
};
export const hash = (x: unknown): string =>
  createHash("sha256")
    .update(typeof x === "string" || Buffer.isBuffer(x) ? x : JSON.stringify(x))
    .digest("hex");
const now = (): string => new Date().toISOString();
export function ensure(x: unknown, message: string): asserts x {
  if (!x) throw new Error(message);
}
export function declaration(by: string, request: string): void {
  ensure(
    by?.trim() && request?.trim(),
    "Indiquer la personne et ses mots réels ; ne pas inventer une décision.",
  );
}
export function contract(p: Phase): string {
  return hash({
    iteration: p.iteration,
    goal: p.goal,
    validation: p.validation,
    excludes: p.excludes,
    depends_on: p.depends_on,
    tasks: p.tasks,
    ...(p.sources?.length ? { sources: p.sources } : {}),
  });
}
export async function codePath(w: string): Promise<string> {
  w = await canonicalPath(w);
  const c = YAML.parse(await readFile(join(w, "project.yaml"), "utf8"));
  const root = await canonicalPath(resolve(w, c.paths.code_root));
  ensure(
    !isPathInsideOrEqual(root, w) && !isPathInsideOrEqual(w, root),
    "Le code et le workspace doivent être séparés.",
  );
  return root;
}
export async function tree(root: string): Promise<Record<string, string>> {
  ensure((await lstat(root)).isDirectory(), "Dossier de code introuvable.");
  const out: Record<string, string> = {};
  async function walk(dir: string): Promise<void> {
    for (const name of (await readdir(dir)).sort()) {
      if (ignored.has(name)) continue;
      const p = join(dir, name),
        s = await lstat(p);
      ensure(
        !s.isSymbolicLink(),
        `Lien symbolique dans les sources : ${relative(root, p)}. Déplacer les sorties générées dans un dossier de compilation reconnu.`,
      );
      if (s.isDirectory()) await walk(p);
      else if (s.isFile())
        out[relative(root, p).split("\\").join("/")] = hash(await readFile(p));
      else
        throw new Error(
          `Type de fichier non pris en charge : ${relative(root, p)}`,
        );
    }
  }
  await walk(root);
  return out;
}
export async function sourceHash(w: string): Promise<string> {
  return hash(await tree(await codePath(w)));
}
async function safeLocal(w: string, ref: string): Promise<string> {
  ensure(
    !isAbsolute(ref) && ref && !ref.split(/[\\/]/).includes(".."),
    "Chemin relatif interne requis.",
  );
  // macOS temp paths may name /var while realpath returns /private/var.
  // Compare both paths in the same canonical namespace, without allowing escape.
  const root = await canonicalPath(w),
    path = join(root, ref),
    canonical = await canonicalPath(path);
  ensure(
    canonical !== root &&
      isPathInsideOrEqual(canonical, root) &&
      !(await lstat(path)).isSymbolicLink(),
    "Référence hors du workspace ou liée symboliquement.",
  );
  return path;
}
export async function loadWorkflow(w: string): Promise<Workflow> {
  const raw = await readFile(await safeLocal(w, STATE), "utf8");
  const s = JSON.parse(raw) as Workflow;
  const schema = JSON.parse(
    await readFile(join(schemasRoot, "workflow.schema.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ensure(
    ajv.validate(schema, s),
    `État du workflow invalide : ${ajv.errorsText()}. Restaurer une sauvegarde ; ne pas réinitialiser.`,
  );
  validatePlan(s.phases);
  ensure(
    s.active === null || s.phases.some((p) => p.id === s.active),
    "Phase active inconnue.",
  );
  ensure(
    !s.phases
      .flatMap((p) => [p.id, ...p.tasks.map((t) => t.id)])
      .some((id) => s.retired_ids.includes(id)),
    "Identité retirée réutilisée.",
  );
  for (const e of s.proofs)
    ensure(
      s.phases.some((p) => p.id === e.phase) || s.retired_ids.includes(e.phase),
      "Preuve de phase inconnue.",
    );
  return s;
}
export function validatePlan(phases: Phase[]): void {
  const ids = new Set<string>();
  for (const p of phases) {
    if (p.sources !== undefined) {
      ensure(Array.isArray(p.sources), "Références de phase : tableau requis.");
      const paths = new Set<string>();
      for (const source of p.sources) {
        ensure(source && typeof source.path === "string" && source.path.trim() && /^[a-f0-9]{64}$/.test(source.sha256), "Référence : path et sha256 requis.");
        ensure(!paths.has(source.path), "Référence dupliquée dans la phase.");
        paths.add(source.path);
      }
    }
    ensure(
      p.id && p.title?.trim() && p.goal?.trim(),
      "Chaque phase doit avoir un titre et un résultat.",
    );
    for (const id of [p.id, ...p.tasks.map((t) => t.id)]) {
      ensure(
        /^[pt]-[a-zA-Z0-9-]+$/.test(id) && !ids.has(id),
        `Identité invalide ou dupliquée : ${id}`,
      );
      ids.add(id);
    }
    for (const t of p.tasks) ensure(t.title?.trim(), "Tâche vide.");
  }
  const seen = new Set<string>(),
    visiting = new Set<string>();
  function visit(id: string): void {
    if (seen.has(id)) return;
    ensure(!visiting.has(id), "Dépendances cycliques.");
    visiting.add(id);
    const p = phases.find((p) => p.id === id);
    ensure(p, `Dépendance absente : ${id}`);
    for (const d of p.depends_on) visit(d);
    visiting.delete(id);
    seen.add(id);
  }
  for (const p of phases) visit(p.id);
}
export async function currentProof(
  w: string,
  p: Phase,
  e: Proof,
  code: string,
): Promise<boolean> {
  if (
    !e.passed ||
    e.phase !== p.id ||
    e.contract !== contract(p) ||
    e.code !== code
  )
    return false;
  try {
    await requireCurrentSources(w, p.sources);
    return e.report_hash === hash(await readFile(await safeLocal(w, e.ref)));
  } catch {
    return false;
  }
}
export async function phaseStatus(
  w: string,
  s: Workflow,
  p: Phase,
  code: string,
): Promise<{ state: string; done: string[]; review: boolean }> {
  // Accepted phases are historical milestones. Regressions are checked during new work and shipping.
  if (p.acceptance?.hash === contract(p))
    return { state: "accepted", done: p.tasks.map((t) => t.id), review: true };
  if ((await inspectPhaseSources(w, p.sources)).some(source => !source.current))
    return { state: "blocked", done: [], review: false };
  const done = new Set<string>();
  let review = false;
  const latestReview = s.proofs
    .filter((e) => e.phase === p.id && e.kind === "review")
    .at(-1);
  for (const e of s.proofs) {
    if (e.phase !== p.id || e.contract !== contract(p) || e.code !== code)
      continue;
    let intact = false;
    try {
      intact =
        e.report_hash === hash(await readFile(await safeLocal(w, e.ref)));
    } catch {}
    if (
      e.kind === "review" &&
      e === latestReview &&
      e.passed &&
      intact &&
      e.independent
    )
      review = true;
    for (const id of e.tasks) {
      const t = p.tasks.find((t) => t.id === id);
      if (t && (!t.human || e.kind === "observation")) {
        if (e.passed && intact) done.add(id);
        else done.delete(id);
      }
    }
  }
  const state = p.blocked
    ? "blocked"
    : done.size === p.tasks.length && p.tasks.length > 0
      ? review
        ? "ready_for_acceptance"
        : "ready_for_review"
      : p.mandate
        ? "in_progress"
        : "ready";
  return { state, done: [...done], review };
}
export async function renderView(
  w: string,
  s: Workflow,
  code: string,
): Promise<string> {
  const lines = [
    "# À faire",
    "",
    "Vue générée : demander les changements à l’agent. Les preuves détaillées restent dans les rapports.",
    "",
  ];
  for (const [i, p] of s.phases.entries()) {
    const v = await phaseStatus(w, s, p, code);
    const labels: Record<string, string> = {
      accepted: "Acceptée",
      blocked: "Bloquée",
      ready_for_acceptance: "Prête à accepter",
      ready_for_review: "Prête pour la revue",
      in_progress: "En cours",
      ready: "À faire",
    };
    lines.push(
      `## Phase ${i + 1} — ${p.title}`,
      ``,
      `Objectif : ${p.goal}`,
      `Validation : ${p.validation || "À préciser avant lancement."}`,
    );
    if (p.optional) lines.push("Facultative.");
    if (p.excludes) lines.push(`Hors périmètre : ${p.excludes}`);
    if (p.depends_on.length)
      lines.push(
        `Après : ${p.depends_on.map((id) => s.phases.find((x) => x.id === id)!.title).join(", ")}`,
      );
    lines.push(
      "",
      ...p.tasks.map(
        (t) =>
          `- [${v.done.includes(t.id) ? "x" : " "}] ${t.human ? "[essai humain] " : ""}${t.title}`,
      ),
      "",
      `État : ${labels[v.state]}${p.blocked ? ` — ${p.blocked}` : ""}.`,
      "",
    );
  }
  return lines.join("\n");
}
export async function refreshView(
  w: string,
  s: Workflow,
  repair = false,
): Promise<void> {
  const file = join(w, VIEW);
  if (await pathExists(file)) {
    const raw = await readFile(file, "utf8");
    if (s.view_hash && hash(raw) !== s.view_hash) {
      ensure(
        repair,
        "Le backlog généré a été modifié. Examiner puis utiliser workflow repair-view ; le texte sera archivé.",
      );
      await writeFileAtomic(
        join(w, ".starter/history", `manual-view-${randomUUID()}.md`),
        raw,
      );
    }
  }
  const view = await renderView(w, s, await sourceHash(w));
  await writeFileAtomic(file, view);
  s.view_hash = hash(view);
}
export async function saveWorkflow(
  w: string,
  s: Workflow,
  action: string,
  by: string,
  request: string,
): Promise<void> {
  const schema = JSON.parse(
    await readFile(join(schemasRoot, "workflow.schema.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ensure(
    ajv.validate(schema, s),
    `État proposé invalide : ${ajv.errorsText()}`,
  );
  s.revision++;
  s.events.push({ at: now(), action, by, request });
  // State is committed first; a crashed view write is repaired from this authority.
  const view = await renderView(w, s, await sourceHash(w));
  s.view_hash = hash(view);
  const data = JSON.stringify(s, null, 2) + "\n";
  await writeFileAtomic(
    join(w, ".starter/history", `revision-${s.revision}-${randomUUID()}.json`),
    data,
  );
  await writeFileAtomic(join(w, STATE), data);
  await writeFileAtomic(join(w, VIEW), view);
}
export async function mutateWorkflow<T>(
  w: string,
  action: string,
  by: string,
  request: string,
  fn: (s: Workflow) => Promise<T>,
  repair = false,
): Promise<T> {
  w = await canonicalPath(w);
  const lock = join(w, ".starter/write.lock");
  await mkdir(dirname(lock), { recursive: true });
  try {
    await mkdir(lock);
  } catch {
    throw new Error(
      "Workspace occupé : examiner .starter/write.lock/owner.json.",
    );
  }
  try {
    await writeFileAtomic(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, at: now() }),
    );
    const raw = await readFile(join(w, STATE)),
      s = await loadWorkflow(w);
    const view = await readFile(join(w, VIEW), "utf8").catch(() => null);
    ensure(
      repair || view === null || s.view_hash === hash(view),
      "Vue générée modifiée : examiner puis workflow repair-view.",
    );
    const result = await fn(s);
    ensure(
      hash(await readFile(join(w, STATE))) === hash(raw),
      "État changé pendant la commande ; préserver les deux versions.",
    );
    ensure(
      (await readFile(join(w, VIEW), "utf8").catch(() => null)) === view,
      "Backlog modifié pendant la commande ; ne pas écraser.",
    );
    await saveWorkflow(w, s, action, by, request);
    return result;
  } finally {
    await rm(lock, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}
export async function initializeWorkflow(w: string): Promise<void> {
  w = await canonicalPath(w);
  ensure(!(await pathExists(join(w, STATE))), "Workflow déjà initialisé.");
  ensure(
    !(await pathExists(join(w, "taches/BACKLOG.md"))),
    "Ancien backlog présent : utiliser la migration vers un nouveau workspace.",
  );
  await sourceHash(w);
  const s: Workflow = {
    schema_version: 3,
    revision: 0,
    next_id: 1,
    active: null,
    brief: null,
    setup: null,
    phases: [],
    proofs: [],
    retired_ids: [],
    events: [],
    view_hash: null,
  };
  await saveWorkflow(
    w,
    s,
    "init",
    "system",
    "Création sans approbation produit.",
  );
}
export function choose(s: Workflow, id?: string): Phase {
  const p = id
    ? (s.phases.find((p) => p.id === id) ?? s.phases[Number(id) - 1])
    : s.phases.find((p) => p.id === s.active);
  ensure(p, "Phase introuvable : utiliser le numéro affiché ou son identité.");
  return p;
}
function affect(s: Workflow, ids: Set<string>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of s.phases)
      if (!ids.has(p.id) && p.depends_on.some((d) => ids.has(d))) {
        ids.add(p.id);
        changed = true;
      }
  }
  for (const p of s.phases)
    if (ids.has(p.id)) {
      p.iteration++;
      p.mandate = null;
      p.acceptance = null;
      p.blocked = null;
      if (s.active === p.id) s.active = null;
    }
}
export async function applyPlan(
  w: string,
  input: unknown,
  by: string,
  request: string,
  allowActive = false,
  migration = false,
): Promise<unknown> {
  w = await canonicalPath(w);
  declaration(by, request);
  ensure(
    Array.isArray(input),
    "Le fichier plan doit contenir un tableau de phases.",
  );
  return mutateWorkflow(w, "plan", by, request, async (s) => {
    const old = s.phases;
    const next: Phase[] = input.map((v: any) => {
      ensure(
        v && typeof v === "object" && !Array.isArray(v),
        "Phase invalide.",
      );
      const id = v.id ?? `p-${s.next_id++}`;
      const existing = old.find((p) => p.id === id);
      ensure(!s.retired_ids.includes(id), "Identité retirée réutilisée.");
      ensure(
        !v.id || existing || (migration && /^p-legacy-/.test(id)),
        "Nouvelle phase : omettre id pour laisser le moteur l’allouer.",
      );
      const tasks = (v.tasks ?? []).map((t: any) => {
        if (typeof t === "string")
          return { id: `t-${s.next_id++}`, title: t, human: false };
        ensure(t && typeof t.title === "string", "Tâche invalide.");
        if (t.id)
          ensure(
            existing?.tasks.some((e) => e.id === t.id) ||
              (migration && /^t-legacy-/.test(t.id)),
            "Identité de tâche étrangère ou inconnue.",
          );
        return {
          id: t.id ?? `t-${s.next_id++}`,
          title: t.title,
          human: t.human ?? false,
        };
      });
      const p: Phase = {
        id,
        iteration: existing?.iteration ?? 1,
        title: v.title,
        goal: v.goal,
        validation: v.validation ?? "",
        excludes: v.excludes ?? "",
        depends_on: v.depends_on ?? [],
        optional: v.optional ?? false,
        agent: v.agent ?? "builder",
        tasks,
        ...(v.sources !== undefined || existing?.sources ? { sources: v.sources ?? existing?.sources } : {}),
        mandate: existing?.mandate ?? null,
        acceptance: existing?.acceptance ?? null,
        blocked: existing?.blocked ?? null,
        baseline: existing?.baseline ?? [],
      };
      return p;
    });
    for (const p of next)
      p.depends_on = p.depends_on.map((d) => {
        if (next.some((q) => q.id === d)) return d;
        const matches = next.filter((q) => q.title === d);
        ensure(matches.length === 1, `Dépendance absente ou ambiguë : ${d}`);
        return matches[0]!.id;
      });
    validatePlan(next);
    // Unchanged references may stay stale on unrelated phases. New contracts must bind real snapshots.
    for (const p of next) {
      const previous = old.find(q => q.id === p.id);
      if (!previous || contract(previous) !== contract(p)) await requireCurrentSources(w, p.sources);
    }
    const changed = new Set(
      old
        .filter(
          (p) =>
            !next.some((q) => q.id === p.id && contract(q) === contract(p)),
        )
        .map((p) => p.id),
    );
    const impacted = new Set(changed);
    let grow = true;
    while (grow) {
      grow = false;
      for (const p of [...old, ...next])
        if (!impacted.has(p.id) && p.depends_on.some((d) => impacted.has(d))) {
          impacted.add(p.id);
          grow = true;
        }
    }
    ensure(
      !s.active || !impacted.has(s.active) || allowActive,
      "Cette évolution affecte la phase active. Présenter les conséquences et consigner l’arbitrage avec --allow-active-change.",
    );
    const ids = next.flatMap((p) => [p.id, ...p.tasks.map((t) => t.id)]);
    s.retired_ids.push(
      ...old
        .flatMap((p) => [p.id, ...p.tasks.map((t) => t.id)])
        .filter((id) => !ids.includes(id)),
    );
    s.phases = next;
    affect(s, impacted);
    return {
      phases: next.map((p) => ({ id: p.id, title: p.title })),
      reopened: [...impacted],
    };
  });
}
export async function beginPhase(
  w: string,
  id: string,
  by: string,
  request: string,
): Promise<unknown> {
  w = await canonicalPath(w);
  declaration(by, request);
  return mutateWorkflow(w, "begin", by, request, async (s) => {
    const p = choose(s, id);
    await requireCurrentSources(w, p.sources);
    ensure(
      s.brief &&
        s.brief.hash === hash(await readFile(join(w, "PROJECT_BRIEF.md"))),
      "Le brief courant doit être approuvé ; ne pas réutiliser une ancienne approbation après modification.",
    );
    ensure(
      s.setup &&
        s.setup.hash === hash(await readFile(await safeLocal(w, s.setup.ref))),
      "Socle à vérifier : rapport de setup requis.",
    );
    ensure(
      p.validation.trim() &&
        !/À préciser|à compléter/i.test(p.validation) &&
        p.tasks.length,
      "Préciser les tâches et critères de validation avant le lancement.",
    );
    ensure(
      !p.acceptance,
      "Phase déjà acceptée : rouvrir avec le motif réel si nécessaire.",
    );
    ensure(!p.blocked, `Phase bloquée : ${p.blocked}`);
    ensure(!s.active || s.active === p.id, "Une autre phase est active.");
    for (const dep of p.depends_on)
      ensure(
        s.phases.find((p) => p.id === dep)?.acceptance,
        "Une dépendance reste à accepter.",
      );
    const reused = Boolean(p.mandate?.hash === contract(p));
    if (!reused) {
      p.mandate = { by, request, at: now(), hash: contract(p) };
      p.baseline = await changedFiles(await codePath(w));
    }
    s.active = p.id;
    return { phase: p.id, reused, agent: p.agent };
  });
}
export async function recordProof(
  w: string,
  id: string,
  by: string,
  request: string,
  kind: Proof["kind"],
  tasks: string[],
  options: {
    command?: string[];
    report?: string;
    summary?: string;
    verdict?: string;
    independent?: boolean;
    timeout?: number;
  },
): Promise<unknown> {
  w = await canonicalPath(w);
  declaration(by, request);
  return mutateWorkflow(w, kind, by, request, async (s) => {
    const p = choose(s, id);
    await requireCurrentSources(w, p.sources);
    ensure(
      s.brief?.hash === hash(await readFile(join(w, "PROJECT_BRIEF.md"))),
      "Brief modifié : réconcilier avant de poursuivre.",
    );
    ensure(
      s.active === p.id && p.mandate?.hash === contract(p),
      "Lancer ou reprendre la phase avant une preuve.",
    );
    ensure(!p.blocked, "Résoudre le blocage avant de poursuivre.");
    ensure(
      kind === "review" || tasks.length > 0,
      "Préciser les tâches effectivement vérifiées.",
    );
    for (const id of tasks) {
      const t = p.tasks.find((t) => t.id === id);
      ensure(t, "Tâche étrangère à la phase.");
      ensure(
        !t.human || kind === "observation",
        "Un essai humain exige une observation reçue.",
      );
    }
    const code = await sourceHash(w);
    let content = "",
      passed = options.verdict === undefined || options.verdict === "passed",
      verdict = options.verdict ?? "passed";
    if (kind === "check") {
      ensure(options.command?.length, "Commande de contrôle absente.");
      const timeout = options.timeout ?? 120000;
      ensure(
        Number.isSafeInteger(timeout) && timeout > 0,
        "Délai de contrôle positif requis, en millisecondes.",
      );
      const started = Date.now(),
        cwd = await codePath(w);
      const run = spawnSync(options.command[0]!, options.command.slice(1), {
        cwd,
        encoding: "utf8",
        timeout,
        maxBuffer: 4 * 1024 * 1024,
        shell: false,
      });
      const sourceUnchanged = code === (await sourceHash(w));
      const referencesUnchanged = (await inspectPhaseSources(w, p.sources)).every(source => source.current);
      passed = run.status === 0 && !run.error && sourceUnchanged && referencesUnchanged;
      content = JSON.stringify(
        {
          command: options.command,
          environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            cwd,
          },
          elapsed_ms: Date.now() - started,
          exit_code: run.status,
          signal: run.signal,
          error: run.error?.message ?? null,
          stdout: run.stdout,
          stderr: run.stderr,
          source_unchanged: sourceUnchanged,
          ...(p.sources?.length ? { references_unchanged: referencesUnchanged } : {}),
        },
        null,
        2,
      );
    } else if (kind === "observation") {
      ensure(
        options.summary?.trim(),
        "Décrire l’observation humaine réellement reçue.",
      );
      content = JSON.stringify(
        { by, request, summary: options.summary, code },
        null,
        2,
      );
    } else {
      ensure(options.report, "Rapport de revue requis.");
      content = await readFile(resolve(options.report), "utf8");
      ensure(content.trim(), "Rapport vide.");
      const report = JSON.parse(content);
      ensure(
        report.code_hash === code && report.contract_hash === contract(p),
        "La revue doit nommer les empreintes exactes retournées par context.",
      );
      ensure(
        typeof report.summary === "string" && report.summary.trim(),
        "Synthèse de revue manquante.",
      );
      ensure(
        ["passed", "changes_required", "blocked"].includes(verdict),
        "Verdict inconnu.",
      );
      passed = verdict === "passed";
    }
    const ref = `reports/phases/${p.id}/${randomUUID()}.json`;
    await writeFileAtomic(join(w, ref), content);
    const e: Proof = {
      id: `e-${s.next_id++}`,
      phase: p.id,
      tasks,
      kind,
      contract: contract(p),
      code,
      ref,
      report_hash: hash(content),
      by,
      request,
      at: now(),
      passed,
      verdict,
      independent: kind === "review" && options.independent === true,
    };
    s.proofs.push(e);
    return { proof: e.id, passed, report: ref };
  });
}
export async function status(w: string, id?: string): Promise<unknown> {
  const s = await loadWorkflow(w),
    code = await sourceHash(w);
  const phases = await Promise.all(
    s.phases.map(async (p, i) => ({
      number: i + 1,
      id: p.id,
      title: p.title,
      ...(await phaseStatus(w, s, p, code)),
    })),
  );
  if (id) {
    const p = choose(s, id);
    return {
      revision: s.revision,
      phase: p,
      status: phases.find((x) => x.id === p.id),
      proofs: s.proofs.filter((e) => e.phase === p.id),
      code_hash: code,
      contract_hash: contract(p),
      code_root: await codePath(w),
      ...(p.sources?.length ? { source_references: await inspectPhaseSources(w, p.sources) } : {}),
    };
  }
  const brief = Boolean(
    s.brief &&
      s.brief.hash === hash(await readFile(join(w, "PROJECT_BRIEF.md"))),
  );
  let setup = false;
  try {
    setup = Boolean(
      s.setup &&
        s.setup.hash === hash(await readFile(await safeLocal(w, s.setup.ref))),
    );
  } catch {}
  const viewOutdated = s.view_hash !== hash(await renderView(w, s, code));
  const next =
    s.phases.find(
      (p) =>
        !p.acceptance &&
        !p.optional &&
        !p.blocked &&
        phases.find(q => q.id === p.id)?.state !== "blocked" &&
        p.depends_on.every(
          (id) => s.phases.find((x) => x.id === id)?.acceptance,
        ),
    ) ??
    s.phases.find(
      (p) =>
        !p.acceptance &&
        !p.blocked &&
        phases.find(q => q.id === p.id)?.state !== "blocked" &&
        p.depends_on.every(
          (id) => s.phases.find((x) => x.id === id)?.acceptance,
        ),
    );
  return {
    revision: s.revision,
    brief_approved: brief,
    setup_recorded: setup,
    backlog_refresh_needed: viewOutdated,
    active: s.active,
    phases,
    next:
      !s.active && next
        ? { id: next.id, title: next.title, goal: next.goal, agent: next.agent }
        : null,
    recommended: !brief
      ? "project-start / project-handoff"
      : !setup
        ? "project-setup"
        : !s.phases.length
          ? "project-plan"
          : s.active
            ? "project-phase / project-review"
            : next
              ? "project-next"
              : phases.some(p => p.state === "blocked")
                ? "project-start / project-plan"
                : "project-ship",
  };
}
export async function changedFiles(root: string): Promise<string[]> {
  const a = spawnSync("git", ["diff", "--name-only", "-z", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const b = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  );
  if (b.status !== 0) return [];
  const staged = spawnSync("git", ["diff", "--cached", "--name-only", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  const unstaged = spawnSync("git", ["diff", "--name-only", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  return [
    ...new Set(
      [a.status === 0 ? a.stdout : "", b.stdout, staged.stdout, unstaged.stdout]
        .join("\0")
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
}
export async function diagnoseWorkflow(w: string): Promise<string[]> {
  const errors: string[] = [];
  try {
    const s = await loadWorkflow(w);
    if (await pathExists(join(w, "taches/BACKLOG.md")))
      errors.push(
        "Deux plans actifs détectés : archiver le backlog hérité lors de la migration.",
      );
    if (await pathExists(join(w, ".starter/write.lock")))
      errors.push(
        "Écriture en cours ou verrou résiduel : examiner son propriétaire.",
      );
    if (s.view_hash !== hash(await readFile(join(w, VIEW))))
      errors.push(
        "Vue backlog modifiée ou écriture interrompue : workflow repair-view après examen.",
      );
    if (s.active) {
      if (s.brief?.hash !== hash(await readFile(join(w, "PROJECT_BRIEF.md"))))
        errors.push(
          "Brief modifié pendant une phase : réconcilier le cadrage.",
        );
      const p = choose(s);
      for (const source of await inspectPhaseSources(w, p.sources))
        if (!source.current) errors.push(`Référence de phase modifiée ou absente : ${source.path}. Examiner puis réconcilier le plan.`);
      if (p.mandate?.hash !== contract(p))
        errors.push("Mandat périmé pour la phase active.");
    }
    await sourceHash(w);
    if (await pathExists(join(w, ".starter/models.json")) && !await pathExists(join(w, ".starter/native-hashes.json"))) {
      errors.push("Configuration native incomplète : examiner les fichiers puis workflow models-sync.");
    }
    if (await pathExists(join(w, ".starter/native-hashes.json"))) {
      const ledger = JSON.parse(
        await readFile(join(w, ".starter/native-hashes.json"), "utf8"),
      );
      for (const [ref, expected] of Object.entries(ledger))
        if (!(await pathExists(join(w, ref))))
          errors.push(
            `Configuration native absente : ${ref}. Examiner puis workflow models-sync depuis un Terminal.`,
          );
        else if (hash(await readFile(await safeLocal(w, ref))) !== expected)
          errors.push(
            `Configuration native modifiée : ${ref}. Examiner avant synchronisation.`,
          );
      const cfg = YAML.parse(await readFile(join(w, "project.yaml"), "utf8"));
      const adapters = await installedNativeAdapters(w);
      for (const id of adapters) {
        const { label, skills } = NATIVE_ADAPTERS[id];
        const missing: string[] = [];
        for (const skill of cfg.skills ?? []) {
          if (!(await pathExists(join(w, skills, skill.id)))) {
            missing.push(skill.id);
            continue;
          }
          if ((await hashDirectory(join(w, skills, skill.id))) !== skill.source_hash)
            errors.push(
              `Skill natif divergent pour ${label} : ${skill.id}. Examiner puis reporter la modification dans skills/${skill.id} avant skill sync.`,
            );
        }
        if (missing.length)
          errors.push(
            `Copies ${label} absentes dans ${skills} : ${missing.join(", ")}. Depuis un Terminal, assistant fermé : ${await workflowCommand(w, `adapter-add ${id}`)} (aucune copie existante n'est écrasée).`,
          );
      }
      // The historical `adapter add` registers assistants in project.yaml, which phase workspaces
      // do not read for native files: report the gap instead of letting copies silently diverge.
      for (const reference of cfg.adapters ?? [])
        if (isNativeAdapter(reference?.id) && !adapters.includes(reference.id))
          errors.push(
            `Adaptateur ${reference.id} inscrit par la commande historique sans configuration native v3. Examiner ${await workflowCommand(w, `adapter-add ${reference.id} --dry-run`)}, puis relancer sans --dry-run.`,
          );
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return errors;
}
