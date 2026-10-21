/**
 * Continuity of a human observation across a later source revision.
 * The engine computes the exact diff and refuses every change it cannot classify as documentation
 * that the product does not consume. It never creates, edits or re-dates an observation, and it
 * does not replace checks, the independent review on the exact revision, acceptance or commit control.
 */
import { randomUUID } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, writeFileAtomic, canonicalPath } from "./fs-safe.js";
import {
  choose, codePath, contract, contractAt, declaration, hash, loadWorkflow, mutateWorkflow, safeLocal, tree,
  type Phase, type Proof, type Workflow,
} from "./phase-workflow.js";
import { inspectPhaseSources } from "./phase-sources.js";
import { loadTree } from "./tree-snapshots.js";
import { isPrivateEnvFile } from "./source-inventory.js";
import { withoutWholeLineComments } from "./comment-lines.js";

export const CONTINUITY_RUNTIME_MIN = "0.25.0";
/** Bumped whenever the classification rules below change; recorded in every continuity report. */
export const CLASSIFICATION_RULES = 1;

const DOC_EXTENSIONS = new Set(["md", "markdown", "rst", "adoc", "asciidoc"]);
const LEGAL = /(licen[cs]e|copying|notice|third[-_ ]?party|credits|attributions?|privacy|confidential|terms|cgu|cgv|mentions[-_ ]?legales|legal|rgpd|gdpr|cookies?|conditions)/i;
// Folders that frameworks commonly publish or read as content. Any matching segment is excluded.
const PUBLISHED_SEGMENTS = new Set([
  "public", "static", "content", "pages", "app", "posts", "_posts", "_drafts", "blog", "_includes",
  "_layouts", "_data", "www", "site", "_site", "assets", "templates", "views", "resources", "locales", "i18n",
  "src", "lib", "prompts", "help", "data",
]);
// Site generators publish the Markdown of the folder that holds their configuration (any depth).
const SITE_WIDE = [
  /(^|\/)_config\.ya?ml$/, /(^|\/)\.eleventy\.c?js$/, /(^|\/)eleventy\.config\.[cm]?[jt]s$/, /(^|\/)\.vitepress\/config\.[cm]?[jt]s$/,
  /(^|\/)\.vuepress\/config\.[cm]?[jt]s$/, /(^|\/)book\.(toml|json)$/, /(^|\/)conf\.py$/, /(^|\/)\.nojekyll$/, /(^|\/)CNAME$/,
  /(^|\/)antora\.ya?ml$/, /(^|\/)hugo\.(toml|ya?ml|json)$/,
];
const DOCS_DIR = [/(^|\/)mkdocs\.ya?ml$/, /(^|\/)docusaurus\.config\.[cm]?[jt]s$/];
const scopeOf = (config: string): string =>
  config.split("/").slice(0, -1).filter(s => s !== ".vitepress" && s !== ".vuepress").join("/");
const within = (path: string, scope: string): boolean => !scope || path.startsWith(scope + "/");
const DEPENDENCY = /^(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lockb?|requirements[^/]*\.txt|Pipfile(\.lock)?|pyproject\.toml|poetry\.lock|uv\.lock|composer\.(json|lock)|Gemfile(\.lock)?|go\.(mod|sum)|Cargo\.(toml|lock)|Package\.(swift|resolved)|Podfile(\.lock)?|build\.gradle(\.kts)?|settings\.gradle(\.kts)?|pom\.xml|deno\.(json|lock)|.*\.csproj)$/;
const ASSET = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ico", "bmp", "tif", "tiff", "heic", "woff", "woff2",
  "ttf", "otf", "eot", "css", "scss", "sass", "less", "styl", "mp4", "webm", "mov", "mp3", "wav", "ogg", "pdf",
  "riv", "lottie",
]);
const BINARY = new Set([...ASSET].filter(x => !["svg", "css", "scss", "sass", "less", "styl"].includes(x)).concat(["zip", "gz", "jar", "car"]));
const CONFIG_EXTENSIONS = new Set(["yml", "yaml", "toml", "ini", "json", "jsonc", "conf", "cfg", "plist", "xcconfig", "entitlements", "properties", "txt", "xml", "env"]);
// Formatter and linter settings mention "*.md" without making the product consume Markdown.
const TOOLING = /^(\.(prettier|markdownlint|remark|eslint|stylelint|lintstaged|lint-staged|editorconfig|gitattributes|gitignore|npmignore|dockerignore|cspell|vale|textlint|commitlint|nvmrc|node-version|tool-versions)[^/]*|(prettier|eslint|stylelint|commitlint|lint-staged|markdownlint[^/]*)\.config\.[cm]?[jt]s|cspell\.json|\.markdownlint[^/]*)$/;
const TOOLING_DIRS = new Set([".vscode", ".idea", ".husky", ".devcontainer"]);
const LOCKFILES = /^(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|composer\.lock|Cargo\.lock|Gemfile\.lock|poetry\.lock|uv\.lock|Package\.resolved|Podfile\.lock|go\.sum|deno\.lock)$/;
// package.json fields that only describe tooling or npm packaging, not what the product reads.
const PACKAGE_TOOLING_FIELDS = ["devDependencies", "dependencies", "peerDependencies", "optionalDependencies",
  "lint-staged", "prettier", "eslintConfig", "markdownlint", "remarkConfig", "cspell", "engines", "repository",
  "bugs", "homepage", "keywords", "author", "contributors", "license", "funding", "publishConfig", "packageManager"];
// Any mention of the extension (glob, template literal, regex, literal) may make the product read such files.
const WILDCARD = /\.\{?[^\s'"`}]*?\b(md|markdown|rst|adoc|asciidoc)\b/gi;
// Only a script made of one formatter/linter invocation is ignored; any chaining, pipe, redirection or
// substitution keeps the whole script under analysis.
const FORMATTER_SCRIPT = /^\s*(npx\s+)?(prettier|markdownlint|markdownlint-cli2|eslint|cspell|vale|textlint|stylelint|lint-staged)(?=\s|$)(?![^\n]*(\s-o\b|\s-o\S|--out))[^;&|<>`$()\n\\]*$/;
// Tasks, criteria or human statements about documentation make a documentation change relevant.
const DOC_TERMS = /readme|lisez-moi|documentation|\bdocs?\b|install|guide|notice|tutori|mode d['’]emploi|manuel|manual|instructions?/i;
const REOPEN_DOUBT = /essai|test|faux|fausse|erron|échec|echec|incorrect|bug|défaut|defaut|refaire|ne marche|fonctionne pas|régression|regression|wrong|fail|broken|retry|redo|invalide|mauvais/i;
const SENSITIVE_EVENTS = new Set(["reopen", "plan", "restore", "restore-verified", "brief-approve", "task-add", "block", "unblock"]);

export type Category = "documentation" | "published_documentation" | "deleted_documentation" | "legal" | "code" | "configuration" | "dependency" | "asset";
export type Change = {
  path: string;
  change: "added" | "modified" | "deleted";
  before: string | null;
  after: string | null;
  category: Category;
  eligible: boolean;
  reasons: string[];
};
const CONTROL: Record<Exclude<Category, "documentation">, string> = {
  published_documentation: "contenu documentaire publié ou consommé : vérifier son rendu ou son usage par une nouvelle observation",
  deleted_documentation: "document supprimé ou déplacé : vérifier les liens et usages, puis refaire l'essai humain",
  legal: "licence ou mentions : vérifier les obligations applicables ; aucune continuité automatique",
  code: "code : relancer les contrôles automatiques concernés et refaire l'essai humain",
  configuration: "configuration : vérifier l'environnement concerné, relancer les contrôles et refaire l'essai humain",
  dependency: "dépendances : réinstaller depuis le verrou, relancer les contrôles et refaire l'essai humain",
  asset: "asset visuel ou style : contrôle visuel par une nouvelle observation humaine",
};

const extension = (path: string): string => {
  const name = path.split("/").at(-1)!;
  return name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
};
const baseName = (path: string): string => path.split("/").at(-1)!;

export function categoryOf(path: string): Category {
  const name = baseName(path), ext = extension(path);
  if (LEGAL.test(name)) return "legal";
  if (DOC_EXTENSIONS.has(ext)) return "documentation";
  if (DEPENDENCY.test(name)) return "dependency";
  if (ASSET.has(ext)) return "asset";
  if (name.startsWith(".") || CONFIG_EXTENSIONS.has(ext) || /^(Dockerfile|Makefile|Procfile|Caddyfile|CNAME)/.test(name) ||
      /\.config\.[cm]?[jt]s$/.test(name) || name === ".htaccess") return "configuration";
  return "code";
}

function scanned(path: string): boolean {
  // Secrets in private environment files are represented by metadata-only sentinels.
  // Scanning their content would both expose them and fail the snapshot hash check.
  if (isPrivateEnvFile(path)) return false;
  const name = baseName(path), ext = extension(path);
  if (DOC_EXTENSIONS.has(ext) || BINARY.has(ext) || LOCKFILES.test(name) || TOOLING.test(name)) return false;
  return !path.split("/").some(segment => TOOLING_DIRS.has(segment));
}

type Signals = { site_wide: string[]; docs_dirs: string[]; wildcards: Record<string, string[]>; scanned_files: number };

async function productText(root: string, path: string, expected: string): Promise<string | null> {
  const content = await readFile(join(root, path));
  if (hash(content) !== expected) throw new Error(`Fichier modifié pendant l'examen : ${path}. Relancer.`);
  if (content.subarray(0, 8000).includes(0)) return null;
  let text = content.toString("utf8");
  if (baseName(path) === "package.json") {
    try {
      const value = JSON.parse(text);
      for (const field of PACKAGE_TOOLING_FIELDS) delete value[field];
      // Build scripts can copy or render Markdown; only pure formatter/linter scripts are ignored.
      for (const [name, command] of Object.entries(value.scripts ?? {}))
        if (typeof command === "string" && FORMATTER_SCRIPT.test(command)) delete value.scripts[name];
      text = JSON.stringify(value);
    } catch { /* Unreadable JSON is scanned verbatim. */ }
  }
  // Comments occupying whole lines do not make the product read a file; see comment-lines.ts for the doubt rules.
  return withoutWholeLineComments(path, text).toLowerCase();
}

/** Examine the changes between the observed revision and the current one. Pure reading. */
export async function examineChanges(root: string, before: Record<string, string>, after: Record<string, string>) {
  const changes: Change[] = [];
  for (const path of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const a = before[path] ?? null, b = after[path] ?? null;
    if (a === b) continue;
    const category = categoryOf(path);
    changes.push({ path, change: a === null ? "added" : b === null ? "deleted" : "modified", before: a, after: b,
      category, eligible: category === "documentation", reasons: [] });
  }
  const files = Object.keys(after);
  const signals: Signals = {
    site_wide: files.filter(f => SITE_WIDE.some(r => r.test(f))),
    docs_dirs: files.filter(f => DOCS_DIR.some(r => r.test(f))),
    wildcards: {},
    scanned_files: 0,
  };
  const documents = changes.filter(c => c.eligible);
  if (!documents.length) return { changes, signals };
  const references = new Map<string, Set<string>>(documents.map(c => [c.path, new Set<string>()]));
  for (const file of files) {
    if (!scanned(file)) continue;
    const text = await productText(root, file, after[file]!);
    if (text === null) continue;
    signals.scanned_files++;
    if (file.endsWith(".html") && text.includes("docsify")) signals.site_wide.push(file);
    for (const match of text.matchAll(WILDCARD)) {
      const ext = (match[1] ?? match[2])!.toLowerCase();
      (signals.wildcards[ext] ??= []).includes(file) || signals.wildcards[ext]!.push(file);
    }
    for (const doc of documents) {
      const parent = doc.path.split("/").at(-2)?.toLowerCase();
      const folder = parent ? new RegExp(`(^|[^\\w-])${parent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`).test(text) : false;
      if (text.includes(doc.path.toLowerCase()) || text.includes(baseName(doc.path).toLowerCase()) || folder) references.get(doc.path)!.add(file);
    }
  }
  for (const doc of documents) {
    const reasons = doc.reasons, ext = extension(doc.path);
    if (doc.change === "deleted") reasons.push("suppression ou déplacement : contenu d'origine non inspectable par le moteur");
    const segment = doc.path.split("/").slice(0, -1).find(s => PUBLISHED_SEGMENTS.has(s.toLowerCase()));
    if (segment) reasons.push(`dossier habituellement publié ou lu par le produit : ${segment}/`);
    const site = signals.site_wide.filter(config => within(doc.path, scopeOf(config)));
    if (site.length) reasons.push(`générateur ou publication de site détecté : ${site.join(", ")}`);
    const docs = signals.docs_dirs.filter(config => ["docs", "blog"].some(dir => within(doc.path, [scopeOf(config), dir].filter(Boolean).join("/"))));
    if (docs.length) reasons.push(`documentation publiée par ${docs.join(", ")}`);
    if (signals.wildcards[ext]?.length) reasons.push(`extension .${ext} mentionnée par ${signals.wildcards[ext]!.join(", ")} : lecture possible par le produit`);
    const cited = [...references.get(doc.path)!];
    if (cited.length) reasons.push(`fichier ou dossier cité par ${cited.join(", ")}`);
    if (doc.change !== "deleted") {
      const content = await readFile(join(root, doc.path));
      if (hash(content) !== doc.after) throw new Error(`Fichier modifié pendant l'examen : ${doc.path}. Relancer.`);
      const head = content.toString("utf8").replace(/^\uFEFF/, "").slice(0, 5).replace(/\r/g, "");
      if (head.startsWith("---\n") || head.startsWith("+++")) reasons.push("frontmatter : page probablement rendue par un générateur");
    }
    if (reasons.length) {
      doc.eligible = false;
      doc.category = doc.change === "deleted" ? "deleted_documentation" : "published_documentation";
    }
  }
  return { changes, signals };
}

function runtimeVersionAtLeast(version: unknown, minimum: string): boolean {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) return false;
  const a = version.split(".").map(Number), b = minimum.split(".").map(Number);
  return (a.map((n, i) => n - b[i]!).find(n => n !== 0) ?? 0) >= 0;
}

/** A workspace keeps reading its state with its own embedded runtime: never write what it cannot load. */
export async function embeddedRuntime(w: string): Promise<{ version: string | null; compatible: boolean }> {
  const path = join(w, ".starter/runtime/package.json");
  if (!(await pathExists(path))) return { version: null, compatible: true };
  let version: string | null = null;
  try { version = JSON.parse(await readFile(path, "utf8")).version ?? null; } catch {}
  return { version, compatible: runtimeVersionAtLeast(version, CONTINUITY_RUNTIME_MIN) };
}

export async function analyseContinuity(w: string, s: Workflow, p: Phase, originId: string, requested: string[] = []) {
  const blockers: string[] = [];
  const origin = s.proofs.find(e => e.id === originId);
  if (!origin) throw new Error("Preuve d'origine inconnue : utiliser l'identifiant affiché par workflow context.");
  if (origin.phase !== p.id) throw new Error("La preuve d'origine appartient à une autre phase.");
  if (origin.kind !== "observation")
    blockers.push("Seules les observations humaines sont conservables : relancer les contrôles automatiques ; une revue se refait sur la révision exacte.");
  if (!origin.passed) blockers.push("L'observation d'origine n'est pas réussie.");
  try {
    if (origin.report_hash !== hash(await readFile(await safeLocal(w, origin.ref)))) blockers.push(`Rapport de l'observation d'origine modifié : ${origin.ref}.`);
  } catch { blockers.push(`Rapport de l'observation d'origine illisible : ${origin.ref}.`); }
  const human = origin.tasks.filter(id => p.tasks.find(t => t.id === id)?.human);
  const foreign = requested.filter(id => !human.includes(id));
  if (foreign.length) blockers.push(`Tâches non couvertes par un essai humain de cette observation : ${foreign.join(", ")}.`);
  const tasks = (requested.length ? requested.filter(id => human.includes(id)) : human);
  if (!tasks.length) blockers.push("Aucun essai humain de cette observation à conserver.");
  for (const id of tasks) {
    const latest = s.proofs.filter(e => e.phase === p.id && e.kind === "observation" && e.tasks.includes(id)).at(-1);
    if (latest && latest.id !== origin.id) blockers.push(`Observation plus récente pour ${id} : ${latest.id}. Conserver la plus récente ou refaire l'essai.`);
  }
  let iteration: number | null = null, acceptance: string | null = null;
  for (let k = p.iteration; k >= 1 && iteration === null; k--) if (contractAt(p, k) === origin.contract) iteration = k;
  if (iteration === null) blockers.push("Critères, tâches, dépendances ou sources épinglées modifiés depuis l'essai : nouvelle observation requise.");
  else if (iteration < p.iteration) {
    // A reopening or reset is crossed only when the observed revision had been reviewed and accepted:
    // the latest review of that generation must be passed, independent, on a revision covered by
    // this observation, and followed by an acceptance. Otherwise the reopening may concern the trial.
    const previous = contractAt(p, iteration);
    const covered = new Set([origin.code, ...s.proofs.filter(e => e.kind === "continuity" && e.origin === origin.id && e.contract === previous).map(e => e.code)]);
    acceptance = await acceptedGeneration(w, s, p, iteration, previous, origin, covered);
    if (!acceptance) blockers.push("Phase rouverte ou réinitialisée depuis l'essai sans acceptation retrouvée de cette phase, à cette itération et sur la révision observée : nouvelle observation requise.");
    // A restoration can erase a failed trial or a cancelled acceptance: no crossing after it.
    if (s.events.some(e => e.at > origin.at && (e.action === "restore" || e.action === "restore-verified")))
      blockers.push("État restauré depuis l'essai : des essais ou acceptations ont pu être annulés ; nouvelle observation requise.");
    // Reopen events carry no phase identity: any reason mentioning the trial or a defect is enough to refuse.
    const doubtful = s.events.filter(e => e.at > origin.at && e.action === "reopen" && REOPEN_DOUBT.test(e.request));
    if (doubtful.length) blockers.push(`Motif de réouverture mettant en cause l'essai ou le résultat (« ${doubtful.map(e => e.request).join(" » ; « ")} ») : nouvelle observation requise.`);
  }
  for (const id of p.depends_on) {
    const dependency = s.phases.find(q => q.id === id);
    if (dependency?.acceptance && dependency.acceptance.at > origin.at)
      blockers.push(`Dépendance « ${dependency.title} » acceptée de nouveau après l'essai : nouvelle observation requise.`);
  }
  if (s.brief && s.brief.at > origin.at) blockers.push("Brief réapprouvé après l'essai : les règles produit ont pu changer ; nouvelle observation requise.");
  if (!s.brief || s.brief.hash !== hash(await readFile(join(w, "PROJECT_BRIEF.md")))) blockers.push("Brief modifié : réconcilier avant de poursuivre.");
  for (const source of await inspectPhaseSources(w, p.sources))
    if (!source.current) blockers.push(`Référence épinglée modifiée ou absente : ${source.path}${source.error ? ` (${source.error})` : ""}.`);
  if (s.active !== p.id || p.mandate?.hash !== contract(p)) blockers.push("Lancer ou reprendre la phase avant d'examiner une continuité.");
  if (p.blocked) blockers.push(`Phase bloquée : ${p.blocked}`);
  const root = await codePath(w);
  const after = await tree(root), to = hash(after);
  if (to === origin.code) blockers.push("L'observation porte déjà sur la révision actuelle : rien à conserver. Si la tâche n'apparaît plus faite (critères changés, phase rouverte), une nouvelle observation est requise.");
  let before: Record<string, string> | null = null;
  try {
    before = await loadTree(w, origin.code);
    if (!before) blockers.push("Inventaire détaillé de la révision observée indisponible (observation antérieure au runtime 0.25.0) : les changements ne sont pas déterminables ; nouvelle observation requise.");
  } catch (error) { blockers.push(error instanceof Error ? error.message : String(error)); }
  const examined = before ? await examineChanges(root, before, after) : { changes: [] as Change[], signals: null };
  // The engine cannot judge relevance, but it refuses when the trial itself is about documentation.
  let summary = "";
  try { summary = String(JSON.parse(await readFile(await safeLocal(w, origin.ref), "utf8")).summary ?? ""); } catch {}
  const statement = [...tasks.map(id => p.tasks.find(t => t.id === id)?.title ?? ""), p.goal, p.validation, summary].join("\n").toLowerCase();
  const documents = examined.changes.filter(c => c.eligible);
  const named = documents.filter(c => {
    const name = baseName(c.path).toLowerCase(), stem = name.replace(/\.[^.]+$/, "");
    return statement.includes(name) || (stem.length >= 4 && statement.includes(stem));
  });
  if (documents.length && (named.length || DOC_TERMS.test(statement)))
    blockers.push(`L'essai, la tâche ou les critères portent sur la documentation${named.length ? ` (${named.map(c => c.path).join(", ")})` : ""} : nouvelle observation requise.`);
  const refused = examined.changes.filter(c => !c.eligible);
  for (const c of refused)
    blockers.push(`${c.path} (${c.change}, ${c.category})${c.reasons.length ? ` : ${c.reasons.join(" ; ")}` : ""}`);
  const latestReview = s.proofs.filter(e => e.phase === p.id && e.kind === "review").at(-1) ?? null;
  const titles = tasks.map(id => ({ id, title: p.tasks.find(t => t.id === id)?.title ?? id }));
  const required_controls = blockers.length
    ? [...new Set([
        ...refused.map(c => CONTROL[c.category as Exclude<Category, "documentation">]),
        `nouvelle observation humaine : ${titles.map(t => t.title).join(" ; ") || "essais concernés"}`,
      ])]
    : [];
  return {
    origin, tasks: titles, from_code: origin.code, to_code: to, after,
    criteria_iteration: iteration, acceptance_snapshot: acceptance, changes: examined.changes, signals: examined.signals, blockers, required_controls,
    events_since_origin: s.events.filter(e => e.at > origin.at && SENSITIVE_EVENTS.has(e.action)),
    latest_review: latestReview ? { id: latestReview.id, verdict: latestReview.verdict, passed: latestReview.passed, current: latestReview.code === to } : null,
  };
}

/**
 * Finds, in the state's own snapshots, the acceptance of this phase at the observed generation.
 * Events carry no phase identity, so an `accept` event alone is never sufficient. The accepting
 * review must still exist unchanged in the current state and cover the observed revision.
 */
async function acceptedGeneration(w: string, s: Workflow, p: Phase, iteration: number, previous: string, origin: Proof, covered: Set<string>): Promise<string | null> {
  const dir = join(w, ".starter/history");
  let names: string[] = [];
  try { names = (await readdir(dir)).filter(n => /^revision-\d+-[\w-]+\.json$/.test(n)).sort(); } catch { return null; }
  for (const name of names) {
    let snapshot: Workflow;
    try {
      if (!(await lstat(join(dir, name))).isFile()) continue;
      snapshot = JSON.parse(await readFile(join(dir, name), "utf8"));
    } catch { continue; }
    const q = snapshot.phases?.find(x => x.id === p.id);
    if (!q?.acceptance || q.iteration !== iteration || q.acceptance.hash !== previous || !(q.acceptance.at > origin.at)) continue;
    const review = (snapshot.proofs ?? []).filter(e => e.phase === p.id && e.kind === "review" && e.contract === previous).at(-1);
    if (!review?.passed || !review.independent || !covered.has(review.code)) continue;
    const current = s.proofs.find(e => e.id === review.id);
    if (!current || current.report_hash !== review.report_hash || current.code !== review.code || current.contract !== review.contract || !current.passed || !current.independent) continue;
    if (!(snapshot.proofs ?? []).some(e => e.id === origin.id && e.report_hash === origin.report_hash)) continue;
    // Lineage: the snapshot's history must be a prefix of the current one (no rolled-back timeline).
    const events = snapshot.events ?? [];
    if (!events.some(e => e.action === "accept") || events.length > s.events.length ||
        events.some((e, i) => JSON.stringify(e) !== JSON.stringify(s.events[i]))) continue;
    return `.starter/history/${name}`;
  }
  return null;
}

function refusal(analysis: Awaited<ReturnType<typeof analyseContinuity>>): string {
  return ["Continuité refusée ; l'essai d'origine reste historique et inchangé :",
    ...analysis.blockers.map(b => `- ${b}`),
    ...(analysis.events_since_origin.length ? ["Événements depuis l'essai :", ...analysis.events_since_origin.map(e => `- ${e.action} par ${e.by} : « ${e.request} »`)] : []),
    ...(analysis.required_controls.length ? ["Contrôles requis :", ...analysis.required_controls.map(c => `- ${c}`)] : [])].join("\n");
}

/** Read-only preview: the agent examines these exact paths before any record. */
export async function previewContinuity(w: string, phase: string, origin: string, tasks: string[] = []) {
  w = await canonicalPath(w);
  const before = await readFile(join(w, ".starter/workflow.json"));
  const s = await loadWorkflow(w), p = choose(s, phase);
  const analysis = await analyseContinuity(w, s, p, origin, tasks);
  const runtime = await embeddedRuntime(w);
  if (hash(before) !== hash(await readFile(join(w, ".starter/workflow.json")))) throw new Error("Suivi modifié pendant la lecture : relancer.");
  const { after: _after, origin: o, ...rest } = analysis;
  return {
    dry_run: true,
    recordable: !analysis.blockers.length && runtime.compatible,
    origin: { id: o.id, at: o.at, by: o.by, code: o.code },
    ...rest,
    embedded_runtime: runtime,
    declare_paths: analysis.changes.map(c => c.path),
    rule: "Examiner chaque chemin listé, puis relancer sans --dry-run avec --path pour chacun, --criteria, --reason, --checks et --limits. Le moteur ne juge pas l'effet métier.",
  };
}

export async function carryObservation(w: string, phase: string, options: {
  origin: string; tasks?: string[]; paths: string[]; criteria: string; reason: string; checks: string; limits: string;
  by: string; request: string;
}) {
  w = await canonicalPath(w);
  declaration(options.by, options.request);
  for (const [name, value] of Object.entries({ criteria: options.criteria, reason: options.reason, checks: options.checks, limits: options.limits }))
    if (!value?.trim()) throw new Error(`--${name} requis : critères concernés, justification, contrôles effectués et limites.`);
  const runtime = await embeddedRuntime(w);
  if (!runtime.compatible)
    throw new Error(`Runtime du workspace ${runtime.version ?? "illisible"} : il ne saurait pas relire une continuité (minimum ${CONTINUITY_RUNTIME_MIN}). Rien n'a été écrit ; conserver le comportement prudent (nouvelle observation) tant que le runtime n'est pas mis à niveau.`);
  return mutateWorkflow(w, "continuity", options.by, options.request, async s => {
    const p = choose(s, phase);
    const analysis = await analyseContinuity(w, s, p, options.origin, options.tasks ?? []);
    if (analysis.blockers.length) throw new Error(refusal(analysis));
    const actual = analysis.changes.map(c => c.path), declared = [...new Set(options.paths)];
    const missing = actual.filter(x => !declared.includes(x)), extra = declared.filter(x => !actual.includes(x));
    if (missing.length || extra.length)
      throw new Error(`Périmètre examiné différent des changements calculés.${missing.length ? ` Non déclarés : ${missing.join(", ")}.` : ""}${extra.length ? ` Inexistants : ${extra.join(", ")}.` : ""} Examiner le diff complet avec --dry-run.`);
    const checks = s.proofs.filter(e => e.phase === p.id && e.kind === "check" && e.passed && e.code === analysis.to_code && e.contract === contract(p)).map(e => e.id);
    const o = analysis.origin as Proof;
    const content = JSON.stringify({
      kind: "continuity",
      origin: { id: o.id, kind: o.kind, at: o.at, by: o.by, code: o.code, contract: o.contract, report: o.ref, report_hash: o.report_hash },
      compared: { from_code: analysis.from_code, to_code: analysis.to_code, criteria_unchanged_since_iteration: analysis.criteria_iteration,
        ...(analysis.acceptance_snapshot ? { acceptance_snapshot: analysis.acceptance_snapshot } : {}) },
      changes: analysis.changes,
      tasks: analysis.tasks,
      criteria: options.criteria,
      justification: options.reason,
      checks_declared: options.checks,
      checks_recorded_at_this_revision: checks,
      limits_declared: options.limits,
      events_since_origin: analysis.events_since_origin,
      latest_review: analysis.latest_review,
      engine: {
        classification_rules: CLASSIFICATION_RULES,
        signals: analysis.signals,
        verified: "inventaires et empreintes, diff complet, catégories de fichiers, signaux de publication détectables, critères, brief et références épinglées",
        not_verified: "effet métier des changements, réglages de publication extérieurs au dépôt (hébergeur, CMS, GitHub Pages), lectures dynamiques sans chemin explicite",
      },
    }, null, 2);
    const ref = `reports/phases/${p.id}/${randomUUID()}.json`;
    await writeFileAtomic(join(w, ref), content);
    const e: Proof = {
      id: `e-${s.next_id++}`, phase: p.id, tasks: analysis.tasks.map(t => t.id), kind: "continuity",
      contract: contract(p), code: analysis.to_code, ref, report_hash: hash(content), by: options.by,
      request: options.request, at: new Date().toISOString(), passed: true, verdict: "relevance_preserved",
      independent: false, origin: o.id,
    };
    s.proofs.push(e);
    return {
      proof: e.id, origin: o.id, tasks: e.tasks, report: ref, changes: actual,
      still_required: "contrôles automatiques pertinents sur cette révision, revue indépendante de ce changement et de cette continuité, puis acceptation",
      ...(analysis.latest_review && !analysis.latest_review.passed ? { latest_review_negative: analysis.latest_review } : {}),
    };
  });
}
