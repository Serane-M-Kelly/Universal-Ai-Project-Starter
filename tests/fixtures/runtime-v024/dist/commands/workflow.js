import { contextView, reportView, contextSources } from "../lib/context-output.js";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { readFile, mkdir, cp, readdir, rm } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import YAML from "yaml";
import { STATE, VIEW, applyPlan, beginPhase, choose, codePath, contract, declaration, ensure, hash, initializeWorkflow, loadWorkflow, mutateWorkflow, phaseStatus, recordProof, sourceHash, status, tree, changedFiles, } from "../lib/phase-workflow.js";
import { canonicalPath, pathExists, writeFileAtomic } from "../lib/fs-safe.js";
import { parseFrontmatter, stringifyFrontmatter } from "../lib/frontmatter.js";
import { packageRoot } from "../lib/paths.js";
import { createWorkspace, findGitRoot, detectExistingCommands, } from "../lib/workspace.js";
import { loadProfile } from "../lib/profiles.js";
import { installSkill } from "../lib/skills.js";
import { inspectWorkspace } from "../lib/doctor.js";
import { synchronizeModels } from "../lib/workflow-models.js";
import { addNativeAdapter } from "../lib/native-switch.js";
import { CLAUDE_ROLE_DEFAULTS, NATIVE_ADAPTERS, guidanceFor, isNativeAdapter, nativeAdapters, } from "../lib/native-adapters.js";
import { requireCurrentSources } from "../lib/phase-sources.js";
export const PUBLIC_SKILLS = [
    "project-start",
    "project-discover",
    "project-handoff",
    "project-setup",
    "project-plan",
    "project-next",
    "project-phase",
    "project-review",
    "project-ship",
];
const runtimeFiles = [
    "dist",
    "core",
    "profiles",
    "adapters",
    "node_modules",
    "package.json",
];
export async function installRuntime(w) {
    const destination = join(w, ".starter/runtime");
    ensure(!(await pathExists(destination)), "Runtime déjà présent : ne pas écraser une installation existante.");
    for (const f of runtimeFiles)
        await cp(join(packageRoot, f), join(destination, f), { recursive: true });
    await writeFileAtomic(join(w, ".starter/run.mjs"), "import './runtime/dist/index.js';\n");
}
export async function initUnified(target, options) {
    const w = await canonicalPath(join(resolve(target), "ai-workspace"));
    ensure(!(await pathExists(w)), "Le workspace existe déjà. Utiliser start ou une nouvelle destination.");
    const code = options.code
        ? await canonicalPath(options.code)
        : join(resolve(target), "app");
    const repository = options.code ? (findGitRoot(code) ?? code) : code;
    ensure(relative(repository, w).startsWith("..") &&
        relative(w, code).startsWith(".."), "Placer le workspace hors du dépôt applicatif.");
    if (options.code)
        await tree(code); // Preflight before destination mutation, including build symlinks.
    else
        await mkdir(code, { recursive: true });
    try {
        const profile = await loadProfile(options.profile ?? "generic");
        await createWorkspace({
            workspacePath: w,
            codeRoot: code,
            repositoryRoot: repository,
            name: options.name,
            entryMode: options.code ? "existing" : "brief",
            profile,
            commands: options.code ? await detectExistingCommands(code) : {},
        });
        const c = YAML.parse(await readFile(join(w, "project.yaml"), "utf8"));
        c.project.owner = options.owner;
        c.starter_version = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version;
        // Existing governance enums remain intact. The execution contract defines manual Git by default.
        await writeFileAtomic(join(w, "project.yaml"), YAML.stringify(c));
        await writeFileAtomic(join(w, "PROJECT_BRIEF.md"), stringifyFrontmatter({
            schema_version: 1,
            brief_version: 1,
            status: "draft",
            approved_by: null,
            approved_at: null,
            supersedes: null,
        }, `# ${options.name}\n\n## Résultat attendu\nÀ préciser depuis les sources et les décisions existantes.\n\n## Périmètre et exclusions\nÀ préciser.\n\n## Critères et questions ouvertes\nÀ préciser.\n`));
        await writeFileAtomic(join(w, "PROJECT_STATE.md"), stringifyFrontmatter({
            schema_version: 1,
            state_version: 1,
            stage: "intake",
            status: "active",
            current_phase: null,
            current_task: null,
            brief_version: null,
            plan_version: null,
            last_verified_at: null,
            updated_at: new Date().toISOString(),
        }, "# Reprise\n\nLe suivi courant est retourné par `node .starter/run.mjs workflow status`.\nNe pas maintenir une seconde liste d’avancement ici.\n"));
        await writeFileAtomic(join(w, ".gitignore"), ".DS_Store\n.env\n.env.*\n.starter/write.lock/\n.starter/runtime/node_modules/\n");
        await initializeWorkflow(w);
        await cp(join(packageRoot, "core/contracts/phase-workflow.md"), join(w, ".starter/WORKFLOW.md"));
        // `--adapter codex`, `--adapter claude-code` or `--adapter codex,claude-code`; the first is the initial one.
        const adapters = (options.adapter ?? "codex").split(",").map((x) => x.trim()).filter(Boolean);
        ensure(adapters.length > 0 && adapters.every(isNativeAdapter) && new Set(adapters).size === adapters.length, "Adaptateur inconnu. Valeurs : codex, claude-code ou codex,claude-code.");
        // Native skills are copies of the canonical source, generated for every listed assistant.
        for (const id of adapters)
            await writeFileAtomic(join(w, NATIVE_ADAPTERS[id].instructions), guidanceFor(id));
        const claude = adapters.includes("claude-code");
        // Claude values are chosen separately; OpenAI identifiers and efforts are never transposed.
        const role = (model, effort, name) => {
            const defaults = CLAUDE_ROLE_DEFAULTS[name];
            return {
                model,
                effort,
                ...(claude && defaults ? { claude_model: defaults.claude_model } : {}),
                ...(claude && defaults?.claude_effort ? { claude_effort: defaults.claude_effort } : {}),
            };
        };
        await writeFileAtomic(join(w, ".starter/models.json"), JSON.stringify({
            schema_version: 1,
            adapter: adapters[0],
            adapters,
            coordinator: {
                model: "gpt-6.1-sol",
                effort: "medium",
                ...(claude ? { claude_model: null, claude_effort: null } : {}),
            },
            roles: {
                planner: role("gpt-6.1-sol", "high", "planner"),
                builder: role("gpt-6.1-sol", "medium", "builder"),
                reviewer: role("gpt-6.1-sol", "high", "reviewer"),
                implementer: role("gpt-6.1-sol", "medium", "implementer"),
                reader: role("gpt-6-luna", "medium", "reader"),
            },
            fallbacks: {},
        }, null, 2));
        for (const skill of PUBLIC_SKILLS)
            await installSkill(w, skill);
        await synchronizeModels(w);
        await installRuntime(w);
        return w;
    }
    catch (error) {
        // Keep a failed workspace for diagnosis; never delete application code or an existing workspace.
        await writeFileAtomic(join(w, ".starter/INSTALL-INCOMPLETE.txt"), "Installation interrompue. Conserver ce dossier ; reprendre vers une destination distincte après diagnostic.\n").catch(() => { });
        throw error;
    }
}
const textOptions = [
    "name",
    "owner",
    "code-root",
    "profile",
    "adapter",
    "workspace",
    "by",
    "request",
    "file",
    "phase",
    "summary",
    "report",
    "verdict",
    "reason",
    "agent",
    "message",
    "source",
    "target",
    "timeout",
    "snapshot",
    "stream",
    "offset",
    "limit",
];
export async function runWorkflow(args) {
    const options = Object.fromEntries(textOptions.map((k) => [k, { type: "string" }]));
    for (const b of [
        "allow-active-change",
        "independent",
        "json",
        "dry-run",
        "help",
        "compact",
        "raw",
        "metrics",
    ])
        options[b] = { type: "boolean", default: false };
    options.task = { type: "string", multiple: true };
    options.path = { type: "string", multiple: true };
    const split = args.indexOf("--");
    const command = split < 0 ? [] : args.slice(split + 1);
    const parsed = parseArgs({
        args: split < 0 ? args : args.slice(0, split),
        allowPositionals: true,
        strict: true,
        options,
    });
    const v = parsed.values;
    const [action = "status", arg] = parsed.positionals;
    if (v.help || action === "help") {
        console.log(await readFile(join(packageRoot, "core/contracts/workflow-cli.md"), "utf8"));
        return 0;
    }
    const w = await canonicalPath(resolve(v.workspace ?? process.cwd()));
    const by = v.by ?? "", request = v.request ?? "";
    let result;
    if (action === "init") {
        ensure(arg, "Destination requise.");
        result = {
            workspace: await initUnified(arg, {
                name: v.name ?? "Mon produit",
                owner: v.owner ?? "Kelly",
                ...(v["code-root"] ? { code: v["code-root"] } : {}),
                ...(v.profile ? { profile: v.profile } : {}),
                ...(v.adapter ? { adapter: v.adapter } : {}),
            }),
            next: "Ouvrir ai-workspace avec l'assistant installé (codex ou claude) puis project-start.",
        };
    }
    else if (action === "migrate") {
        ensure(v.source && v.target, "Migration : --source ancien-workspace --target nouveau-dossier.");
        result = await migrateWorkflow(v.source, v.target, v["dry-run"], v.owner ?? "Kelly");
    }
    else if (action === "sources") {
        result = await contextSources(w, v.path ?? []);
    }
    else if (action === "report") {
        ensure(arg, "Identifiant de preuve requis.");
        ensure(!(v.raw && v.stream), "Choisir --raw ou --stream.");
        ensure(v.stream || (v.offset === undefined && v.limit === undefined), "--offset et --limit exigent --stream.");
        const view = await reportView(w, arg, {
            raw: v.raw,
            ...(v.stream ? { stream: v.stream } : {}),
            ...(v.offset !== undefined ? { offset: Number(v.offset) } : {}),
            ...(v.limit !== undefined ? { limit: Number(v.limit) } : {}),
        });
        result = v.metrics ? view : view.output;
    }
    else if (action === "status" || action === "next" || action === "context") {
        const id = action === "context" ? (arg ?? v.phase ?? (await loadWorkflow(w)).active ?? undefined) : undefined;
        if (v.compact) {
            const view = await contextView(w, id);
            result = v.metrics ? view : view.output;
        }
        else
            result = await status(w, id);
    }
    else if (action === "plan") {
        ensure(v.file, "Plan JSON requis (--file).");
        result = await applyPlan(w, JSON.parse(await readFile(resolve(v.file), "utf8")), by, request, v["allow-active-change"]);
    }
    else if (action === "begin") {
        ensure(arg ?? v.phase, "Phase requise.");
        const d = await inspectWorkspace(w);
        ensure(d.verdict !== "BLOCKED", d.items
            .filter((x) => x.severity === "blocked")
            .map((x) => x.message)
            .join("\n"));
        result = await beginPhase(w, arg ?? v.phase, by, request);
    }
    else if (["check", "observe", "review"].includes(action)) {
        const kind = action === "check"
            ? "check"
            : action === "observe"
                ? "observation"
                : "review";
        const proof = await recordProof(w, arg ?? v.phase, by, request, kind, v.task ?? [], {
            ...(command.length ? { command } : {}),
            ...(v.report ? { report: v.report } : {}),
            ...(v.summary ? { summary: v.summary } : {}),
            ...(v.verdict ? { verdict: v.verdict } : {}),
            independent: v.independent,
            ...(v.timeout ? { timeout: Number(v.timeout) } : {}),
        });
        result = proof;
        console.log(JSON.stringify(result, null, 2));
        return proof.passed ? 0 : 2;
    }
    else if (action === "models-sync")
        result = await synchronizeModels(w);
    else if (action === "adapter-add") {
        ensure(arg, "Adaptateur requis : codex ou claude-code.");
        result = await addNativeAdapter(w, arg, v["dry-run"]);
    }
    else if (action === "environment") {
        const version = (program) => {
            const run = spawnSync(program, ["--version"], { encoding: "utf8" });
            return run.status === 0 ? run.stdout.trim() : null;
        };
        const models = JSON.parse(await readFile(join(w, ".starter/models.json"), "utf8"));
        // Environment variables that silently replace the configured Claude models or efforts.
        const overrides = Object.fromEntries([
            "ANTHROPIC_MODEL",
            "ANTHROPIC_DEFAULT_MODEL",
            "ANTHROPIC_DEFAULT_OPUS_MODEL",
            "ANTHROPIC_DEFAULT_SONNET_MODEL",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL",
            "ANTHROPIC_DEFAULT_FABLE_MODEL",
            "CLAUDE_CODE_SUBAGENT_MODEL",
            "CLAUDE_CODE_SUBAGENT_MODEL_FORCE",
            "CLAUDE_CODE_EFFORT_LEVEL",
        ]
            .filter((name) => process.env[name])
            .map((name) => [name, process.env[name]]));
        result = {
            node: process.version,
            codex: version("codex"),
            claude: version("claude"),
            adapters: nativeAdapters(models),
            models,
            claude_overrides: overrides,
            availability: "Non vérifiée : les fichiers ne prouvent pas l’accès aux modèles. Contrôler /model et un vrai appel dans la session utilisée.",
        };
    }
    else if (action === "prepare-commit")
        result = await prepareCommit(w, arg ?? v.phase, v.path ?? [], v.message ?? "");
    else if (action === "verify-commit")
        result = await verifyCommit(w);
    else if (action === "relocate") {
        declaration(by, request);
        ensure(v["code-root"], "Nouveau chemin de code requis.");
        const newCode = await canonicalPath(v["code-root"]);
        await tree(newCode);
        const oldConfig = await readFile(join(w, "project.yaml"), "utf8"), c = YAML.parse(oldConfig);
        ensure(relative(newCode, w).startsWith("..") &&
            relative(w, newCode).startsWith(".."), "Espaces imbriqués interdits.");
        await writeFileAtomic(join(w, ".starter/history", `project-paths-${Date.now()}.yaml`), oldConfig);
        c.paths.code_root = relative(w, newCode);
        c.paths.repository_root = relative(w, findGitRoot(newCode) ?? newCode);
        await writeFileAtomic(join(w, "project.yaml"), YAML.stringify(c));
        result = await synchronizeModels(w);
    }
    else if (action === "restore-state") {
        declaration(by, request);
        ensure(v.snapshot, "Snapshot relatif interne requis.");
        ensure(!(await pathExists(join(w, ".starter/write.lock"))), "Verrou présent : résoudre avant restauration.");
        const path = await canonicalPath(resolve(w, v.snapshot));
        ensure(path.startsWith(join(w, ".starter/history") + "/"), "Choisir un snapshot conservé dans .starter/history.");
        const raw = await readFile(path, "utf8"), candidate = JSON.parse(raw);
        ensure(candidate.schema_version === 3, "Snapshot incompatible.");
        // Validate in an isolated directory so a malformed snapshot never replaces current state.
        const temp = join(w, ".starter", `restore-validation-${Date.now()}`);
        await mkdir(join(temp, ".starter"), { recursive: true });
        try {
            await writeFileAtomic(join(temp, STATE), raw);
            await loadWorkflow(temp);
        }
        finally {
            await rm(temp, { recursive: true, force: true });
        }
        const old = await readFile(join(w, STATE));
        await writeFileAtomic(join(w, ".starter/history", `before-restore-${Date.now()}.txt`), old.toString());
        candidate.revision = Math.max(candidate.revision, Date.now());
        candidate.active = null;
        for (const p of candidate.phases) {
            p.iteration++;
            p.mandate = null;
            p.acceptance = null;
        }
        candidate.events.push({
            at: new Date().toISOString(),
            action: "restore",
            by,
            request,
        });
        await writeFileAtomic(join(w, STATE), JSON.stringify(candidate, null, 2));
        result = await mutateWorkflow(w, "restore-verified", by, request, async () => ({ restored: true, mandates_revoked: true }), true);
    }
    else if (action === "recover-lock") {
        const lock = join(w, ".starter/write.lock"), owner = JSON.parse(await readFile(join(lock, "owner.json"), "utf8"));
        declaration(by, request);
        let alive = true;
        try {
            process.kill(owner.pid, 0);
        }
        catch (e) {
            if (e.code === "ESRCH")
                alive = false;
        }
        ensure(!alive, "Le processus propriétaire existe encore ; ne pas retirer le verrou.");
        await writeFileAtomic(join(w, ".starter/history", `lock-${Date.now()}.json`), JSON.stringify({ owner, by, request }));
        await rm(lock, { recursive: true });
        result = { recovered: true };
    }
    else {
        declaration(by, request);
        result = await mutateWorkflow(w, action, by, request, async (s) => {
            if (action === "brief-approve") {
                const path = join(w, "PROJECT_BRIEF.md"), raw = await readFile(path, "utf8"), parsed = parseFrontmatter(raw);
                ensure(parsed.body.trim() &&
                    !/À préciser|\[à compléter\]/i.test(parsed.body), "Compléter le brief avant approbation.");
                const old = s.brief;
                if (old?.hash === hash(raw))
                    return { approved: true, reused: true };
                parsed.attributes.status = "approved";
                parsed.attributes.approved_by = by;
                parsed.attributes.approved_at = new Date().toISOString().slice(0, 10);
                const content = stringifyFrontmatter(parsed.attributes, parsed.body);
                if (old)
                    await writeFileAtomic(join(w, ".starter/history", `brief-${Date.now()}.md`), await readFile(path, "utf8"));
                await writeFileAtomic(path, content);
                s.brief = {
                    by,
                    request,
                    at: new Date().toISOString(),
                    hash: hash(content),
                };
                if (old && old.hash !== s.brief.hash) {
                    for (const p of s.phases) {
                        p.iteration++;
                        p.mandate = null;
                        p.acceptance = null;
                    }
                    s.active = null;
                }
                return { approved: true };
            }
            if (action === "setup-record") {
                ensure(v.report, "Rapport de setup requis.");
                const content = await readFile(resolve(v.report), "utf8");
                ensure(content.trim(), "Rapport vide.");
                const ref = `reports/setup-${Date.now()}.md`;
                await writeFileAtomic(join(w, ref), content);
                s.setup = { ref, hash: hash(content) };
                return { setup: ref };
            }
            if (action === "repair-view") {
                const old = await readFile(join(w, VIEW), "utf8").catch(() => null);
                if (old !== null)
                    await writeFileAtomic(join(w, ".starter/history", `manual-view-${Date.now()}.md`), old);
                return { repaired: true, plan_changed: false };
            }
            const p = choose(s, arg ?? v.phase);
            if (action === "accept") {
                await requireCurrentSources(w, p.sources);
                ensure(s.active === p.id, "La phase doit être active.");
                ensure(s.brief?.hash === hash(await readFile(join(w, "PROJECT_BRIEF.md"))), "Brief modifié : réconcilier avant acceptation.");
                const st = await phaseStatus(w, s, p, await sourceHash(w));
                ensure(st.state === "ready_for_acceptance", "Il manque des preuves actuelles, une revue indépendante ou une résolution de blocage.");
                p.acceptance = {
                    by,
                    request,
                    at: new Date().toISOString(),
                    hash: contract(p),
                };
                s.active = null;
                return { accepted: p.id };
            }
            if (action === "reopen") {
                const affected = new Set([p.id]);
                let grow = true;
                while (grow) {
                    grow = false;
                    for (const q of s.phases)
                        if (!affected.has(q.id) &&
                            q.depends_on.some((d) => affected.has(d))) {
                            affected.add(q.id);
                            grow = true;
                        }
                }
                for (const q of s.phases)
                    if (affected.has(q.id)) {
                        q.iteration++;
                        q.acceptance = null;
                        q.mandate = null;
                        q.blocked = null;
                        if (s.active === q.id)
                            s.active = null;
                    }
                return { reopened: [...affected] };
            }
            if (action === "block") {
                ensure(v.reason, "Motif et condition de reprise requis.");
                p.blocked = v.reason;
                return { blocked: p.id };
            }
            if (action === "unblock") {
                ensure(v.reason, "Preuve ou raison de résolution requise.");
                p.blocked = null;
                return { unblocked: p.id };
            }
            if (action === "task-add") {
                ensure(s.active === p.id && p.mandate?.hash === contract(p), "Tâche technique à ajouter dans une phase active autorisée.");
                ensure(v.summary && v.reason, "Description et justification requises.");
                p.tasks.push({
                    id: `t-${s.next_id++}`,
                    title: v.summary,
                    human: false,
                });
                p.mandate.hash = contract(p);
                return { added: p.tasks.at(-1), mandate_preserved: true };
            }
            throw new Error(`Commande workflow inconnue : ${action}`);
        }, action === "repair-view");
    }
    console.log(JSON.stringify(result, null, 2));
    return 0;
}
function quote(x) {
    return "'" + x.replaceAll("'", "'\\''") + "'";
}
async function git(root, args) {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    ensure(r.status === 0, r.stderr || "Commande Git impossible.");
    return r.stdout.trim();
}
async function prepareCommit(w, id, files, message) {
    const s = await loadWorkflow(w), p = id ? choose(s, id) : s.phases.filter((p) => p.acceptance).at(-1);
    ensure(p?.acceptance, "Accepter la phase avant de préparer son commit.");
    ensure(files.length && message.trim(), "Fournir --path pour chaque fichier voulu et --message.");
    const root = await codePath(w);
    ensure((await git(root, ["rev-parse", "--show-toplevel"])) === root, "Préparer le commit depuis la racine exacte du dépôt applicatif.");
    const staged = await git(root, ["diff", "--cached", "--name-only"]);
    ensure(!staged, "Index Git déjà rempli : examiner les changements existants avant préparation.");
    const changed = await changedFiles(root), snapshot = await tree(root), code = hash(snapshot);
    for (const f of files) {
        ensure(!f.startsWith("-") &&
            !f.startsWith(":") &&
            !f.includes("\n") &&
            !f.includes("\r") &&
            !f.split(/[\\/]/).includes("..") &&
            !resolve(root, f).startsWith(root + "/../"), "Chemin de fichier invalide.");
        ensure(changed.includes(f), `Fichier non modifié : ${f}`);
        ensure(!p.baseline.includes(f), `Changement préexistant sur ${f} : isoler les modifications avant de préparer un commit automatique.`);
    }
    // An accepted milestone alone cannot justify a commit on a later source revision.
    await requireCurrentSources(w, p.sources);
    const latest = s.proofs
        .filter((e) => e.phase === p.id && e.kind === "review")
        .at(-1);
    ensure(latest?.passed &&
        latest.independent &&
        latest.code === code &&
        latest.contract === contract(p) &&
        latest.report_hash === hash(await readFile(join(w, latest.ref))), "Revue actuelle requise avant le commit ; rouvrir et vérifier les changements.");
    const manifest = {
        phase: p.id,
        code_hash: code,
        files: [...new Set(files)],
        message,
        head: await git(root, ["rev-parse", "--verify", "HEAD"]).catch(() => null),
        snapshot,
    };
    const ref = ".starter/prepared-commit.json";
    await writeFileAtomic(join(w, ref), JSON.stringify(manifest, null, 2));
    const commands = [
        `git -C ${quote(root)} add -- ${files.map(quote).join(" ")}`,
        `git -C ${quote(root)} diff --cached`,
        `git -C ${quote(root)} commit -m ${quote(message)}`,
    ];
    await writeFileAtomic(join(w, "reports/COMMIT.md"), `# Commit à exécuter manuellement\n\nVérifier le diff avant commit. Ne pas modifier le code entre cette préparation et le commit.\n\n\`\`\`bash\n${commands.join("\n")}\n\`\`\`\n\nPuis : node .starter/run.mjs workflow verify-commit\n`);
    return { commands, executed: false, report: "reports/COMMIT.md" };
}
async function verifyCommit(w) {
    const manifest = JSON.parse(await readFile(join(w, ".starter/prepared-commit.json"), "utf8")), root = await codePath(w);
    ensure(manifest.code_hash === (await sourceHash(w)), "Le code a changé depuis la préparation.");
    const head = await git(root, ["rev-parse", "HEAD"]);
    ensure(head !== manifest.head, "Aucun nouveau commit constaté.");
    const parents = (await git(root, ["rev-list", "--parents", "-n", "1", "HEAD"]))
        .split(" ")
        .slice(1);
    ensure(manifest.head
        ? parents.length === 1 && parents[0] === manifest.head
        : parents.length === 0, "Historique différent du commit préparé.");
    const files = (await git(root, [
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--name-only",
        "-r",
        "-z",
        "HEAD",
    ]))
        .split("\0")
        .filter(Boolean)
        .sort();
    ensure(JSON.stringify(files) === JSON.stringify([...manifest.files].sort()), "Les fichiers du commit diffèrent de la sélection préparée.");
    for (const f of files) {
        const r = spawnSync("git", ["show", `HEAD:${f}`], { cwd: root });
        if (manifest.snapshot[f])
            ensure(r.status === 0 && hash(r.stdout) === manifest.snapshot[f], `Contenu committé différent : ${f}`);
        else
            ensure(r.status !== 0, `Suppression non constatée : ${f}`);
    }
    await writeFileAtomic(join(w, "reports/COMMIT-VERIFIED.json"), JSON.stringify({ head, files, verified_at: new Date().toISOString() }, null, 2));
    return {
        committed: true,
        head,
        pushed: "non vérifié",
        deployed: "non vérifié",
    };
}
async function migrateWorkflow(source, target, dry, owner) {
    const src = await canonicalPath(source);
    const isNext = await pathExists(join(src, ".starter/state.json"));
    ensure(isNext || (await pathExists(join(src, "project.yaml"))), "Source de migration inconnue.");
    ensure(!(await pathExists(join(src, STATE))), "Source déjà au format v3 : conserver son workspace, pas une nouvelle migration.");
    let name, code, profile = "generic", previousCommands, plan = [];
    if (isNext) {
        const s = JSON.parse(await readFile(join(src, ".starter/state.json"), "utf8"));
        name = s.project.name;
        code = resolve(src, s.project.code_root);
        plan = (s.plan ?? []).map((p, i) => ({
            id: `p-legacy-${i + 1}`,
            title: p.title,
            goal: p.goal,
            validation: p.validation ?? "",
            excludes: "",
            optional: p.optional ?? false,
            agent: p.agent ?? "builder",
            depends_on: (p.depends ?? []).map((id) => `p-legacy-${s.plan.findIndex((x) => x.id === id) + 1}`),
            tasks: (p.tasks ?? []).map((t, j) => ({
                id: `t-legacy-${i + 1}-${j + 1}`,
                title: t.title ?? t.text,
                human: t.human ?? false,
            })),
        }));
    }
    else {
        const c = YAML.parse(await readFile(join(src, "project.yaml"), "utf8"));
        name = c.project.name;
        profile = c.profile.id;
        previousCommands = c.commands;
        code = resolve(src, c.paths.code_root);
        const b = parseFrontmatter(await readFile(join(src, "taches/BACKLOG.md"), "utf8")).attributes;
        ensure(b.schema_version === 2, "Migrer le backlog historique v1 vers v2 avec l’ancien CLI avant cette conversion.");
        plan = b.phases.map((p, i) => ({
            id: `p-legacy-${i + 1}`,
            title: p.title,
            goal: p.goal,
            validation: "À préciser après examen des anciens critères.",
            depends_on: [],
            tasks: b.items
                .filter((x) => x.phase === p.id)
                .flatMap((x) => x.tasks.map((t) => ({
                id: `t-legacy-${t.id}`,
                title: t.title,
                human: t.category === "human",
            }))),
        }));
        for (const [i, p] of b.phases.entries()) {
            plan[i].depends_on = [
                ...new Set(b.items
                    .filter((x) => x.phase === p.id)
                    .flatMap((x) => x.depends_on)
                    .map((id) => b.items.find((x) => x.id === id)?.phase)
                    .filter((id) => id && id !== p.id)
                    .map((id) => `p-legacy-${b.phases.findIndex((x) => x.id === id) + 1}`)),
            ];
        }
    }
    const summary = {
        source: src,
        target: resolve(target),
        name,
        code,
        phases: plan.length,
        policy: "Archive complète de la source ; aucune ancienne coche, autorisation, revue ou acceptation n’est convertie en preuve actuelle. Examiner les critères et dépendances avant lancement.",
    };
    if (dry)
        return summary;
    const w = await initUnified(target, { name, owner, code, profile });
    if (previousCommands) {
        const path = join(w, "project.yaml"), config = YAML.parse(await readFile(path, "utf8"));
        config.commands = previousCommands;
        await writeFileAtomic(path, YAML.stringify(config));
    }
    const archive = join(w, ".starter/legacy-source");
    await cp(src, archive, {
        recursive: true,
        dereference: false,
        filter: (p) => !["node_modules", ".git", "write.lock"].includes(p.split(/[\\/]/).at(-1)),
    });
    const entries = await treeArchive(archive);
    await writeFileAtomic(join(w, ".starter/legacy-manifest.json"), JSON.stringify(entries, null, 2));
    // The archive stays historical and is not scanned by the current workflow.
    const brief = join(src, isNext ? "BRIEF.md" : "PROJECT_BRIEF.md");
    if (await pathExists(brief)) {
        const raw = await readFile(brief, "utf8");
        const body = isNext ? raw : parseFrontmatter(raw).body;
        await writeFileAtomic(join(w, "PROJECT_BRIEF.md"), stringifyFrontmatter({
            schema_version: 1,
            brief_version: 1,
            status: "draft",
            approved_by: null,
            approved_at: null,
            supersedes: null,
        }, body));
    }
    await applyPlan(w, plan, "migration", "Conversion structurelle, aucune validation produit transférée.", false, true);
    await writeFileAtomic(join(w, "reports/MIGRATION.json"), JSON.stringify(summary, null, 2));
    return { ...summary, workspace: w };
}
async function treeArchive(root) {
    const out = {};
    async function walk(p) {
        for (const d of await readdir(p, { withFileTypes: true })) {
            const path = join(p, d.name);
            ensure(!d.isSymbolicLink(), "Lien symbolique dans l’ancien workspace : archive à examiner.");
            if (d.isDirectory())
                await walk(path);
            else
                out[relative(root, path)] = hash(await readFile(path));
        }
    }
    await walk(root);
    return out;
}
//# sourceMappingURL=workflow.js.map