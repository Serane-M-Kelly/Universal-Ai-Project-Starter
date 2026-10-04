#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runAdopt } from "./commands/adopt.js";
import { runBacklog } from "./commands/backlog.js";
import { runDoctor } from "./commands/doctor.js";
import { runNew } from "./commands/new.js";
import { runAdapter } from "./commands/adapter.js";
import { runSkill } from "./commands/skill.js";
import { runAgent } from "./commands/agent.js";
import { runProfile } from "./commands/profile.js";
import { runIntake } from "./commands/intake.js";
import { packageRoot } from "./lib/paths.js";
import { runWorkflow } from "./commands/workflow.js";
const help = `
Universal AI Project Starter

Usage :
  ai-project workflow init <dossier> [--name nom] [--owner personne] [--code-root chemin] [--adapter codex|claude-code|codex,claude-code]
  ai-project workflow adapter-add codex|claude-code [--dry-run] [--workspace chemin]
  ai-project workflow status|next|context|plan|begin|check|observe|review|accept|reopen
  ai-project workflow report <preuve> [--raw | --stream stdout --offset 0 --limit 12000]
  ai-project workflow sources
  ai-project workflow status|next|context [numero] --compact [--metrics]
  ai-project workflow prepare-commit|verify-commit|models-sync|environment|migrate
  ai-project new <nom> [--target chemin] [--entry-mode idea|brief] [--profile id] [--no-git]
  ai-project adopt <chemin-du-projet> [--workspace chemin] [--entry-mode existing|maintenance] [--profile id]
  ai-project doctor [chemin] [--json] [--compact]
  ai-project intake import <product-package> [chemin-du-workspace]
  ai-project backlog sync-view [chemin-du-workspace] [--check]
  ai-project backlog revise [chemin-du-workspace]
  ai-project backlog migrate [chemin-du-workspace] [--dry-run]
  ai-project adapter add <id> [chemin-du-workspace]
  ai-project adapter upgrade <id> [chemin-du-workspace] [--force]
  ai-project skill list
  ai-project skill add <id> [chemin-du-workspace]
  ai-project skill sync [chemin-du-workspace] [--force]
  ai-project skill upgrade <id> [chemin-du-workspace] [--force]
  ai-project skill upgrade --all [chemin-du-workspace] [--force]
  ai-project agent list
  ai-project agent add <id> [chemin-du-workspace]
  ai-project agent create <id> [chemin-du-workspace]
  ai-project agent sync [chemin-du-workspace] [--force]
  ai-project profile list
  ai-project profile show <id>
  ai-project version
  ai-project help
`;
async function main() {
    const [command = "help", ...args] = process.argv.slice(2);
    let exitCode = 0;
    if (command === "workflow") {
        exitCode = await runWorkflow(args);
    }
    else if (command === "new") {
        exitCode = await runNew(args);
    }
    else if (command === "adopt") {
        exitCode = await runAdopt(args);
    }
    else if (command === "doctor") {
        exitCode = await runDoctor(args);
    }
    else if (command === "backlog") {
        exitCode = await runBacklog(args);
    }
    else if (command === "adapter") {
        exitCode = await runAdapter(args);
    }
    else if (command === "skill") {
        exitCode = await runSkill(args);
    }
    else if (command === "agent") {
        exitCode = await runAgent(args);
    }
    else if (command === "profile") {
        exitCode = await runProfile(args);
    }
    else if (command === "intake") {
        exitCode = await runIntake(args);
    }
    else if (command === "version" || command === "--version" || command === "-v") {
        const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
        console.log(packageJson.version);
    }
    else if (command === "help" || command === "--help" || command === "-h") {
        console.log(help);
    }
    else {
        throw new Error(`Commande inconnue : ${command}\n${help}`);
    }
    process.exitCode = exitCode;
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nErreur : ${message}\n`);
    process.exitCode = 2;
});
//# sourceMappingURL=index.js.map