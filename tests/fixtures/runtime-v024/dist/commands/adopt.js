import { parseArgs } from "node:util";
import { basename, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { createWorkspace, defaultAdoptionWorkspace, detectExistingCommands, findGitRoot, } from "../lib/workspace.js";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { isPathInsideOrEqual } from "../lib/text.js";
import { canonicalPath } from "../lib/fs-safe.js";
import { assertProfileSupportsEntryMode, loadProfile } from "../lib/profiles.js";
export async function runAdopt(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            workspace: { type: "string" },
            "entry-mode": { type: "string", default: "existing" },
            name: { type: "string" },
            profile: { type: "string", default: "generic" },
        },
    });
    const appArgument = positionals[0];
    if (!appArgument) {
        throw new Error("Usage : ai-project adopt <chemin-du-projet> [--workspace chemin] [--profile id]");
    }
    const appPath = await canonicalPath(resolve(appArgument));
    const details = await stat(appPath).catch(() => null);
    if (!details?.isDirectory()) {
        throw new Error(`Le projet à adopter n'est pas un dossier : ${appPath}`);
    }
    const entryMode = values["entry-mode"];
    if (entryMode !== "existing" && entryMode !== "maintenance") {
        throw new Error("--entry-mode doit valoir existing ou maintenance pour une adoption.");
    }
    const profile = await loadProfile(values.profile);
    assertProfileSupportsEntryMode(profile, entryMode);
    const repositoryRoot = findGitRoot(appPath) ?? appPath;
    const workspacePath = await canonicalPath(resolve(values.workspace ?? defaultAdoptionWorkspace(appPath, repositoryRoot)));
    if (isPathInsideOrEqual(workspacePath, repositoryRoot)) {
        throw new Error("Le workspace privé doit être placé hors du dépôt Git existant. Choisissez un autre chemin avec --workspace.");
    }
    const projectName = values.name ?? basename(appPath);
    const commands = profile.commands.strategy === "detect-existing"
        ? await detectExistingCommands(appPath)
        : {};
    await createWorkspace({
        workspacePath,
        codeRoot: appPath,
        repositoryRoot,
        name: projectName,
        entryMode: entryMode,
        profile,
        commands,
    });
    console.log(`\nProjet adopté : ${projectName}`);
    console.log(`Code existant : ${appPath}`);
    console.log(`Dépôt Git     : ${repositoryRoot}`);
    console.log(`Workspace     : ${workspacePath}`);
    console.log("Aucun fichier du projet existant n'a été modifié.");
    const report = await inspectWorkspace(workspacePath);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
//# sourceMappingURL=adopt.js.map