import { parseArgs } from "node:util";
import { createUserAgent, installAgent, loadAgentCatalog, loadBuiltinAgent, synchronizeAgents, } from "../lib/agents.js";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
export async function runAgent(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            workspace: { type: "string" },
            force: { type: "boolean", default: false },
        },
    });
    const [action, argument, positionalWorkspace] = positionals;
    if (action === "list") {
        const catalog = await loadAgentCatalog();
        console.log("\nAgents disponibles :\n");
        for (const entry of catalog.agents) {
            const source = await loadBuiltinAgent(entry.id);
            console.log(`- ${source.manifest.agent.id} v${source.manifest.agent.version} — ${source.manifest.agent.label}`);
        }
        console.log();
        return 0;
    }
    if (!["add", "create", "sync"].includes(action ?? "")) {
        throw new Error("Usage : ai-project agent list | ai-project agent add <id> [workspace] | ai-project agent create <id> [workspace] | ai-project agent sync [workspace] [--force]");
    }
    if ((action === "add" || action === "create") && !argument) {
        throw new Error(`Usage : ai-project agent ${action} <id> [chemin-du-workspace]`);
    }
    const workspaceInput = action === "sync"
        ? values.workspace ?? argument ?? process.cwd()
        : values.workspace ?? positionalWorkspace ?? process.cwd();
    const workspace = resolveWorkspace(workspaceInput);
    const initialReport = await inspectWorkspace(workspace);
    if (action !== "sync" && initialReport.verdict === "BLOCKED") {
        printDiagnostic(initialReport, false);
        throw new Error("Le workspace doit être débloqué avant de gérer ses agents.");
    }
    if (action === "add") {
        const result = await installAgent(workspace, argument);
        console.log(result.alreadyInstalled
            ? `\nL'agent ${result.manifest.agent.label} v${result.manifest.agent.version} est déjà installé.`
            : `\nAgent installé : ${result.manifest.agent.label} v${result.manifest.agent.version}`);
        console.log(`Source modifiable : ${result.workspace}/agents/${result.manifest.agent.id}`);
        console.log(`Copies d'assistant actualisées : ${result.replicasUpdated}`);
    }
    else if (action === "create") {
        const result = await createUserAgent(workspace, argument);
        console.log(`\nAgent personnel créé : ${result.manifest.agent.id}`);
        console.log(`Source : ${result.workspace}/agents/${result.manifest.agent.id}`);
        console.log("État : désactivé. Rédiger les deux fichiers, passer enabled à true, puis lancer agent sync.");
    }
    else {
        const result = await synchronizeAgents(workspace, values.force ?? false);
        console.log(`\nAgents synchronisés : ${result.agentsSynchronized}`);
        console.log(`Copies d'assistant actualisées : ${result.replicasUpdated}`);
    }
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
//# sourceMappingURL=agent.js.map