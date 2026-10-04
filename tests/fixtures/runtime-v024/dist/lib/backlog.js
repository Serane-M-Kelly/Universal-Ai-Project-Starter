import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parseFrontmatter, replaceBody, stringifyFrontmatter } from "./frontmatter.js";
import { canonicalPath, pathExists, writeFileAtomic, writeNewFile } from "./fs-safe.js";
import { schemasRoot } from "./paths.js";
import { hashText } from "./content-hash.js";
import { isPathInsideOrEqual } from "./text.js";
export const BACKLOG_RELATIVE_PATH = join("taches", "BACKLOG.md");
export const VIEW_BEGIN = "<!-- backlog:roadmap début · bloc généré · ne pas éditer à la main · régénérer avec `ai-project backlog sync-view` -->";
export const VIEW_END = "<!-- backlog:roadmap fin -->";
/** Statuts d'unité valant « approuvée ou postérieure ». */
export const WORK_APPROVED_OR_LATER = new Set([
    "approved",
    "in_progress",
    "ready_for_review",
    "ready_for_acceptance",
    "accepted",
]);
/** Statuts d'unité encore actifs : le résultat ne peut pas être déclaré acquis. */
export const WORK_ACTIVE = new Set([
    "approved",
    "in_progress",
    "ready_for_review",
    "ready_for_acceptance",
]);
const CATEGORY_LABELS = {
    product: "produit",
    ux: "ux",
    tech: "technique",
    architecture: "architecture",
    data: "données",
    security: "sécurité",
    quality: "qualité",
    docs: "doc",
    delivery: "livraison",
    human: "humain",
};
export function categoryLabel(category) {
    return CATEGORY_LABELS[category] ?? category;
}
// ---------------------------------------------------------------------------
// États dérivés
// ---------------------------------------------------------------------------
/** Preuves actuellement valables d'une tâche. La preuve courante n'est jamais stockée. */
export function validEvidence(task) {
    return task.evidence_log.filter((entry) => entry.state === "valid");
}
/**
 * L'état d'une tâche est entièrement dérivé : une preuve valable vaut `done`,
 * son invalidation ramène automatiquement la tâche à sa disposition éditoriale.
 */
export function deriveTaskState(task) {
    if (validEvidence(task).length > 0)
        return "done";
    if (task.disposition === "blocked")
        return "blocked";
    if (task.disposition === "dropped")
        return "dropped";
    return "todo";
}
export function itemProgress(item) {
    let requiredTotal = 0;
    let requiredDone = 0;
    let optionalTotal = 0;
    let optionalDone = 0;
    for (const task of item.tasks) {
        const done = deriveTaskState(task) === "done";
        if (task.required) {
            requiredTotal += 1;
            if (done)
                requiredDone += 1;
        }
        else {
            optionalTotal += 1;
            if (done)
                optionalDone += 1;
        }
    }
    return { requiredTotal, requiredDone, optionalTotal, optionalDone };
}
export function itemHasAcceptance(item) {
    return Boolean(item.outcome_accepted_by) && Boolean(item.outcome_accepted_at);
}
/** Unités réalisant au moins une tâche de cet élément, ou encore rattachées par un lien historique. */
export function workUnitsForItem(item, units) {
    const taskIds = new Set(item.tasks.map((task) => task.id));
    return units
        .filter((unit) => unit.realizes.some((taskId) => taskIds.has(taskId)) ||
        item.legacy_work_items.includes(unit.id))
        .sort((left, right) => left.id.localeCompare(right.id));
}
/**
 * L'état d'un résultat est dérivé de ses tâches, de ses unités et de l'acceptation
 * humaine. Seuls `stage`, `disposition` et l'acceptation sont stockés.
 */
export function deriveItemState(item, units) {
    if (item.disposition === "retired")
        return "retired";
    if (item.disposition === "deferred")
        return "deferred";
    const progress = itemProgress(item);
    const allRequiredDone = progress.requiredTotal >= 1 && progress.requiredDone === progress.requiredTotal;
    const linked = workUnitsForItem(item, units);
    const anyWorkActive = linked.some((unit) => WORK_ACTIVE.has(unit.status));
    // Un résultat dont une unité reste active n'est jamais présenté comme acquis :
    // le Doctor refuse cet état, la vue ne doit pas l'afficher.
    if (allRequiredDone && itemHasAcceptance(item) && !anyWorkActive)
        return "done";
    if (allRequiredDone)
        return "built";
    const anyTaskDone = item.tasks.some((task) => deriveTaskState(task) === "done");
    const anyWorkEngaged = linked.some((unit) => WORK_APPROVED_OR_LATER.has(unit.status));
    if (anyTaskDone || anyWorkEngaged)
        return "in_progress";
    return item.stage;
}
export function phaseProgress(phase, items, units) {
    const active = items.filter((item) => item.phase === phase.id && item.disposition === "active");
    let requiredItems = 0;
    let requiredItemsDone = 0;
    let requiredTasks = 0;
    let requiredTasksDone = 0;
    for (const item of active) {
        if (item.required) {
            requiredItems += 1;
            if (deriveItemState(item, units) === "done")
                requiredItemsDone += 1;
        }
        const progress = itemProgress(item);
        requiredTasks += progress.requiredTotal;
        requiredTasksDone += progress.requiredDone;
    }
    return { requiredItems, requiredItemsDone, requiredTasks, requiredTasksDone };
}
/**
 * `optional` est évalué avant `complete` : une phase ne contenant que des résultats
 * facultatifs ne doit jamais s'afficher terminée à 0/0.
 */
export function derivePhaseState(phase, items, units) {
    if (phase.disposition === "retired")
        return "retired";
    const active = items.filter((item) => item.phase === phase.id && item.disposition === "active");
    if (active.length === 0)
        return "empty";
    const progress = phaseProgress(phase, items, units);
    if (progress.requiredItems === 0)
        return "optional";
    if (progress.requiredItemsDone === progress.requiredItems)
        return "complete";
    const anyTaskDone = active.some((item) => item.tasks.some((task) => deriveTaskState(task) === "done"));
    const anyWorkActive = active.some((item) => workUnitsForItem(item, units).some((unit) => WORK_ACTIVE.has(unit.status)));
    if (anyTaskDone || anyWorkActive)
        return "in_progress";
    return "not_started";
}
export function orderedPhaseItems(phase, items) {
    return items
        .filter((item) => item.phase === phase.id)
        .sort((left, right) => left.order - right.order);
}
// ---------------------------------------------------------------------------
// Rendu de la vue
// ---------------------------------------------------------------------------
function plural(count, singular, pluralForm) {
    return count > 1 ? pluralForm : singular;
}
function itemStatusSegments(item, state, progress) {
    const segments = [`\`${state}\``, item.priority];
    if (item.depends_on.length > 0) {
        segments.push(`après ${item.depends_on.join(", ")}`);
    }
    // Un résultat sans tâche n'est pas encore détaillé : ni construction, ni verdict de résultat.
    const detailed = item.tasks.length > 0;
    if (detailed) {
        if (progress.requiredTotal === 0) {
            segments.push("sans tâche obligatoire");
        }
        else {
            let construction = `construction ${progress.requiredDone}/${progress.requiredTotal}`;
            if (progress.optionalTotal > 0) {
                construction += ` (+${progress.optionalTotal} ${plural(progress.optionalTotal, "optionnelle", "optionnelles")})`;
            }
            segments.push(construction);
        }
    }
    if (item.disposition === "active" && (detailed || itemHasAcceptance(item))) {
        segments.push(itemHasAcceptance(item)
            ? `résultat accepté le ${String(item.outcome_accepted_at)} par ${String(item.outcome_accepted_by)}`
            : "résultat non démontré");
    }
    if (!item.required)
        segments.push("non obligatoire");
    if (item.derived_from.length > 0) {
        segments.push(`issu de ${item.derived_from.join(", ")}`);
    }
    return segments;
}
function renderTaskLine(task) {
    const state = deriveTaskState(task);
    const box = state === "done" ? "x" : " ";
    const segments = [categoryLabel(task.category)];
    if (!task.required)
        segments.push("optionnelle");
    if (state === "blocked") {
        segments.push(`bloquée : ${task.blocked_reason ?? ""}`);
    }
    else if (state === "dropped") {
        segments.push(`abandonnée : ${task.dropped_reason ?? ""}`);
    }
    if (task.origin === "discovered") {
        segments.push(`découverte dans ${task.source_work ?? "?"}`);
    }
    const current = validEvidence(task)[0];
    if (current)
        segments.push(`preuve : ${current.ref}`);
    return `- [${box}] \`${task.id}\` ${task.title} · ${segments.join(" · ")}`;
}
/** Un lien historique est converti dès qu'une unité réalise une tâche de ce résultat. */
function legacyLinkIsConverted(item, workId, units) {
    const unit = units.find((entry) => entry.id === workId);
    if (!unit)
        return false;
    const taskIds = new Set(item.tasks.map((task) => task.id));
    return unit.realizes.some((taskId) => taskIds.has(taskId));
}
function unconvertedLegacyLinks(item, units) {
    return item.legacy_work_items.filter((workId) => !legacyLinkIsConverted(item, workId, units));
}
function renderLegacyLine(item, units) {
    const pending = unconvertedLegacyLinks(item, units);
    const converted = item.legacy_work_items.filter((workId) => !pending.includes(workId));
    if (pending.length > 0) {
        const links = pending.map((workId) => `\`${workId}\` → à reporter dans \`${workId}.realizes\``);
        return `⚠ ${plural(pending.length, "Lien historique", "Liens historiques")} à convertir : ${links.join(" ; ")}.`;
    }
    if (converted.length > 0) {
        const links = converted.map((workId) => `\`${workId}\``).join(", ");
        return `Lien historique converti : ${links} — \`legacy_work_items\` peut être retiré.`;
    }
    return null;
}
function renderUnitLines(units) {
    return units.map((unit) => `Unités associées : \`${unit.id}\` — ${unit.title} — \`${unit.status}\``);
}
/**
 * Rendu déterministe et pur : la vue est une fonction du frontmatter du backlog et
 * du frontmatter des unités. Le Doctor la régénère et la compare octet à octet.
 */
export function renderRoadmap(backlog, units) {
    const lines = [];
    const items = backlog.items;
    const activeItems = items.filter((item) => item.disposition === "active");
    const requiredActive = activeItems.filter((item) => item.required);
    const acceptedRequired = requiredActive.filter((item) => deriveItemState(item, units) === "done");
    let requiredTasks = 0;
    let requiredTasksDone = 0;
    for (const item of activeItems) {
        const progress = itemProgress(item);
        requiredTasks += progress.requiredTotal;
        requiredTasksDone += progress.requiredDone;
    }
    const detailed = activeItems.filter((item) => item.tasks.length > 0);
    const undetailed = activeItems.length - detailed.length;
    const deferred = items.filter((item) => item.disposition === "deferred").length;
    const retired = items.filter((item) => item.disposition === "retired").length;
    const legacyItems = items.filter((item) => item.legacy_work_items.length > 0);
    lines.push("## Roadmap", "");
    lines.push(`**Construction : ${requiredTasksDone}/${requiredTasks} tâches obligatoires terminées.**`);
    lines.push(`**Résultats obligatoires : ${acceptedRequired.length}/${requiredActive.length} acceptés.**`);
    lines.push(`**Détail : ${detailed.length} ${plural(detailed.length, "résultat détaillé", "résultats détaillés")}, ` +
        `${undetailed} ${plural(undetailed, "encore sans tâche", "encore sans tâche")}.**`);
    if (deferred > 0 || retired > 0) {
        lines.push(`${deferred} ${plural(deferred, "résultat reporté", "résultats reportés")}, ${retired} ${plural(retired, "retiré", "retirés")}.`);
    }
    const pendingByItem = legacyItems
        .map((item) => ({ item, pending: unconvertedLegacyLinks(item, units) }))
        .filter((entry) => entry.pending.length > 0);
    if (pendingByItem.length > 0) {
        const total = pendingByItem.reduce((sum, entry) => sum + entry.pending.length, 0);
        const detail = pendingByItem
            .map((entry) => `\`${entry.item.id}\` ← ${entry.pending.map((id) => `\`${id}\``).join(", ")}`)
            .join(" ; ");
        lines.push(`⚠ ${total} ${plural(total, "lien historique", "liens historiques")} à convertir : ${detail}.`);
    }
    for (const phase of backlog.phases) {
        const state = derivePhaseState(phase, items, units);
        const progress = phaseProgress(phase, items, units);
        const headerSegments = [
            `\`${state}\``,
            `résultats ${progress.requiredItemsDone}/${progress.requiredItems}`,
        ];
        headerSegments.push(progress.requiredTasks === 0
            ? "non détaillée"
            : `construction ${progress.requiredTasksDone}/${progress.requiredTasks}`);
        lines.push("");
        lines.push(`### ${phase.id} — ${phase.title} — ${headerSegments.join(" · ")}`);
        lines.push(`> ${phase.goal}`);
        let compactOpen = false;
        for (const item of orderedPhaseItems(phase, items)) {
            const state = deriveItemState(item, units);
            const progress = itemProgress(item);
            const segments = itemStatusSegments(item, state, progress);
            const itemUnits = workUnitsForItem(item, units);
            if (item.tasks.length === 0) {
                // D-1 : le titre du résultat reste toujours visible, même en forme compacte.
                if (!compactOpen)
                    lines.push("");
                compactOpen = true;
                lines.push(`- \`${item.id}\` — ${item.title} — ${segments.join(" · ")}`);
                const legacyLine = renderLegacyLine(item, units);
                if (legacyLine)
                    lines.push(`  ${legacyLine}`);
                for (const unitLine of renderUnitLines(itemUnits)) {
                    lines.push(`  ${unitLine}`);
                }
                continue;
            }
            compactOpen = false;
            lines.push("");
            lines.push(`#### ${item.id} — ${item.title}`);
            lines.push(segments.join(" · "));
            const legacyLine = renderLegacyLine(item, units);
            if (legacyLine)
                lines.push(legacyLine);
            lines.push("");
            for (const task of item.tasks) {
                lines.push(renderTaskLine(task));
            }
            const unitLines = renderUnitLines(itemUnits);
            if (unitLines.length > 0) {
                lines.push("");
                lines.push(...unitLines);
            }
        }
    }
    return lines.join("\n");
}
// ---------------------------------------------------------------------------
// Bloc généré
// ---------------------------------------------------------------------------
function countOccurrences(haystack, needle) {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        count += 1;
        index = haystack.indexOf(needle, index + needle.length);
    }
    return count;
}
/**
 * Analyse la structure des marqueurs avant toute écriture. Seuls deux cas sont
 * exploitables : aucun marqueur (insertion contrôlée), ou exactement un début
 * suivi d'une fin. Toute autre structure est ambiguë et interdit d'écrire :
 * un `indexOf` naïf y supprimerait du récit rédigé à la main.
 */
export function analyzeMarkers(body) {
    const begins = countOccurrences(body, VIEW_BEGIN);
    const ends = countOccurrences(body, VIEW_END);
    if (begins === 0 && ends === 0)
        return { kind: "absent", begin: -1, end: -1 };
    if (begins !== 1 || ends !== 1) {
        throw new MarkerLayoutError(`Structure de marqueurs ambiguë dans taches/BACKLOG.md : ${begins} marqueur(s) de début et ` +
            `${ends} de fin (exactement un de chaque est attendu). Aucun octet n'a été modifié ; ` +
            "retirer les marqueurs surnuméraires du récit avant de régénérer la vue.");
    }
    const begin = body.indexOf(VIEW_BEGIN);
    const end = body.indexOf(VIEW_END);
    if (end < begin + VIEW_BEGIN.length) {
        throw new MarkerLayoutError("Le marqueur de fin de la roadmap précède son marqueur de début dans taches/BACKLOG.md. " +
            "Aucun octet n'a été modifié ; rétablir l'ordre des marqueurs avant de régénérer la vue.");
    }
    return { kind: "single", begin, end };
}
export class MarkerLayoutError extends Error {
}
/**
 * Un marqueur complet dans un champ rendu dans la vue rendrait le bloc généré
 * indissociable du récit : refusé avant toute écriture.
 */
export function findMarkerInFields(backlog) {
    const carries = (value) => typeof value === "string" && (value.includes(VIEW_BEGIN) || value.includes(VIEW_END));
    for (const phase of backlog.phases) {
        if (carries(phase.title))
            return `phases[${phase.id}].title`;
        if (carries(phase.goal))
            return `phases[${phase.id}].goal`;
    }
    for (const item of backlog.items) {
        if (carries(item.title))
            return `items[${item.id}].title`;
        if (carries(item.outcome_accepted_by))
            return `items[${item.id}].outcome_accepted_by`;
        for (const task of item.tasks) {
            if (carries(task.title))
                return `items[${item.id}].tasks[${task.id}].title`;
            if (carries(task.blocked_reason))
                return `${task.id}.blocked_reason`;
            if (carries(task.dropped_reason))
                return `${task.id}.dropped_reason`;
            for (const entry of task.evidence_log) {
                if (carries(entry.ref))
                    return `${entry.id}.ref`;
                if (carries(entry.state_reason))
                    return `${entry.id}.state_reason`;
            }
        }
    }
    return null;
}
export function extractRoadmapBlock(body) {
    const begin = body.indexOf(VIEW_BEGIN);
    if (begin === -1)
        return null;
    const contentStart = begin + VIEW_BEGIN.length;
    const end = body.indexOf(VIEW_END, contentStart);
    if (end === -1)
        return null;
    return body.slice(contentStart, end);
}
function blockFor(rendered) {
    return `${VIEW_BEGIN}\n\n${rendered}\n\n${VIEW_END}`;
}
/**
 * Remplace le bloc généré sans toucher un seul octet du récit rédigé à la main.
 * Refuse (sans rien écrire) toute structure de marqueurs ambiguë.
 */
export function replaceRoadmapBlock(body, rendered) {
    const layout = analyzeMarkers(body);
    if (layout.kind === "single") {
        return (body.slice(0, layout.begin) + blockFor(rendered) + body.slice(layout.end + VIEW_END.length));
    }
    // Bloc absent : insérer une paire avant la première section de niveau 2, sinon à la fin.
    const match = body.match(/^## /m);
    const block = `${blockFor(rendered)}\n\n`;
    if (match?.index !== undefined) {
        return body.slice(0, match.index) + block + body.slice(match.index);
    }
    return `${body.replace(/\s*$/, "")}\n\n${block}`;
}
export function roadmapBlockIsCurrent(body, rendered) {
    const current = extractRoadmapBlock(body);
    if (current === null)
        return false;
    return current === `\n\n${rendered}\n\n`;
}
export async function readBacklogFile(workspace) {
    const path = join(workspace, BACKLOG_RELATIVE_PATH);
    if (!(await pathExists(path)))
        return null;
    const parsed = parseFrontmatter(await readFile(path, "utf8"));
    const schemaVersion = typeof parsed.attributes.schema_version === "number" ? parsed.attributes.schema_version : 0;
    return {
        path,
        schemaVersion,
        attributes: parsed.attributes,
        body: parsed.body,
        raw: parsed.raw,
        newline: parsed.newline,
    };
}
async function assertManagedPathInsideWorkspace(workspace, path, label) {
    const canonicalWorkspace = await canonicalPath(workspace);
    const canonical = await canonicalPath(path);
    if (!isPathInsideOrEqual(canonical, canonicalWorkspace)) {
        throw new Error(`${label} résout hors du workspace (${canonical}). Aucun fichier n'a été modifié ; ` +
            "retirer le lien symbolique ou choisir un chemin interne au workspace.");
    }
    if ((await pathExists(path)) && (await lstat(path)).isSymbolicLink()) {
        throw new Error(`${label} est un lien symbolique. Les fichiers gérés par le backlog doivent être ` +
            "des fichiers ordinaires situés dans le workspace.");
    }
}
function summarizeWorkUnit(id, path, attributes, body) {
    const realizes = Array.isArray(attributes.realizes)
        ? attributes.realizes.filter((value) => typeof value === "string")
        : [];
    return {
        id,
        path,
        title: typeof attributes.title === "string" && attributes.title.trim().length > 0
            ? attributes.title
            : id,
        status: typeof attributes.status === "string" ? attributes.status : "unknown",
        realizes,
        crossCutting: attributes.cross_cutting === true,
        body,
    };
}
/** Recense les unités de travail avec les seuls champs nécessaires au rendu et aux invariants. */
export async function loadWorkUnits(workspace) {
    const directory = join(workspace, "taches");
    if (!(await pathExists(directory)))
        return [];
    const entries = await readdir(directory);
    const units = [];
    for (const entry of entries.sort()) {
        const match = entry.match(/^(WORK-[0-9]{3,})\.md$/);
        if (!match?.[1])
            continue;
        const path = join(directory, entry);
        if ((await lstat(path)).isSymbolicLink())
            continue;
        let attributes;
        let body;
        try {
            const parsed = parseFrontmatter(await readFile(path, "utf8"));
            attributes = parsed.attributes;
            body = parsed.body;
        }
        catch {
            // L'unité est présente mais illisible : `listUnreadableWorkUnits` la signale.
            continue;
        }
        units.push(summarizeWorkUnit(match[1], path, attributes, body));
    }
    return units;
}
let backlogSchemaCache = null;
async function backlogSchema() {
    backlogSchemaCache ??= JSON.parse(await readFile(join(schemasRoot, "backlog.schema.json"), "utf8"));
    return backlogSchemaCache;
}
let legacySchemaCache = null;
async function legacyBacklogSchema() {
    legacySchemaCache ??= JSON.parse(await readFile(join(schemasRoot, "backlog.v1.schema.json"), "utf8"));
    return legacySchemaCache;
}
let workItemSchemaCache = null;
async function workItemSchema() {
    workItemSchemaCache ??= JSON.parse(await readFile(join(schemasRoot, "work-item.schema.json"), "utf8"));
    return workItemSchemaCache;
}
/** Valide un frontmatter contre un schéma et lève un message lisible. */
function assertSchema(schema, attributes, label) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    if (ajv.validate(schema, attributes))
        return;
    const details = (ajv.errors ?? [])
        .slice(0, 5)
        .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
        .join(" ; ");
    throw new Error(`${label} ne respecte pas son schéma : ${details}`);
}
/**
 * Charge les unités pour une commande mutante ou son mode `--check`.
 * Contrairement au recensement tolérant du Doctor, aucune unité illisible,
 * invalide ou redirigée hors du workspace ne peut être ignorée silencieusement.
 */
async function loadValidatedWorkUnits(workspace) {
    const directory = join(workspace, "taches");
    if (!(await pathExists(directory)))
        return [];
    await assertManagedPathInsideWorkspace(workspace, directory, "Le dossier taches/");
    const units = [];
    for (const entry of (await readdir(directory)).sort()) {
        const match = entry.match(/^(WORK-[0-9]{3,})\.md$/);
        if (!match?.[1])
            continue;
        const path = join(directory, entry);
        await assertManagedPathInsideWorkspace(workspace, path, entry);
        let parsed;
        try {
            parsed = parseFrontmatter(await readFile(path, "utf8"));
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`${match[1]} est présent mais son frontmatter est illisible : ${reason}`);
        }
        assertSchema(await workItemSchema(), parsed.attributes, match[1]);
        if (parsed.attributes.id !== match[1]) {
            throw new Error(`${entry} déclare l'identifiant ${String(parsed.attributes.id)} : le nom du fichier et ` +
                "le champ id doivent être identiques.");
        }
        units.push(summarizeWorkUnit(match[1], path, parsed.attributes, parsed.body));
    }
    return units;
}
/**
 * Garde-fou de sortie : quelle que soit la source d'une chaîne rendue — champs du
 * backlog, titre d'unité, identité d'acceptation, ou tout champ ajouté plus tard —
 * le rendu produit ne doit jamais contenir de marqueur de bloc.
 */
export function assertRenderedMarkersAbsent(rendered) {
    if (rendered.includes(VIEW_BEGIN) || rendered.includes(VIEW_END)) {
        throw new MarkerLayoutError("Le rendu produit contient un marqueur de bloc généré : une valeur rendue dans la vue " +
            "(titre, objectif, tâche, preuve, titre d'unité ou identité d'acceptation) recopie ce marqueur. " +
            "Aucun octet n'a été modifié ; retirer le marqueur de cette valeur avant de régénérer la vue.");
    }
}
/**
 * Préambule partagé par `sync-view` et `sync-view --check` : lecture, schéma,
 * marqueurs du document, unités, état d'intégrité, rendu et corps attendu.
 * Aucune écriture. Les deux routes produisent donc exactement les mêmes
 * diagnostics — jamais une erreur JavaScript opaque d'un côté seulement.
 */
export async function prepareBacklogSync(workspacePath) {
    const workspace = await canonicalPath(workspacePath);
    const loaded = await readBacklogFile(workspace);
    if (!loaded) {
        throw new Error("Aucun taches/BACKLOG.md dans ce workspace.");
    }
    if (loaded.schemaVersion !== 2) {
        throw new Error(`taches/BACKLOG.md est en schema_version ${loaded.schemaVersion} : la vue générée n'existe qu'en v2. ` +
            "Utiliser d'abord « ai-project backlog migrate ».");
    }
    await assertManagedPathInsideWorkspace(workspace, loaded.path, "taches/BACKLOG.md");
    assertSchema(await backlogSchema(), loaded.attributes, "taches/BACKLOG.md");
    const backlog = loaded.attributes;
    const layout = analyzeMarkers(loaded.body);
    const markerField = findMarkerInFields(backlog);
    if (markerField) {
        throw new MarkerLayoutError(`${markerField} contient un marqueur de bloc généré. Aucun octet n'a été modifié ; ` +
            "retirer ce marqueur du champ avant de régénérer la vue.");
    }
    const units = await loadValidatedWorkUnits(workspace);
    const rendered = renderRoadmap(backlog, units);
    assertRenderedMarkersAbsent(rendered);
    const nextBody = replaceRoadmapBlock(loaded.body, rendered);
    // Dernier filet : le corps final doit porter exactement une paire, dans l'ordre.
    analyzeMarkers(nextBody);
    return {
        workspace,
        loaded,
        backlog,
        units,
        rendered,
        nextBody,
        changed: nextBody !== loaded.body,
        inserted: layout.kind === "absent",
    };
}
/**
 * Régénère le bloc de roadmap.
 *
 * Rien n'est écrit tant que le document n'a pas passé, dans l'ordre : validation
 * de schéma, structure des marqueurs, absence de marqueur dans les champs et dans
 * le rendu produit. Le frontmatter et le récit sont réécrits octet à octet, et
 * rien n'est réécrit lorsque le rendu est déjà identique.
 */
export async function syncBacklogView(workspacePath) {
    const context = await prepareBacklogSync(workspacePath);
    if (context.changed) {
        await writeFileAtomic(context.loaded.path, replaceBody(context.loaded.raw, context.nextBody, context.loaded.newline));
    }
    return {
        path: context.loaded.path,
        changed: context.changed,
        inserted: context.inserted,
    };
}
/**
 * Ouvre une révision substantielle du backlog.
 *
 * Procédure du workflow officiel, récupérable après interruption :
 * valider intégralement l'état courant, archiver cet état de façon exclusive,
 * puis incrémenter la version, effacer l'approbation et régénérer la vue.
 * Une archive identique à l'état courant est la reprise d'une tentative
 * interrompue ; une archive différente bloque et n'est jamais écrasée.
 */
export async function reviseBacklog(workspacePath) {
    const context = await prepareBacklogSync(workspacePath);
    const { workspace, loaded, backlog } = context;
    if (context.changed) {
        throw new Error("La vue générée n'est pas à jour : régénérer avec « ai-project backlog sync-view » " +
            "avant d'ouvrir une révision, afin d'archiver un état cohérent. Aucun fichier n'a été modifié.");
    }
    const archivePath = join(workspace, "docs", "internal", "backlog-history", `BACKLOG-v${backlog.backlog_version}.md`);
    const current = await readFile(loaded.path, "utf8");
    const archiveResumed = await writeArchive(workspace, archivePath, current);
    const attributes = { ...loaded.attributes };
    const approvalCleared = attributes.status === "approved";
    attributes.backlog_version = backlog.backlog_version + 1;
    attributes.status = "draft";
    attributes.approved_by = null;
    attributes.approved_at = null;
    const revised = attributes;
    assertSchema(await backlogSchema(), attributes, "taches/BACKLOG.md (révision)");
    const rendered = renderRoadmap(revised, context.units);
    assertRenderedMarkersAbsent(rendered);
    const body = replaceRoadmapBlock(loaded.body, rendered);
    analyzeMarkers(body);
    await writeFileAtomic(loaded.path, stringifyFrontmatter(attributes, body));
    return {
        path: loaded.path,
        archivePath,
        archiveResumed,
        previousVersion: backlog.backlog_version,
        newVersion: backlog.backlog_version + 1,
        approvalCleared,
    };
}
/** Création exclusive, avec reprise idempotente d'une tentative interrompue. */
async function writeArchive(workspace, path, content) {
    await assertManagedPathInsideWorkspace(workspace, path, "L'archive du backlog");
    if (await pathExists(path)) {
        const existing = await readFile(path, "utf8");
        if (hashText(existing) === hashText(content))
            return true;
        throw new Error(`L'archive ${path} existe déjà avec un contenu différent : une archive n'est jamais écrasée. ` +
            "Aucun fichier n'a été modifié ; inspecter cette archive avant de poursuivre.");
    }
    await writeNewFile(path, content);
    return false;
}
function titleFromBody(body, id) {
    const pattern = new RegExp(`^#{1,6}\\s+${id}\\s+—\\s+(.+)$`, "m");
    const match = body.match(pattern);
    const title = match?.[1]?.trim();
    if (!title)
        return id;
    return title.length > 100 ? `${title.slice(0, 97)}…` : title;
}
/**
 * Migration strictement mécanique : elle n'invente ni phase, ni tâche, ni `realizes`,
 * ni preuve, ni acceptation, et ne supprime jamais un lien opérationnel.
 */
export async function migrateBacklog(workspacePath, dryRun) {
    const workspace = await canonicalPath(workspacePath);
    const loaded = await readBacklogFile(workspace);
    if (!loaded) {
        throw new Error("Aucun taches/BACKLOG.md dans ce workspace.");
    }
    if (loaded.schemaVersion === 2) {
        throw new Error("taches/BACKLOG.md est déjà en schema_version 2 : rien à migrer.");
    }
    if (loaded.schemaVersion !== 1) {
        throw new Error(`schema_version ${loaded.schemaVersion} inconnu : seule la migration v1 → v2 est prise en charge.`);
    }
    await assertManagedPathInsideWorkspace(workspace, loaded.path, "taches/BACKLOG.md");
    // P2-5 : valider le v1 avant toute transformation, pour ne jamais produire un v2
    // que son propre schéma rejetterait ensuite.
    assertSchema(await legacyBacklogSchema(), loaded.attributes, "taches/BACKLOG.md (v1)");
    const legacy = loaded.attributes;
    const units = await loadValidatedWorkUnits(workspace);
    const unitStatus = new Map(units.map((unit) => [unit.id, unit.status]));
    const notices = [];
    const wasApproved = legacy.status === "approved";
    const newVersion = wasApproved ? legacy.backlog_version + 1 : legacy.backlog_version;
    const sorted = [...legacy.candidates].sort((left, right) => left.rank - right.rank);
    const items = sorted.map((candidate, index) => {
        // En v2, `ready` exige au moins une tâche obligatoire. Un élément migré n'en a
        // aucune : le ramener à `candidate` est la seule transposition honnête, et la
        // migration ne doit jamais produire un workspace immédiatement bloqué.
        const stage = "candidate";
        let disposition = "active";
        if (candidate.status === "ready" || candidate.status === "selected") {
            notices.push({
                code: "READY_NEEDS_TASKS",
                message: `${candidate.id} était \`${candidate.status}\` en v1 : ramené à \`candidate\` faute de tâches. ` +
                    "Le repasser à `ready` exige au moins une tâche obligatoire (project-plan).",
            });
        }
        else if (candidate.status === "done") {
            notices.push({
                code: "DONE_WITHOUT_EVIDENCE",
                message: `${candidate.id} était \`done\` en v1. En v2 l'état est calculé depuis des tâches et des preuves ` +
                    "qui n'existent pas encore : il apparaîtra `candidate` jusqu'à ce que project-plan les reconstitue.",
            });
        }
        else if (candidate.status === "deferred") {
            disposition = "deferred";
        }
        else if (candidate.status === "retired") {
            disposition = "retired";
        }
        return {
            id: candidate.id,
            title: titleFromBody(loaded.body, candidate.id),
            phase: "PH-1",
            order: index + 1,
            stage,
            disposition,
            required: true,
            priority: candidate.priority,
            depends_on: candidate.depends_on,
            derived_from: [],
            legacy_work_items: [...candidate.work_items],
            outcome_accepted_by: null,
            outcome_accepted_at: null,
            tasks: [],
        };
    });
    for (const item of items) {
        for (const workId of item.legacy_work_items) {
            if (!unitStatus.has(workId)) {
                notices.push({
                    code: "LEGACY_WORK_MISSING",
                    message: `${item.id} référence ${workId}, introuvable dans taches/ : lien conservé, à vérifier.`,
                });
            }
        }
    }
    const maxItemNumber = items.reduce((max, item) => Math.max(max, Number.parseInt(item.id.slice(4), 10)), 0);
    const attributes = {
        schema_version: 2,
        backlog_version: newVersion,
        status: "draft",
        approved_by: null,
        approved_at: null,
        source_brief_version: legacy.source_brief_version,
        source_setup_report: legacy.source_setup_report,
        last_reviewed_at: legacy.last_reviewed_at,
        id_allocation: {
            next_phase: 2,
            next_item: maxItemNumber + 1,
            next_task: 1,
            next_evidence: 1,
        },
        phases: [
            {
                id: "PH-1",
                title: "À nommer",
                goal: "À définir : cette phase est le réceptacle temporaire de la migration.",
                disposition: "active",
                prepared_by: null,
                prepared_at: null,
            },
        ],
        items,
    };
    if (wasApproved) {
        notices.push({
            code: "APPROVAL_CLEARED",
            message: `Le backlog était approuvé : version portée à v${newVersion}, statut ramené à \`draft\`, ` +
                "approbation effacée (changement substantiel).",
        });
    }
    const archiveDirectory = join(workspace, "docs", "internal", "backlog-history");
    const archivePath = join(archiveDirectory, `BACKLOG-v${legacy.backlog_version}-schema1.md`);
    // P2-5 : le résultat v2 est entièrement construit, validé et rendu en mémoire —
    // et `--dry-run` parcourt exactement le même chemin — avant la moindre écriture.
    assertSchema(await backlogSchema(), attributes, "taches/BACKLOG.md (v2 produit)");
    const migrated = attributes;
    const markerField = findMarkerInFields(migrated);
    if (markerField) {
        throw new Error(`${markerField} contient un marqueur de bloc généré : migration impossible.`);
    }
    analyzeMarkers(loaded.body);
    const rendered = renderRoadmap(migrated, units);
    assertRenderedMarkersAbsent(rendered);
    const body = replaceRoadmapBlock(loaded.body, rendered);
    analyzeMarkers(body);
    // P2-4 : une archive identique est la reprise d'une tentative interrompue ;
    // une archive différente bloque sans jamais être écrasée. Contrôle avant écriture.
    const original = await readFile(loaded.path, "utf8");
    if (await pathExists(archivePath)) {
        const existing = await readFile(archivePath, "utf8");
        if (hashText(existing) !== hashText(original)) {
            throw new Error(`L'archive ${archivePath} existe déjà avec un contenu différent : une archive n'est jamais ` +
                "écrasée. Aucun fichier n'a été modifié ; inspecter cette archive avant de poursuivre.");
        }
    }
    if (!dryRun) {
        await writeArchive(workspace, archivePath, original);
        await writeFileAtomic(loaded.path, stringifyFrontmatter(attributes, body));
    }
    return {
        path: loaded.path,
        archivePath,
        dryRun,
        previousVersion: legacy.backlog_version,
        newVersion,
        statusReset: wasApproved,
        itemCount: items.length,
        legacyLinkCount: items.reduce((sum, item) => sum + item.legacy_work_items.length, 0),
        notices,
    };
}
/**
 * Unités présentes dans `taches/` mais dont le frontmatter est illisible. Elles ne
 * doivent jamais être confondues avec des unités absentes ni ignorées en silence.
 */
export async function listUnreadableWorkUnits(workspace) {
    const directory = join(workspace, "taches");
    if (!(await pathExists(directory)))
        return [];
    const unreadable = [];
    for (const entry of (await readdir(directory)).sort()) {
        const match = entry.match(/^(WORK-[0-9]{3,})\.md$/);
        if (!match?.[1])
            continue;
        const path = join(directory, entry);
        try {
            if ((await lstat(path)).isSymbolicLink()) {
                unreadable.push({
                    id: match[1],
                    path,
                    reason: "le fichier est un lien symbolique, interdit pour une unité gérée",
                });
                continue;
            }
            parseFrontmatter(await readFile(path, "utf8"));
        }
        catch (error) {
            unreadable.push({
                id: match[1],
                path,
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return unreadable;
}
//# sourceMappingURL=backlog.js.map