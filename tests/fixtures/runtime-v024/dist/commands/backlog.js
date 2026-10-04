import { pathExists } from "../lib/fs-safe.js";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { relative } from "node:path";
import { migrateBacklog, prepareBacklogSync, reviseBacklog, roadmapBlockIsCurrent, syncBacklogView, } from "../lib/backlog.js";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
const USAGE = "Usage : ai-project backlog sync-view [chemin-du-workspace] [--check] | " +
    "ai-project backlog revise [chemin-du-workspace] | " +
    "ai-project backlog migrate [chemin-du-workspace] [--dry-run]";
export async function runBacklog(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            workspace: { type: "string" },
            check: { type: "boolean", default: false },
            "dry-run": { type: "boolean", default: false },
        },
    });
    const [action, positionalWorkspace] = positionals;
    const known = new Set(["sync-view", "revise", "migrate"]);
    if (!action || !known.has(action)) {
        throw new Error(USAGE);
    }
    const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());
    if (await pathExists(join(workspace, ".starter/workflow.json")))
        throw new Error("Ce workspace utilise le workflow par phases : employer workflow plan ou repair-view, sans second backlog.");
    if (action === "sync-view") {
        if (values.check) {
            // Même préambule que `sync-view` : mêmes diagnostics, jamais d'erreur opaque
            // ni de réparation recommandée qui échouerait.
            const context = await prepareBacklogSync(workspace);
            if (!roadmapBlockIsCurrent(context.loaded.body, context.rendered)) {
                console.log("\nLa vue générée de taches/BACKLOG.md ne correspond plus aux données structurées.");
                console.log("Réparer avec : ai-project backlog sync-view\n");
                return 1;
            }
            console.log("\nLa vue générée de taches/BACKLOG.md est à jour.\n");
            return 0;
        }
        const result = await syncBacklogView(workspace);
        const shown = relative(workspace, result.path) || result.path;
        if (result.inserted) {
            console.log(`\nBloc de roadmap inséré dans ${shown}.`);
        }
        else if (result.changed) {
            console.log(`\nVue régénérée : ${shown}.`);
        }
        else {
            console.log(`\nVue déjà à jour : ${shown}.`);
        }
        console.log("Le frontmatter reste l'unique source de vérité ; ce bloc en est une projection.");
        return await printFinalDiagnostic(workspace);
    }
    if (action === "revise") {
        const result = await reviseBacklog(workspace);
        console.log(`\nRévision ouverte : backlog v${result.previousVersion} → v${result.newVersion}.`);
        console.log(`${result.archiveResumed ? "Archive déjà présente, reprise" : "État précédent archivé"} : ` +
            `${relative(workspace, result.archivePath) || result.archivePath}`);
        if (result.approvalCleared) {
            console.log("Approbation effacée : cette version doit être approuvée de nouveau avant PLAN_READY.");
        }
        return await printFinalDiagnostic(workspace);
    }
    const dryRun = values["dry-run"] ?? false;
    const result = await migrateBacklog(workspace, dryRun);
    console.log(`\n${dryRun ? "Simulation de migration" : "Migration"} v1 → v2 : ${result.itemCount} résultat(s).`);
    console.log(`Version : v${result.previousVersion} → v${result.newVersion}` +
        (result.statusReset ? " (statut ramené à draft, approbation effacée)" : " (brouillon conservé)"));
    console.log(`Archive : ${relative(workspace, result.archivePath) || result.archivePath}`);
    console.log(`Liens historiques conservés : ${result.legacyLinkCount}`);
    for (const notice of result.notices) {
        console.log(`- ${notice.message}`);
    }
    console.log("\nStructure migrée. Les phases réelles, les TSK et le découpage restent une décision " +
        "de planification : relancer project-plan avant toute approbation.");
    if (dryRun) {
        console.log("Aucun fichier écrit (--dry-run).\n");
        return 0;
    }
    return await printFinalDiagnostic(workspace);
}
async function printFinalDiagnostic(workspace) {
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
//# sourceMappingURL=backlog.js.map