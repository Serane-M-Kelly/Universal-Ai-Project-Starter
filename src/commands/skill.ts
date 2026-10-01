import { parseArgs } from "node:util";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
import {
  installSkill,
  loadSkillCatalog,
  synchronizeSkills,
  upgradeAllSkills,
  upgradeSkill,
} from "../lib/skills.js";

const USAGE =
  "Usage : ai-project skill add <id> [workspace] | " +
  "ai-project skill sync [workspace] [--force] | " +
  "ai-project skill upgrade <id> [workspace] [--force] | " +
  "ai-project skill upgrade --all [workspace] [--force] | " +
  "ai-project skill list";

export async function runSkill(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      workspace: { type: "string" },
      force: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
    },
  });

  const [action] = positionals;
  if (action === "list") {
    const catalog = await loadSkillCatalog();
    console.log("\nSkills disponibles :\n");
    for (const skill of catalog.skills) {
      console.log(`- ${skill.id} v${skill.version} — ${skill.label}`);
    }
    console.log();
    return 0;
  }

  if (action !== "add" && action !== "sync" && action !== "upgrade") {
    throw new Error(USAGE);
  }

  if (action === "add") {
    const [, argument, positionalWorkspace] = positionals;
    if (!argument) throw new Error("Usage : ai-project skill add <id> [chemin-du-workspace]");
    const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());
    await requireUnblockedForMutation(workspace);

    const result = await installSkill(workspace, argument);
    if (result.alreadyInstalled) {
      console.log(`\nLe skill ${result.manifest.label} v${result.manifest.version} est déjà installé.`);
    } else {
      console.log(`\nSkill installé : ${result.manifest.label} v${result.manifest.version}`);
    }
    console.log(`Source modifiable : ${result.workspace}/skills/${result.manifest.id}`);
    console.log(`Copies d'assistant actualisées : ${result.replicasUpdated}`);
    return await printFinalDiagnostic(workspace);
  }

  if (action === "sync") {
    const [, argument] = positionals;
    const workspace = resolveWorkspace(values.workspace ?? argument ?? process.cwd());

    const result = await synchronizeSkills(workspace, values.force ?? false);
    console.log(`\nSkills synchronisés : ${result.skillsSynchronized}`);
    console.log(`Copies d'assistant actualisées : ${result.replicasUpdated}`);
    return await printFinalDiagnostic(workspace);
  }

  // action === "upgrade"
  const force = values.force ?? false;
  if (values.all) {
    const [, positionalWorkspace] = positionals;
    const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());

    const outcome = await upgradeAllSkills(workspace, force);
    console.log();
    for (const result of outcome.results) {
      if (result.alreadyUpToDate) {
        console.log(`- ${result.skillId} : déjà en v${result.newVersion}`);
      } else {
        console.log(
          `- ${result.skillId} : v${result.previousVersion} → v${result.newVersion} ` +
            `(${result.replicasUpdated} copie(s) actualisée(s))`,
        );
      }
    }
    for (const failure of outcome.failures) {
      console.log(`- ${failure.skillId} : ÉCHEC — ${failure.error}`);
    }
    if (outcome.starterVersionUpdated) {
      console.log(
        `\nstarter_version du workspace : ${outcome.previousStarterVersion} → ${outcome.newStarterVersion}`,
      );
    } else if (outcome.failures.length > 0) {
      console.log("\nstarter_version du workspace inchangé (au moins une mise à niveau a échoué).");
    }
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, false);
    if (outcome.failures.length > 0) return 2;
    return report.verdict === "BLOCKED" ? 2 : 0;
  }

  const [, argument, positionalWorkspace] = positionals;
  if (!argument) {
    throw new Error("Usage : ai-project skill upgrade <id> [chemin-du-workspace] [--force]");
  }
  const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());
  const result = await upgradeSkill(workspace, argument, force);
  if (result.alreadyUpToDate) {
    console.log(`\nLe skill ${result.skillId} est déjà en v${result.newVersion}.`);
  } else {
    console.log(
      `\nSkill mis à niveau : ${result.skillId} v${result.previousVersion} → v${result.newVersion}`,
    );
    console.log(`Copies d'assistant actualisées : ${result.replicasUpdated}`);
  }
  return await printFinalDiagnostic(workspace);
}

async function requireUnblockedForMutation(workspace: string): Promise<void> {
  const initialReport = await inspectWorkspace(workspace);
  if (initialReport.verdict === "BLOCKED") {
    printDiagnostic(initialReport, false);
    throw new Error("Le workspace doit être débloqué avant de gérer ses skills.");
  }
}

async function printFinalDiagnostic(workspace: string): Promise<number> {
  const report = await inspectWorkspace(workspace);
  printDiagnostic(report, false);
  return report.verdict === "BLOCKED" ? 2 : 0;
}
