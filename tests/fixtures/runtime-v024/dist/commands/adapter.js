import { parseArgs } from "node:util";
import { applyAdapter, upgradeAdapter } from "../lib/adapters.js";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
import { synchronizeSkills } from "../lib/skills.js";
import { synchronizeAgents } from "../lib/agents.js";
import { join } from "node:path";
import { pathExists } from "../lib/fs-safe.js";
import { STATE } from "../lib/phase-workflow.js";
import { addNativeAdapter } from "../lib/native-switch.js";
export async function runAdapter(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            workspace: { type: "string" },
            force: { type: "boolean", default: false },
        },
    });
    const [action, adapterId, positionalWorkspace] = positionals;
    if ((action !== "add" && action !== "upgrade") || !adapterId) {
        throw new Error("Usage : ai-project adapter add <id> [chemin-du-workspace] | " +
            "ai-project adapter upgrade <id> [chemin-du-workspace] [--force]");
    }
    const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());
    if (await pathExists(join(workspace, STATE))) {
        // Phase workspaces keep one native registry (.starter/models.json). The historical templates
        // describe the legacy backlog and would register an assistant without its native copies.
        if (action === "upgrade")
            throw new Error("Workspace par phases : les fichiers natifs sont régénérés par « node .starter/run.mjs workflow models-sync », pas par adapter upgrade.");
        const result = await addNativeAdapter(workspace, adapterId, false);
        console.log(JSON.stringify(result, null, 2));
        return result.verdict === "BLOCKED" ? 2 : 0;
    }
    if (action === "add") {
        const initialReport = await inspectWorkspace(workspace);
        if (initialReport.verdict === "BLOCKED") {
            printDiagnostic(initialReport, false);
            throw new Error("Le workspace doit être débloqué avant d'ajouter un adaptateur.");
        }
    }
    if (action === "upgrade") {
        const result = await upgradeAdapter(workspace, adapterId, values.force ?? false);
        if (result.alreadyUpToDate) {
            console.log(`\nL'adaptateur ${result.manifest.adapter.label} est déjà en v${result.newVersion}.`);
        }
        else {
            console.log(`\nAdaptateur mis à niveau : ${result.manifest.adapter.label} ` +
                `v${result.previousVersion} → v${result.newVersion}`);
            console.log(`Sorties actualisées : ${result.outputsUpdated}`);
        }
        // `--force` autorise uniquement le remplacement des sorties de l'adaptateur.
        // Les sources/copies de skills et d'agents gardent leur protection propre.
        try {
            const synchronized = await synchronizeSkills(workspace, false);
            if (synchronized.skillsSynchronized > 0) {
                console.log(`Skills synchronisés : ${synchronized.skillsSynchronized}`);
            }
        }
        catch (error) {
            console.log(`Synchronisation des skills différée : ${errorMessage(error)} ` +
                "Relancer ensuite « ai-project skill upgrade --all ».");
        }
        try {
            const synchronizedAgents = await synchronizeAgents(workspace, false);
            if (synchronizedAgents.agentsSynchronized > 0) {
                console.log(`Agents synchronisés : ${synchronizedAgents.agentsSynchronized}`);
            }
        }
        catch (error) {
            console.log(`Synchronisation des agents différée : ${errorMessage(error)} ` +
                "Examiner leur version avant de poursuivre.");
        }
        const report = await inspectWorkspace(workspace);
        printDiagnostic(report, false);
        return report.verdict === "BLOCKED" ? 2 : 0;
    }
    const result = await applyAdapter(workspace, adapterId);
    const synchronized = await synchronizeSkills(workspace, false);
    const synchronizedAgents = await synchronizeAgents(workspace, false);
    if (result.alreadyConfigured) {
        console.log(`\nL'adaptateur ${result.manifest.adapter.label} v${result.manifest.adapter.version} est déjà configuré.`);
    }
    else {
        console.log(`\nAdaptateur ajouté : ${result.manifest.adapter.label} v${result.manifest.adapter.version}`);
    }
    console.log(`Workspace : ${result.workspace}`);
    if (synchronized.skillsSynchronized > 0) {
        console.log(`Skills synchronisés : ${synchronized.skillsSynchronized}`);
    }
    if (synchronizedAgents.agentsSynchronized > 0) {
        console.log(`Agents synchronisés : ${synchronizedAgents.agentsSynchronized}`);
    }
    console.log(`Démarrage : cd "${result.workspace}" puis ${result.manifest.launch.command}`);
    if (result.manifest.launch.requires_trust) {
        console.log("Première ouverture : examiner puis confirmer la confiance du projet.");
    }
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=adapter.js.map