/**
 * Advisory, read-only checks of a product README against the files of its own repository.
 * It never edits files, records evidence or blocks a workflow command. Findings are signals to
 * examine: textual searches cannot prove an absence, and external links are not fetched.
 */
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ignored } from "./phase-workflow.js";
import { isPathInsideOrEqual } from "./text.js";

export type Finding = { severity: "error" | "warning" | "info"; code: string; message: string; line?: number };

const TEXT_LIMIT = 2 * 1024 * 1024;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|heic|woff2?|ttf|otf|eot|pdf|zip|gz|jar|mp[34]|webm|mov|wav|ogg)$/i;
const SHELL_BLOCKS = new Set(["", "bash", "sh", "shell", "zsh", "console", "terminal", "powershell", "ps1"]);
const ENV_EXAMPLES = [".env.example", ".env.sample", ".env.template", ".env.dist", "example.env"];
const INTERNAL: [RegExp, string, Finding["severity"]][] = [
  [/ai-workspace/i, "dossier de pilotage ai-workspace", "error"],
  [/\.starter\//, "chemin interne .starter/", "error"],
  [/workflow\.json|BACKLOG\.md/, "fichier de suivi interne", "error"],
  [/[$/]project-(start|next|phase|review|ship|plan|setup|discover|handoff)\b|\bproject-(start|next|phase|review|ship|plan|setup|discover|handoff)\b/, "skill de pilotage", "error"],
  [/Universal AI Project Starter/i, "nom du Starter", "error"],
  [/Project Architect|Art Direct/i, "outil de cadrage interne", "error"],
  [/\b[et]-\d+\b/, "identifiant interne de preuve ou de tâche", "warning"],
  [/\b(PA|AD)\b/, "sigle de pilotage possible (PA/AD)", "warning"],
];
const LICENSES: [RegExp, string][] = [
  [/\bAGPL/i, "AGPL"], [/\bLGPL/i, "LGPL"], [/\bGPL|GNU General Public/i, "GPL"], [/\bMIT\b/, "MIT"],
  [/\bApache\b/i, "Apache"], [/\bBSD\b/i, "BSD"], [/\bISC\b/, "ISC"], [/\bMPL\b|Mozilla Public/i, "MPL"],
  [/\bOFL\b|Open Font License/i, "OFL"], [/Unlicense/i, "Unlicense"], [/\bCC[- ]BY/i, "CC-BY"],
  [/aucune licence|tous droits (sont )?réservés|all rights reserved|no licen[cs]e|proprietary|propriétaire/i, "none"],
];
// A licence mentioned next to these words concerns a third-party element, unless the line names the product itself.
const SELF = /\b(this|ce|cette|le|la|notre|our)\s+(projet|project|package|paquet|dépôt|depot|repository|repo|plugin|extension|code|thème|theme|application|app|logiciel|software|site|bibliothèque|library)\b/i;
const THIRD_PARTY = /dépendanc|dependenc|police|font|librair|librar|bibliothèque|paquet|package|icône|icon|image|asset|tiers|third|logo|composant|component/i;
const CLAIMS: { pattern: RegExp; label: string; signals?: RegExp; requires?: RegExp }[] = [
  { pattern: /noindex/i, label: "balise noindex", requires: /noindex/i },
  { pattern: /aucun(e)? (traceur|cookie|donnée)|sans (enregistrement|traceur|cookie|compte)|no (tracking|cookies?)|not (stored|tracked)|n['’]est (ni )?(enregistrée|stockée|transmise|envoyée)/i,
    label: "absence de stockage, de transmission ou de traceur",
    signals: /localStorage|sessionStorage|indexedDB|document\.cookie|setcookie\(|gtag\(|googletagmanager|google-analytics|plausible|matomo|posthog|mixpanel|segment\.(com|io)|fetch\(|axios|XMLHttpRequest|sendBeacon|wp_remote_(post|get)/i },
  { pattern: /hors ligne|offline/i, label: "fonctionnement hors ligne" },
  { pattern: /non publié|pas publié|not (yet )?published|n['’]est pas publié/i, label: "statut de publication" },
  { pattern: /RGPD|GDPR|WCAG|RGAA|conforme|compliant/i, label: "conformité annoncée" },
];

// Operational topics whose disappearance must be confirmed, with their usual synonyms.
const TOPICS = [["sécurité", "security", "vulnérab", "vulnerab"], ["contribu"], ["support", "contact"], ["déploi", "deploy"],
  ["licen"], ["crédit", "credit", "attribution"], ["accessib"], ["donnée", "data", "privacy", "confidential"],
  ["limite", "limitation", "known issues", "problèmes connus"]];

type Line = { text: string; line: number };
type Parsed = { prose: Line[]; commands: Line[]; code: Line[]; headings: { text: string; line: number }[]; all: string };

function parse(markdown: string): Parsed {
  const prose: Line[] = [], commands: Line[] = [], code: Line[] = [], headings: { text: string; line: number }[] = [];
  let fence: { marker: string; shell: boolean } | null = null;
  markdown.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1, open = /^\s*(```+|~~~+)\s*([\w-]*)/.exec(text);
    if (fence) {
      if (open && open[1]!.startsWith(fence.marker) && !open[2]) fence = null;
      else (fence.shell ? commands : code).push({ text, line });
      return;
    }
    if (open) { fence = { marker: open[1]!, shell: SHELL_BLOCKS.has(open[2]!.toLowerCase()) }; return; }
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(text);
    if (heading) headings.push({ text: heading[1]!, line });
    prose.push({ text, line });
  });
  return { prose, commands, code, headings, all: markdown };
}

/** GitHub-style anchors, sufficient for headings written in French or English. */
export function anchorsOf(headings: { text: string }[]): Set<string> {
  const seen = new Map<string, number>(), out = new Set<string>();
  for (const { text } of headings) {
    const base = text.replace(/`|\*\*|__|\[([^\]]*)\]\([^)]*\)/g, "$1").trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    out.add(count ? `${base}-${count}` : base);
  }
  return out;
}

async function files(root: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  async function walk(dir: string): Promise<void> {
    for (const name of (await readdir(dir)).sort()) {
      if (ignored.has(name)) continue;
      const path = join(dir, name), stats = await lstat(path);
      if (stats.isSymbolicLink()) continue;
      const rel = relative(root, path).split(sep).join("/");
      if (stats.isDirectory()) { out.set(rel + "/", null); await walk(path); }
      else if (stats.isFile()) {
        let text: string | null = null;
        if (!BINARY.test(name) && stats.size <= TEXT_LIMIT) {
          const raw = await readFile(path);
          if (!raw.subarray(0, 8000).includes(0)) text = raw.toString("utf8");
        }
        out.set(rel, text);
      }
    }
  }
  await walk(root);
  return out;
}

function licenseFamilies(text: string): string[] {
  // \bGPL does not match inside AGPL or LGPL: each family is detected on its own.
  return LICENSES.filter(([pattern]) => pattern.test(text)).map(([, family]) => family);
}

/** A malformed percent-encoding is kept as written instead of interrupting the advisory check. */
function decode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function stripComment(command: string): string {
  return command.replace(/^\s*(\$|>|PS>)\s+/, "").replace(/\s+#.*$/, "").trim();
}

export async function checkReadme(rootPath: string, options: { path?: string; previous?: string | null } = {}) {
  const root = resolve(rootPath), path = options.path ?? "README.md";
  const target = resolve(root, path);
  if (!isPathInsideOrEqual(target, root) || target === root) throw new Error("README : chemin relatif au dépôt requis.");
  const markdown = await readFile(target, "utf8");
  const doc = parse(markdown), project = await files(root);
  const readmeRel = relative(root, target).split(sep).join("/"), base = dirname(target);
  const findings: Finding[] = [];
  const add = (severity: Finding["severity"], code: string, message: string, line?: number) =>
    findings.push({ severity, code, message, ...(line ? { line } : {}) });
  const exists = (rel: string) => project.has(rel) || project.has(rel.replace(/\/?$/, "/"));
  const others = [...project].filter(([file, text]) => file !== readmeRel && text !== null) as [string, string][];
  const searchProject = (pattern: RegExp) => others.filter(([file, text]) => !/\.(md|markdown)$/i.test(file) && pattern.test(text)).map(([file]) => file);

  // Links and images outside code blocks. External URLs are listed, never fetched.
  const anchors = anchorsOf(doc.headings), external = new Set<string>();
  const checked = { local_links: 0, anchors: 0, commands: 0, env_variables: 0, license_sources: 0 };
  for (const { text, line } of doc.prose) {
    const plain = text.replace(/`[^`]*`/g, "");
    const targets = [...plain.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)].map(m => m[1]!)
      .concat([...plain.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(\s|$)/g)].map(m => m[1]!))
      .concat([...plain.matchAll(/<(?:img|a|source)\b[^>]*\s(?:src|href)=["']([^"']+)["']/gi)].map(m => m[1]!));
    for (const href of targets) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { if (/^https?:/i.test(href)) external.add(href); continue; }
      if (href.startsWith("#")) {
        checked.anchors++;
        if (!anchors.has(decode(href.slice(1)).toLowerCase())) add("error", "ANCHOR_MISSING", `Ancre introuvable dans ce README : ${href}`, line);
        continue;
      }
      const clean = decode(href.split("#")[0]!.split("?")[0]!);
      if (!clean) continue;
      const resolved = clean.startsWith("/") ? resolve(root, "." + clean) : resolve(base, clean);
      const rel = relative(root, resolved).split(sep).join("/");
      if (!rel) continue;
      checked.local_links++;
      if (!isPathInsideOrEqual(resolved, root)) add("warning", "LINK_OUTSIDE", `Lien hors du dépôt, invisible pour les lecteurs publics : ${href}`, line);
      else if (!exists(rel)) add("error", "LINK_MISSING", `Lien local vers un fichier absent : ${href}`, line);
    }
  }

  // Commands from shell blocks, compared with the project's real configuration.
  const pkgText = project.get("package.json");
  let pkg: { scripts?: Record<string, string> } | null = null;
  try { pkg = pkgText ? JSON.parse(pkgText) : null; } catch { add("warning", "PACKAGE_JSON_UNREADABLE", "package.json illisible : commandes npm non vérifiées."); }
  const composerText = project.get("composer.json");
  let composer: { scripts?: Record<string, unknown> } | null = null;
  try { composer = composerText ? JSON.parse(composerText) : null; } catch {}
  const makefile = project.get("Makefile") ?? project.get("makefile") ?? null;
  const lock = { npm: exists("package-lock.json") || exists("npm-shrinkwrap.json"), pnpm: exists("pnpm-lock.yaml"), yarn: exists("yarn.lock"), bun: exists("bun.lockb") || exists("bun.lock") };
  const requiredFile: [RegExp, string[], string][] = [
    [/^composer\b/, ["composer.json"], "composer.json"], [/^(docker compose|docker-compose)\b/, ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"], "fichier compose"],
    [/^swift (build|test|run)\b/, ["Package.swift"], "Package.swift"], [/^flutter\b/, ["pubspec.yaml"], "pubspec.yaml"],
    [/^cargo\b/, ["Cargo.toml"], "Cargo.toml"], [/^go (run|build|test)\b/, ["go.mod"], "go.mod"], [/^php artisan\b/, ["artisan"], "artisan"],
    [/^bundle (exec|install)\b/, ["Gemfile"], "Gemfile"], [/^(poetry|uv)\s/, ["pyproject.toml"], "pyproject.toml"],
  ];
  const builtins = new Set(["install", "i", "ci", "add", "remove", "update", "upgrade", "dlx", "exec", "create", "init", "x", "outdated", "audit"]);
  const commandsSeen: string[] = [];
  for (const { text, line } of doc.commands) {
    for (const part of stripComment(text).split(/\s*(?:&&|\|\||;)\s*/)) {
      const command = part.trim();
      if (!command) continue;
      commandsSeen.push(command);
      checked.commands++;
      const js = /^(npm|pnpm|yarn|bun)(?:\s+(.*))?$/.exec(command);
      if (js) {
        const [, manager, rest = ""] = js, words = rest.split(/\s+/).filter(w => w && !w.startsWith("-"));
        if (!pkg && !pkgText) { add("error", "COMMAND_WITHOUT_PACKAGE", `Commande ${manager} sans package.json dans ce dépôt : ${command}`, line); continue; }
        const lockfiles = Object.entries(lock).filter(([, present]) => present).map(([name]) => name);
        if (lockfiles.length && !lockfiles.includes(manager!)) add("warning", "PACKAGE_MANAGER_MISMATCH", `${manager} cité alors que le verrou du dépôt correspond à ${lockfiles.join(", ")} : ${command}`, line);
        if (manager === "npm" && words[0] === "ci" && !lock.npm) add("error", "LOCKFILE_MISSING", "npm ci exige package-lock.json ou npm-shrinkwrap.json.", line);
        let script: string | undefined;
        if (["run", "run-script"].includes(words[0] ?? "")) script = words[1];
        else if (manager === "npm" && ["test", "t", "start", "stop", "restart"].includes(words[0] ?? "")) script = words[0] === "t" ? "test" : words[0];
        else if (manager !== "npm" && words[0] && !builtins.has(words[0])) script = words[0];
        const fallback = script === "start" && exists("server.js");
        if (script && !pkg?.scripts?.[script] && !fallback) add("error", "SCRIPT_MISSING", `Script absent de package.json : ${script} (${command})`, line);
        continue;
      }
      const make = /^make(?:\s+([\w.-]+))?/.exec(command);
      if (make) {
        if (makefile === null) add("error", "MAKEFILE_MISSING", `make cité sans Makefile : ${command}`, line);
        else if (make[1] && !new RegExp(`^${make[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "m").test(makefile)) add("error", "MAKE_TARGET_MISSING", `Cible make absente : ${make[1]}`, line);
        continue;
      }
      for (const [pattern, candidates, label] of requiredFile)
        if (pattern.test(command) && !candidates.some(exists)) add("error", "COMMAND_FILE_MISSING", `${command} exige ${label}, absent du dépôt.`, line);
      const composerScript = /^composer (?:run(?:-script)? )?([\w:-]+)/.exec(command);
      if (composerScript && composer && !builtins.has(composerScript[1]!) && !["require", "dump-autoload", "validate", "show"].includes(composerScript[1]!) && !composer.scripts?.[composerScript[1]!])
        add("error", "SCRIPT_MISSING", `Script absent de composer.json : ${composerScript[1]}`, line);
      // A copied example must exist; a script may be produced by an earlier step, so it is only a warning.
      const fileArgs: [string | undefined, Finding["severity"]][] = [
        [/^cp\s+(?:-\S+\s+)*(\S+)\s+\S+/.exec(command)?.[1], "error"],
        [/^pip3?\s+install\b.*?\s-r\s+(\S+)/.exec(command)?.[1], "error"],
        [/^(?:bash|sh|zsh)\s+(\S+\.sh|\S+\/\S+)/.exec(command)?.[1], "warning"],
        [/^(\.\/\S+)/.exec(command)?.[1], "warning"],
      ];
      for (const [arg, severity] of fileArgs) {
        if (!arg || arg.includes("$")) continue;
        const rel = relative(root, resolve(root, arg)).split(sep).join("/");
        if (isPathInsideOrEqual(resolve(root, arg), root) && !exists(rel)) add(severity, "COMMAND_FILE_MISSING", `Fichier cité par une commande introuvable : ${arg}`, line);
      }
    }
  }

  // Configuration examples and secrets.
  const example = ENV_EXAMPLES.find(exists);
  const codeText = [...doc.commands, ...doc.code].map(l => l.text).join("\n") + "\n" + (markdown.match(/`[^`\n]+`/g) ?? []).join("\n");
  if (example) {
    const keys = (project.get(example) ?? "").split(/\r?\n/).map(l => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l)?.[1]).filter(Boolean) as string[];
    checked.env_variables = keys.length;
    const missing = keys.filter(key => !markdown.includes(key));
    if (missing.length) add("warning", "ENV_UNDOCUMENTED", `Variables de ${example} absentes du README : ${missing.join(", ")}`);
    if (!markdown.includes(example)) add("warning", "ENV_EXAMPLE_NOT_REFERENCED", `${example} existe mais n'est pas cité.`);
  }
  for (const name of ENV_EXAMPLES) if (markdown.includes(name) && !exists(name)) add("error", "ENV_EXAMPLE_MISSING", `${name} cité mais absent du dépôt.`);
  for (const name of new Set(codeText.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) ?? []))
    if (!others.some(([, text]) => text.includes(name))) add("warning", "ENV_UNKNOWN", `Variable citée introuvable dans le projet : ${name}`);
  for (const { text, line } of [...doc.commands, ...doc.code]) {
    const assignment = /^\s*(?:export\s+)?([A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*=\s*["']?([^"'\s#]+)/.exec(text);
    if (assignment && !/^(<.*>|x+|\*+|\.\.\.|changeme|change_me|your[_-].*|votre[_-].*|example|exemple|\$\{?.*|à_remplir|todo|null|none|false|true)$/i.test(assignment[3]!))
      add("error", "POSSIBLE_SECRET", `Valeur possiblement réelle pour ${assignment[1]} : utiliser un exemple sans secret.`, line);
  }

  // Internal workflow vocabulary must not reach a product README.
  for (const [pattern, label, severity] of INTERNAL)
    for (const { text, line } of markdown.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 })))
      if (pattern.test(text)) { add(severity, "INTERNAL_TERM", `Terme de pilotage interne (${label}) : retirer ou reformuler pour le public.`, line); break; }

  // Claims copied from another product are checked against textual signals, not proved.
  for (const claim of CLAIMS) {
    const hit = doc.prose.find(l => claim.pattern.test(l.text));
    if (!hit) continue;
    if (claim.requires) {
      const where = searchProject(claim.requires);
      if (!where.length) add("error", "CLAIM_UNSUPPORTED", `Affirmation sans trace dans le dépôt (${claim.label}) : vérifier ce produit avant de l'écrire.`, hit.line);
      else add("info", "CLAIM_TO_CONFIRM", `${claim.label} présente dans ${where.slice(0, 3).join(", ")} : confirmer sur la cible réellement servie.`, hit.line);
    } else if (claim.signals) {
      const where = searchProject(claim.signals);
      if (where.length) add("warning", "CLAIM_CONTRADICTED", `Affirmation (${claim.label}) à vérifier : signaux trouvés dans ${where.slice(0, 5).join(", ")}.`, hit.line);
      else add("info", "CLAIM_TO_CONFIRM", `Aucun signal contraire trouvé pour « ${claim.label} » ; une recherche textuelle ne prouve pas l'absence.`, hit.line);
    } else add("info", "CLAIM_TO_CONFIRM", `Affirmation à vérifier sur ce produit (${claim.label}).`, hit.line);
  }

  // Licences: the README must reflect the repository's real licence and third-party notices.
  const declared: { source: string; families: string[] }[] = [];
  for (const [file, text] of project) {
    if (text === null || file.includes("/")) continue;
    if (/^(licen[cs]e|copying|unlicense)(\.|$)/i.test(file)) declared.push({ source: file, families: licenseFamilies(text.slice(0, 3000)) });
  }
  const pkgLicense = (pkg as { license?: string } | null)?.license ?? (composer as { license?: string | string[] } | null)?.license;
  if (pkgLicense) declared.push({ source: pkg && (pkg as { license?: string }).license ? "package.json" : "composer.json", families: licenseFamilies(String(pkgLicense).replace(/UNLICENSED/i, "proprietary")) });
  for (const [file, text] of project)
    if (text && /\.(php|css)$/.test(file) && !file.includes("/") && /^[ \t/*#]*(Plugin|Theme) Name:/m.test(text)) {
      const header = /^[ \t/*#]*License:\s*(.+)$/m.exec(text)?.[1];
      if (header) declared.push({ source: `${file} (en-tête WordPress)`, families: licenseFamilies(header) });
    }
  checked.license_sources = declared.length;
  const claims = doc.prose.filter(l => /licen[cs]e|droits|rights|copyright/i.test(l.text) && (SELF.test(l.text) || !THIRD_PARTY.test(l.text)));
  const claimed = new Set(claims.flatMap(l => licenseFamilies(l.text)));
  const real = new Set(declared.flatMap(d => d.families));
  if (new Set(declared.map(d => d.families.join("+")).filter(Boolean)).size > 1)
    add("warning", "LICENSE_SOURCES_DISAGREE", `Déclarations de licence divergentes : ${declared.map(d => `${d.source}=${d.families.join("+") || "?"}`).join(", ")}`);
  if (claimed.size) {
    const unsupported = [...claimed].filter(f => f !== "none" && !real.has(f));
    if (unsupported.length) add("error", real.size ? "LICENSE_MISMATCH" : "LICENSE_UNSUPPORTED",
      `Licence annoncée (${unsupported.join(", ")}) ${real.size ? `différente de ${[...real].join(", ")}` : "sans fichier ni métadonnée de licence"} : ne pas inventer ni recopier une licence.`, claims[0]?.line);
    if (claimed.has("none") && [...real].some(f => f !== "none")) add("error", "LICENSE_MISMATCH", `Le README annonce l'absence de licence alors que le dépôt déclare ${[...real].join(", ")}.`, claims[0]?.line);
  } else if ([...real].some(f => f !== "none")) add("warning", "LICENSE_NOT_MENTIONED", `Licence du dépôt (${[...real].join(", ")}) non mentionnée.`);
  for (const [file] of project)
    if (file.includes("/") && /(^|\/)(OFL|LICEN[CS]E|NOTICE|COPYING)[^/]*$/i.test(file) && !/(^|\/)(vendor|third_party)\//.test(file) && !markdown.includes(file) && !markdown.includes(file.split("/").at(-1)!))
      add("warning", "ATTRIBUTION_NOT_REFERENCED", `Licence ou notice tierce non référencée : ${file}`);

  // Conservative rewrite: report what the previous version said and the new one no longer does.
  if (options.previous != null) {
    const old = parse(options.previous);
    const urls = (text: string) => new Set(text.match(/https?:\/\/[^\s)>"'\]]+/g) ?? []);
    for (const url of urls(options.previous)) if (!markdown.includes(url)) add("warning", "INFO_REMOVED", `Lien retiré : ${url}`);
    const previousCommands = old.commands.flatMap(l => stripComment(l.text).split(/\s*(?:&&|\|\||;)\s*/)).map(c => c.trim()).filter(Boolean);
    for (const command of new Set(previousCommands))
      if (!commandsSeen.includes(command) && !markdown.includes(command)) add("warning", "INFO_REMOVED", `Commande retirée : ${command}`);
    for (const name of new Set(options.previous.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) ?? []))
      if (!markdown.includes(name)) add("warning", "INFO_REMOVED", `Variable retirée : ${name}`);
    const lower = markdown.toLowerCase();
    for (const h of old.headings) {
      const topic = TOPICS.find(words => words.some(w => h.text.toLowerCase().includes(w)));
      if (topic && !topic.some(w => lower.includes(w))) add("warning", "INFO_REMOVED", `Rubrique utile retirée sans équivalent : ${h.text}`);
      else if (!doc.headings.some(n => n.text === h.text)) add("info", "HEADING_CHANGED", `Intitulé modifié ou retiré : ${h.text}`);
    }
  }
  for (const url of external) add("info", "EXTERNAL_LINK_UNVERIFIED", `Lien externe non vérifié (aucun accès réseau) : ${url}`);

  const count = (s: Finding["severity"]) => findings.filter(f => f.severity === s).length;
  return {
    readme: readmeRel, advisory: true, checked, errors: count("error"), warnings: count("warning"), infos: count("info"), findings,
    limits: "L'absence d'avertissement ne prouve pas que le README est exact ou complet. Contrôle textuel consultatif : commandes non exécutées, liens externes non ouverts, affirmations (données, sécurité, conformité) et licences repérées par motifs. Il ne remplace ni la relecture ni un essai réel, et ne bloque aucune commande.",
  };
}
