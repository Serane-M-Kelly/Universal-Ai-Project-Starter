import { parseArgs } from "node:util";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createWorkspace, initializeGit } from "../lib/workspace.js";
import { slugify } from "../lib/text.js";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { assertDestinationAvailable, pathExists } from "../lib/fs-safe.js";
import { assertProfileSupportsEntryMode, loadProfile } from "../lib/profiles.js";
export async function runNew(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            target: { type: "string" },
            "entry-mode": { type: "string", default: "brief" },
            profile: { type: "string", default: "generic" },
            "no-git": { type: "boolean", default: false },
        },
    });
    const providedName = positionals[0];
    if (!providedName) {
        throw new Error("Usage : ai-project new <nom> [--target chemin] [--entry-mode idea|brief] [--profile id]");
    }
    const entryMode = values["entry-mode"];
    if (entryMode !== "idea" && entryMode !== "brief") {
        throw new Error("--entry-mode doit valoir idea ou brief pour un nouveau projet.");
    }
    const profile = await loadProfile(values.profile);
    assertProfileSupportsEntryMode(profile, entryMode);
    const target = resolve(values.target ?? join(process.cwd(), slugify(providedName)));
    const appPath = join(target, "app");
    const workspacePath = join(target, "ai-workspace");
    const targetAlreadyExisted = await pathExists(target);
    await assertDestinationAvailable(target);
    if (!targetAlreadyExisted) {
        await mkdir(target, { recursive: true });
    }
    try {
        await mkdir(appPath);
        await createWorkspace({
            workspacePath,
            codeRoot: appPath,
            repositoryRoot: appPath,
            name: providedName,
            slug: slugify(providedName),
            entryMode: entryMode,
            profile,
        });
        if (!values["no-git"]) {
            initializeGit(appPath);
        }
    }
    catch (error) {
        await rm(appPath, { recursive: true, force: true });
        await rm(workspacePath, { recursive: true, force: true });
        if (!targetAlreadyExisted) {
            await rm(target, { recursive: true, force: true });
        }
        throw error;
    }
    console.log(`\nProjet créé : ${providedName}`);
    console.log(`Application : ${appPath}`);
    console.log(`Workspace   : ${workspacePath}`);
    console.log(`Slug        : ${slugify(providedName)}`);
    const report = await inspectWorkspace(workspacePath);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
//# sourceMappingURL=new.js.map