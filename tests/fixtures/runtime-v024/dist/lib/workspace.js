import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import YAML from "yaml";
import { assertDestinationAvailable, pathExists, writeNewFile } from "./fs-safe.js";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { templatesRoot } from "./paths.js";
import { portableRelative, replaceProjectName, slugify } from "./text.js";
export async function createWorkspace(options) {
    const workspacePath = resolve(options.workspacePath);
    await assertDestinationAvailable(workspacePath);
    await mkdir(workspacePath, { recursive: true });
    try {
        const projectTemplate = YAML.parse(await readFile(join(templatesRoot, "project.yaml"), "utf8"));
        const config = {
            ...projectTemplate,
            project: {
                ...projectTemplate.project,
                name: options.name,
                slug: options.slug ?? slugify(options.name),
                entry_mode: options.entryMode,
            },
            paths: {
                workspace_root: ".",
                code_root: portableRelative(workspacePath, resolve(options.codeRoot)),
                repository_root: portableRelative(workspacePath, resolve(options.repositoryRoot)),
            },
            profile: {
                id: options.profile.profile.id,
                version: options.profile.profile.version,
            },
            commands: {
                ...options.profile.commands.defaults,
                ...options.commands,
            },
        };
        await writeNewFile(join(workspacePath, "project.yaml"), YAML.stringify(config));
        const briefTemplate = replaceProjectName(await readFile(join(templatesRoot, "PROJECT_BRIEF.md"), "utf8"), options.name);
        await writeNewFile(join(workspacePath, "PROJECT_BRIEF.md"), briefTemplate);
        const stateTemplate = replaceProjectName(await readFile(join(templatesRoot, "PROJECT_STATE.md"), "utf8"), options.name);
        const state = parseFrontmatter(stateTemplate);
        state.attributes.stage = stageForEntryMode(options.entryMode);
        state.attributes.updated_at = new Date().toISOString();
        await writeNewFile(join(workspacePath, "PROJECT_STATE.md"), stringifyFrontmatter(state.attributes, state.body));
        const decisions = await readFile(join(templatesRoot, "docs", "decisions.md"), "utf8");
        await writeNewFile(join(workspacePath, "docs", "decisions.md"), decisions);
        const workspaceIgnore = [
            ".DS_Store",
            ".env",
            ".env.*",
            "*.log",
            "reports/",
        ].join("\n");
        await writeNewFile(join(workspacePath, ".gitignore"), `${workspaceIgnore}\n`);
        for (const directory of [
            "intake/research",
            "intake/research/product-package",
            "intake/product-package",
            "intake/assets",
            "prototype/private",
            "prototype/product-package",
            "docs/internal",
            "docs/internal/product-package",
            "taches",
            "livraisons",
            "reports",
            "reports/intake",
        ]) {
            await mkdir(join(workspacePath, directory), { recursive: true });
        }
    }
    catch (error) {
        await rm(workspacePath, { recursive: true, force: true });
        throw error;
    }
}
export function initializeGit(repositoryPath) {
    try {
        execFileSync("git", ["init", "-b", "main"], {
            cwd: repositoryPath,
            stdio: "ignore",
        });
    }
    catch {
        execFileSync("git", ["init"], { cwd: repositoryPath, stdio: "ignore" });
        execFileSync("git", ["branch", "-M", "main"], {
            cwd: repositoryPath,
            stdio: "ignore",
        });
    }
}
export function findGitRoot(path) {
    try {
        return execFileSync("git", ["rev-parse", "--show-toplevel"], {
            cwd: path,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    }
    catch {
        return null;
    }
}
export async function detectExistingCommands(codeRoot) {
    const packagePath = join(codeRoot, "package.json");
    const composerPath = join(codeRoot, "composer.json");
    const hasPackage = await pathExists(packagePath);
    const hasComposer = await pathExists(composerPath);
    if (!hasPackage && !hasComposer)
        return {};
    let nodeCommands = {};
    if (hasPackage) {
        const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
        const scripts = packageJson.scripts ?? {};
        const runner = await detectPackageRunner(codeRoot);
        const run = (script) => `${runner} run ${script}`;
        nodeCommands = {
            install: installCommand(runner),
            dev: hasScript(scripts, "dev") ? run("dev") : null,
            lint: hasScript(scripts, "lint") ? run("lint") : null,
            typecheck: hasScript(scripts, "typecheck")
                ? run("typecheck")
                : hasScript(scripts, "type-check")
                    ? run("type-check")
                    : null,
            test: hasScript(scripts, "test") ? run("test") : null,
            build: hasScript(scripts, "build") ? run("build") : null,
        };
    }
    let composerCommands = {};
    if (hasComposer) {
        const composerJson = JSON.parse(await readFile(composerPath, "utf8"));
        const scripts = composerJson.scripts ?? {};
        composerCommands = {
            install: "composer install",
            dev: composerScript(scripts, ["dev", "start"]),
            lint: composerScript(scripts, ["lint", "phpcs", "check-style", "cs"]),
            typecheck: composerScript(scripts, ["typecheck", "type-check", "analyse", "analyze", "phpstan", "psalm"]),
            test: composerScript(scripts, ["test", "tests", "phpunit"]),
            build: composerScript(scripts, ["build"]),
        };
    }
    return {
        install: combineCommands(composerCommands.install, nodeCommands.install),
        dev: nodeCommands.dev ?? composerCommands.dev ?? null,
        lint: combineCommands(composerCommands.lint, nodeCommands.lint),
        typecheck: combineCommands(composerCommands.typecheck, nodeCommands.typecheck),
        test: combineCommands(composerCommands.test, nodeCommands.test),
        build: combineCommands(composerCommands.build, nodeCommands.build),
    };
}
function hasScript(scripts, name) {
    const value = scripts[name];
    return typeof value === "string" || Array.isArray(value);
}
function composerScript(scripts, candidates) {
    const name = candidates.find((candidate) => hasScript(scripts, candidate));
    return name ? `composer run ${name}` : null;
}
function combineCommands(first, second) {
    const commands = [first, second].filter((command) => Boolean(command));
    return commands.length > 0 ? commands.join(" && ") : null;
}
async function detectPackageRunner(codeRoot) {
    if (await pathExists(join(codeRoot, "pnpm-lock.yaml")))
        return "pnpm";
    if (await pathExists(join(codeRoot, "yarn.lock")))
        return "yarn";
    if (await pathExists(join(codeRoot, "bun.lockb")))
        return "bun";
    if (await pathExists(join(codeRoot, "bun.lock")))
        return "bun";
    return "npm";
}
function installCommand(runner) {
    if (runner === "yarn" || runner === "bun")
        return runner;
    return `${runner} install`;
}
function stageForEntryMode(entryMode) {
    if (entryMode === "idea")
        return "discovery";
    if (entryMode === "brief")
        return "definition";
    return "delivery";
}
export function defaultAdoptionWorkspace(appPath, repositoryRoot) {
    const app = resolve(appPath);
    const repository = resolve(repositoryRoot);
    const workspaceName = app === repository
        ? `${basename(repository)}-ai-workspace`
        : `${basename(repository)}-${basename(app)}-ai-workspace`;
    return join(resolve(repository, ".."), workspaceName);
}
//# sourceMappingURL=workspace.js.map