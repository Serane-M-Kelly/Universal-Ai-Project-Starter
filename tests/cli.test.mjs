import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import YAML from "yaml";

const starterRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(starterRoot, "dist", "index.js");
const fixturesRoot = join(starterRoot, "tests", "fixtures");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "universal-ai-starter-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function copyFixture(name, destination) {
  await cp(join(fixturesRoot, name), destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
}

async function simulateClaudeAdapterV3(workspace) {
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  const reference = config.adapters.find((adapter) => adapter.id === "claude-code");
  assert.ok(reference, "adaptateur Claude Code attendu");
  reference.version = 3;
  await writeFile(configPath, YAML.stringify(config));

  const instructionsPath = join(workspace, "CLAUDE.md");
  const current = await readFile(instructionsPath, "utf8");
  const previous = current.replace(
    /\n## Backlog et roadmap\n[\s\S]*?(?=\n## Exécution\n)/,
    "",
  );
  assert.notEqual(previous, current, "la section propre à la v4 doit être retirée");
  await writeFile(instructionsPath, previous);
}

async function writeMarkdownWithFrontmatter(path, attributes, body = "\n# Document de test\n") {
  const content = `---\n${YAML.stringify(attributes).trimEnd()}\n---\n${body}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function baseBacklogAttributes(overrides = {}) {
  return {
    schema_version: 1,
    backlog_version: 1,
    status: "draft",
    approved_by: null,
    approved_at: null,
    source_brief_version: 1,
    source_setup_report: "reports/setup-report.md",
    last_reviewed_at: null,
    candidates: [],
    ...overrides,
  };
}

function baseStrategyAttributes(overrides = {}) {
  return {
    schema_version: 1,
    strategy_version: 1,
    status: "draft",
    approved_by: null,
    approved_at: null,
    source_backlog_version: 1,
    entries: [],
    ...overrides,
  };
}

async function preparePlanningWorkspace(sandbox, name) {
  const target = join(sandbox, name);
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", name, "--target", target], sandbox).status, 0);
  await mkdir(join(workspace, "reports"), { recursive: true });
  await writeFile(join(workspace, "reports", "setup-report.md"), "# Rapport de setup (fixture de test)\n");
  return { target, workspace };
}

async function writeWorkItem(workspace, id, status) {
  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", `${id}.md`),
    {
      schema_version: 1,
      work_item_version: 1,
      id,
      status,
      brief_version: null,
      source_request: "Fixture de test",
      approved_by: status === "proposed" ? null : "Kelly",
      approved_at: status === "proposed" ? null : "2026-08-06",
      started_at: null,
      ready_for_review_at: null,
      ready_for_acceptance_at: null,
      accepted_by: status === "accepted" ? "Kelly" : null,
      accepted_at: status === "accepted" ? "2026-08-06" : null,
    },
    "\n# Unité de travail de test\n",
  );
}

test("new crée un dépôt applicatif isolé du workspace privé", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "demo-project");

  const result = runCli(["new", "Demo Project", "--target", target], sandbox);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = YAML.parse(
    await readFile(join(target, "ai-workspace", "project.yaml"), "utf8"),
  );
  assert.equal(config.project.name, "Demo Project");
  assert.equal(config.project.slug, "demo-project");
  assert.equal(config.paths.code_root, "../app");
  assert.equal(config.paths.repository_root, "../app");
  assert.equal(config.project.entry_mode, "brief");
  assert.deepEqual(config.profile, { id: "generic", version: 1 });
  assert.deepEqual(config.agents, []);
  assert.ok(config.privacy.private_paths.includes("livraisons/"));
  assert.deepEqual(config.commands, {
    install: null,
    dev: null,
    lint: null,
    typecheck: null,
    test: null,
    build: null,
  });

  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: join(target, "app"),
    stdio: "ignore",
  });
  await access(join(target, "ai-workspace", "livraisons"));
  const workspaceGit = runCli(
    ["doctor", join(target, "ai-workspace"), "--json"],
    sandbox,
  );
  assert.equal(workspaceGit.status, 1, workspaceGit.stderr || workspaceGit.stdout);
  const report = JSON.parse(workspaceGit.stdout);
  assert.equal(report.verdict, "WARNING");
  assert.ok(report.items.some((item) => item.code === "WORKSPACE_NO_GIT"));
  assert.ok(report.items.some((item) => item.code === "DRAFT_PLACEHOLDERS"));
  assert.ok(report.items.some((item) => item.code === "PROFILE_VALID"));
});

test("adopt conserve une application Node autonome intacte et détecte toutes ses commandes", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "node-application");
  const workspace = join(sandbox, "private-workspace");
  await copyFixture("existing-node-app", repository);
  const packageContent = await readFile(join(repository, "package.json"), "utf8");
  const sourceContent = await readFile(join(repository, "src", "index.js"), "utf8");
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const result = runCli(
    ["adopt", repository, "--workspace", workspace, "--name", "Existing App"],
    sandbox,
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(await readFile(join(repository, "package.json"), "utf8"), packageContent);
  assert.equal(await readFile(join(repository, "src", "index.js"), "utf8"), sourceContent);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.project.entry_mode, "existing");
  assert.equal(await realpath(resolve(workspace, config.paths.code_root)), await realpath(repository));
  assert.equal(
    await realpath(resolve(workspace, config.paths.repository_root)),
    await realpath(repository),
  );
  assert.equal(config.commands.install, "npm install");
  assert.equal(config.commands.dev, "npm run dev");
  assert.equal(config.commands.lint, "npm run lint");
  assert.equal(config.commands.typecheck, "npm run typecheck");
  assert.equal(config.commands.test, "npm run test");
  assert.equal(config.commands.build, "npm run build");
});

test("adopt distingue l'application ciblée de la racine d'un monorepo", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "monorepo");
  const workspace = join(sandbox, "monorepo-workspace");
  await copyFixture("existing-monorepo", repository);
  const app = join(repository, "packages", "web");
  const sourceContent = await readFile(join(app, "src", "index.js"), "utf8");
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const result = runCli(["adopt", app, "--workspace", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(await realpath(resolve(workspace, config.paths.code_root)), await realpath(app));
  assert.equal(
    await realpath(resolve(workspace, config.paths.repository_root)),
    await realpath(repository),
  );
  assert.equal(await readFile(join(app, "src", "index.js"), "utf8"), sourceContent);
  assert.equal(config.commands.dev, "npm run dev");
  assert.equal(config.commands.typecheck, null);
});

test("adopt refuse de placer le workspace privé dans le dépôt", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const app = join(sandbox, "existing-app");
  const unsafeWorkspace = join(app, "ai-workspace");
  await mkdir(app);
  execFileSync("git", ["init", "-b", "main"], { cwd: app, stdio: "ignore" });

  const result = runCli(
    ["adopt", app, "--workspace", unsafeWorkspace],
    sandbox,
  );

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /hors du dépôt Git/);
  await assert.rejects(access(unsafeWorkspace));
});

test("doctor bloque une fuite de document privé dans le code", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "leak-test");
  const created = runCli(["new", "Leak Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  await writeFile(join(target, "app", "PROJECT_BRIEF.md"), "private\n");
  const result = runCli(
    ["doctor", join(target, "ai-workspace"), "--json"],
    sandbox,
  );

  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(report.items.some((item) => item.code === "PRIVATE_LEAK"));
});

test("doctor n'exige aucune action quand .claude est absent du code root", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-absent-test");
  const created = runCli(["new", "Claude Absent Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(
    !report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
  assert.ok(!report.items.some((item) => item.code === "CLAUDE_CODE_RUNTIME_MARKER"));
});

test("doctor autorise le marqueur runtime Claude Code .claude/.cc-writes vide", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-marker-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Marker Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  await mkdir(join(app, ".claude", ".cc-writes"), { recursive: true });

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.notEqual(report.verdict, "BLOCKED", result.stderr || result.stdout);
  assert.ok(
    !report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.includes(".claude")),
  );
  const marker = report.items.find((item) => item.code === "CLAUDE_CODE_RUNTIME_MARKER");
  assert.ok(marker, "diagnostic explicite attendu pour le marqueur runtime");
  assert.equal(marker.severity, "ok");
  assert.ok(marker.path?.endsWith(join(".claude", ".cc-writes")));
});

test("doctor bloque tout autre contenu dans .claude", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-other-file-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Other File Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  await mkdir(join(app, ".claude"), { recursive: true });
  await writeFile(join(app, ".claude", "settings.json"), "{}\n");

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(
    report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
});

test("doctor bloque un .claude/.cc-writes non vide", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-nonempty-marker-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Nonempty Marker Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  await mkdir(join(app, ".claude", ".cc-writes"), { recursive: true });
  await writeFile(join(app, ".claude", ".cc-writes", "leftover.txt"), "not empty\n");

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(
    report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
});

test("doctor bloque .cc-writes lorsque ce n'est pas un répertoire réel", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-cc-writes-file-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Cc Writes File Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  await mkdir(join(app, ".claude"), { recursive: true });
  await writeFile(join(app, ".claude", ".cc-writes"), "not a directory\n");

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(
    report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
});

test("doctor bloque .cc-writes lorsque c'est un lien symbolique", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-cc-writes-symlink-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Cc Writes Symlink Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const outsideDir = join(sandbox, "outside-empty-dir");
  await mkdir(outsideDir);
  await mkdir(join(app, ".claude"), { recursive: true });
  await symlink(outsideDir, join(app, ".claude", ".cc-writes"), "dir");

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(
    report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
});

test("doctor bloque .claude lorsque c'est lui-même un lien symbolique, même vers un marqueur valide", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-symlink-test");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Symlink Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const outsideDir = join(sandbox, "outside-claude-dir");
  await mkdir(join(outsideDir, ".cc-writes"), { recursive: true });
  await symlink(outsideDir, join(app, ".claude"), "dir");

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(
    report.items.some((item) => item.code === "PRIVATE_LEAK" && item.path?.endsWith(".claude")),
  );
});

test("doctor autorise les modèles d'environnement sans secrets", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "env-example-test");
  const app = join(target, "app");
  const created = runCli(["new", "Env Example Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  await writeFile(join(app, ".env.example"), "PUBLIC_VARIABLE=\n");
  execFileSync("git", ["add", ".env.example"], { cwd: app, stdio: "ignore" });

  const result = runCli(["doctor", join(target, "ai-workspace"), "--json"], sandbox);
  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.code === "TRACKED_SENSITIVE"));
});

test("doctor bloque une configuration qui ne respecte pas le schéma", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "schema-test");
  const created = runCli(["new", "Schema Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const configPath = join(target, "ai-workspace", "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  config.project.slug = "Slug Invalide";
  await writeFile(configPath, YAML.stringify(config));
  const result = runCli(
    ["doctor", join(target, "ai-workspace"), "--json"],
    sandbox,
  );

  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verdict, "BLOCKED");
  assert.ok(report.items.some((item) => item.code === "CONFIG_SCHEMA"));
});

test("doctor bloque une version de profil incompatible", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "profile-version-test");
  const created = runCli(["new", "Profile Version Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const configPath = join(target, "ai-workspace", "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  config.profile.version = 99;
  await writeFile(configPath, YAML.stringify(config));

  const result = runCli(
    ["doctor", join(target, "ai-workspace"), "--json"],
    sandbox,
  );
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "PROFILE_VERSION"));
});

test("new refuse un profil inconnu avant de créer le projet", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "unknown-profile-test");

  const result = runCli([
    "new",
    "Unknown Profile Test",
    "--target",
    target,
    "--profile",
    "unknown",
  ], sandbox);

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /Profil introuvable/);
  await assert.rejects(access(target));
});

test("profile list et profile show rendent les profils spécialisés découvrables", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const listed = runCli(["profile", "list"], sandbox);
  assert.equal(listed.status, 0, listed.stderr || listed.stdout);
  assert.match(listed.stdout, /generic v1/);
  assert.match(listed.stdout, /node-api v1/);
  assert.match(listed.stdout, /nextjs v1/);
  assert.match(listed.stdout, /swiftui v1/);
  assert.match(listed.stdout, /wordpress v1/);
  assert.match(listed.stdout, /Node\/API TypeScript/);
  assert.match(listed.stdout, /Next\.js TypeScript/);
  assert.match(listed.stdout, /SwiftUI Apple/);
  assert.match(listed.stdout, /WordPress/);

  const shown = runCli(["profile", "show", "node-api"], sandbox);
  assert.equal(shown.status, 0, shown.stderr || shown.stdout);
  assert.match(shown.stdout, /Commandes obligatoires : install, dev, lint, typecheck, test, build/);
  assert.match(shown.stdout, /Résultats attendus du setup/);
  assert.match(shown.stdout, /endpoint de santé minimal/);
  assert.match(shown.stdout, /package\.json \(file, blocked · existing, maintenance\)/);

  const nextjs = runCli(["profile", "show", "nextjs"], sandbox);
  assert.equal(nextjs.status, 0, nextjs.stderr || nextjs.stdout);
  assert.match(nextjs.stdout, /Alternatives de structure/);
  assert.match(nextjs.stdout, /app \(directory\) \| src\/app \(directory\)/);
  assert.match(nextjs.stdout, /dependencies\.next \| devDependencies\.next/);

  const swiftui = runCli(["profile", "show", "swiftui"], sandbox);
  assert.equal(swiftui.status, 0, swiftui.stderr || swiftui.stdout);
  assert.match(swiftui.stdout, /Structures à nom variable/);
  assert.match(swiftui.stdout, /\*\*\/\*\.xcodeproj \(directory\)/);
  assert.match(swiftui.stdout, /Preuves de contenu/);
  assert.match(swiftui.stdout, /import SwiftUI/);

  const wordpress = runCli(["profile", "show", "wordpress"], sandbox);
  assert.equal(wordpress.status, 0, wordpress.stderr || wordpress.stdout);
  assert.match(wordpress.stdout, /Commandes obligatoires selon le mode/);
  assert.match(wordpress.stdout, /lint \(existing, maintenance\)/);
  assert.match(wordpress.stdout, /Plugin Name:/);
  assert.match(wordpress.stdout, /Theme Name:/);
});

test("new avec node-api inscrit une cible technique sans générer un framework", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "new-node-api-test");
  const result = runCli([
    "new",
    "New Node API",
    "--target",
    target,
    "--profile",
    "node-api",
  ], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "node-api", version: 1 });
  assert.deepEqual(config.commands, {
    install: "npm install",
    dev: "npm run dev",
    lint: "npm run lint",
    typecheck: "npm run typecheck",
    test: "npm run test",
    build: "npm run build",
  });
  await assert.rejects(access(join(app, "package.json")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_MISSING" && item.severity === "warning",
  ));
  assert.ok(!report.items.some(
    (item) => item.code === "PROFILE_PATH_MISSING" && item.severity === "blocked",
  ));
});

test("adopt reconnaît une API Node TypeScript complète sans modifier sa fixture", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-node-api");
  const workspace = join(sandbox, "existing-node-api-workspace");
  await copyFixture("existing-node-api", repository);
  const packageContent = await readFile(join(repository, "package.json"), "utf8");
  const appContent = await readFile(join(repository, "src", "app.ts"), "utf8");
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "node-api",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  assert.equal(await readFile(join(repository, "package.json"), "utf8"), packageContent);
  assert.equal(await readFile(join(repository, "src", "app.ts"), "utf8"), appContent);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "node-api", version: 1 });
  assert.equal(config.commands.typecheck, "npm run typecheck");
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(!report.items.some((item) => item.code === "PROFILE_PATH_MISSING"));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_COMMANDS" && item.severity === "ok",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_JSON_FIELDS" && item.severity === "ok",
  ));
});

test("adopt avec node-api bloque un dépôt qui ne démontre pas son contrat", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "incomplete-node-api");
  const workspace = join(sandbox, "incomplete-node-api-workspace");
  await copyFixture("existing-node-api", repository);
  const packagePath = join(repository, "package.json");
  const packageJson = YAML.parse(await readFile(packagePath, "utf8"));
  delete packageJson.scripts.typecheck;
  delete packageJson.engines;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await rm(join(repository, "tsconfig.json"));
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "node-api",
  ], sandbox);
  assert.equal(adopted.status, 2, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "PROFILE_COMMANDS"));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_JSON_FIELDS" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_MISSING" && item.path.endsWith("tsconfig.json"),
  ));
});

test("new avec nextjs inscrit une cible adaptable sans générer le framework", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "new-nextjs-test");
  const result = runCli([
    "new",
    "New Next.js App",
    "--target",
    target,
    "--profile",
    "nextjs",
  ], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "nextjs", version: 1 });
  assert.equal(config.commands.build, "npm run build");
  await assert.rejects(access(join(app, "package.json")));
  await assert.rejects(access(join(app, "app")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_ALTERNATIVE" && item.severity === "warning",
  ));
  assert.ok(!report.items.some(
    (item) => item.code === "PROFILE_PATH_ALTERNATIVE" && item.severity === "blocked",
  ));
});

test("adopt reconnaît une application Next.js App Router sans exiger next.config", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-nextjs-app");
  const workspace = join(sandbox, "existing-nextjs-workspace");
  await copyFixture("existing-nextjs-app", repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "nextjs",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  await assert.rejects(access(join(repository, "next.config.ts")));

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "nextjs", version: 1 });
  assert.equal(config.commands.dev, "npm run dev");
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_ALTERNATIVE" && item.severity === "ok",
  ));
  assert.equal(
    report.items.filter(
      (item) => item.code === "PROFILE_JSON_ALTERNATIVE" && item.severity === "ok",
    ).length,
    3,
  );
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît aussi une application Next.js Pages Router", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-nextjs-pages");
  const workspace = join(sandbox, "existing-nextjs-pages-workspace");
  await copyFixture("existing-nextjs-app", repository);
  await rm(join(repository, "app"), { recursive: true });
  await mkdir(join(repository, "pages"));
  await writeFile(
    join(repository, "pages", "index.tsx"),
    "export default function HomePage() { return <main>Pages Router</main>; }\n",
  );
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "nextjs",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_ALTERNATIVE" && /pages/.test(item.message),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt avec nextjs bloque une application qui ne démontre plus son contrat", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "incomplete-nextjs");
  const workspace = join(sandbox, "incomplete-nextjs-workspace");
  await copyFixture("existing-nextjs-app", repository);
  await rm(join(repository, "app"), { recursive: true });
  const packagePath = join(repository, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  delete packageJson.dependencies.next;
  delete packageJson.scripts.test;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "nextjs",
  ], sandbox);
  assert.equal(adopted.status, 2, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_PATH_ALTERNATIVE" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_JSON_ALTERNATIVE" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_COMMANDS" && item.severity === "blocked",
  ));
});

test("new avec swiftui inscrit une cible Apple sans inventer de projet ni de commande", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "new-swiftui-test");
  const result = runCli([
    "new",
    "New SwiftUI App",
    "--target",
    target,
    "--profile",
    "swiftui",
  ], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "swiftui", version: 1 });
  assert.deepEqual(config.commands, {
    install: null,
    dev: null,
    lint: null,
    typecheck: null,
    test: null,
    build: null,
  });
  const generatedEntries = await readdir(app);
  assert.ok(!generatedEntries.some((entry) => entry.endsWith(".xcodeproj")));
  assert.ok(!generatedEntries.includes("Package.swift"));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && item.severity === "warning",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && item.severity === "warning",
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît une application SwiftUI dans un projet Xcode au nom variable", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-swiftui-xcode");
  const workspace = join(sandbox, "existing-swiftui-xcode-workspace");
  await copyFixture("existing-swiftui-xcode", repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "swiftui",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "swiftui", version: 1 });
  assert.equal(config.commands.build, null);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && /Fixture App\.xcodeproj/.test(item.message),
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && /Utilisation de SwiftUI/.test(item.message),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît aussi une application SwiftUI décrite par Package.swift", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-swiftui-package");
  const workspace = join(sandbox, "existing-swiftui-package-workspace");
  await copyFixture("existing-swiftui-package", repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "swiftui",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && /Package\.swift/.test(item.message),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt avec swiftui ignore les artefacts générés et bloque les fausses preuves", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "incomplete-swiftui");
  const workspace = join(sandbox, "incomplete-swiftui-workspace");
  await copyFixture("existing-swiftui-xcode", repository);
  await rm(join(repository, "Fixture App.xcodeproj"), { recursive: true });
  await rm(join(repository, "FixtureApp"), { recursive: true });
  await writeFile(join(repository, "Source.swift"), "import Foundation\n");
  await mkdir(join(repository, ".build", "Fake.xcodeproj"), { recursive: true });
  await writeFile(
    join(repository, ".build", "Fake.swift"),
    "import SwiftUI\n@main struct FakeApp: App { var body: some Scene { WindowGroup { Text(\"Fake\") } } }\n",
  );
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "swiftui",
  ], sandbox);
  assert.equal(adopted.status, 2, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && item.severity === "blocked",
  ));
});

test("new avec wordpress conserve le choix entre site, extension et thème", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "new-wordpress-test");
  const result = runCli([
    "new",
    "New WordPress Project",
    "--target",
    target,
    "--profile",
    "wordpress",
  ], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.profile, { id: "wordpress", version: 1 });
  assert.equal(config.commands.lint, null);
  assert.equal(config.commands.test, null);
  assert.ok(!(await readdir(app)).some((entry) => entry.endsWith(".php")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && item.severity === "warning",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && item.severity === "warning",
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît une extension WordPress et combine Composer avec Node", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-wordpress-plugin");
  const workspace = join(sandbox, "existing-wordpress-plugin-workspace");
  await copyFixture("existing-wordpress-plugin", repository);
  const pluginContent = await readFile(
    join(repository, "universal-starter-plugin.php"),
    "utf8",
  );
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "wordpress",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  assert.equal(
    await readFile(join(repository, "universal-starter-plugin.php"), "utf8"),
    pluginContent,
  );

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.commands.install, "composer install && npm install");
  assert.equal(config.commands.dev, "npm run dev");
  assert.equal(config.commands.lint, "composer run lint && npm run lint");
  assert.equal(config.commands.typecheck, "composer run analyze");
  assert.equal(config.commands.test, "composer run test && npm run test");
  assert.equal(config.commands.build, "npm run build");
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && /Signature WordPress/.test(item.message),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît un thème WordPress par son en-tête style.css", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-wordpress-theme");
  const workspace = join(sandbox, "existing-wordpress-theme-workspace");
  await copyFixture("existing-wordpress-theme", repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "wordpress",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.commands.install, "npm install");
  assert.equal(config.commands.lint, "npm run lint");
  assert.equal(config.commands.test, "npm run test");
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && item.path.endsWith("style.css"),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt reconnaît un site WordPress sans exiger wp-config.php", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing-wordpress-site");
  const workspace = join(sandbox, "existing-wordpress-site-workspace");
  await copyFixture("existing-wordpress-site", repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "wordpress",
  ], sandbox);
  assert.equal(adopted.status, 0, adopted.stderr || adopted.stdout);
  await assert.rejects(access(join(repository, "wp-config.php")));
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.commands.install, "composer install");
  assert.equal(config.commands.lint, "composer run lint");
  assert.equal(config.commands.test, "composer run test");
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && /wp-includes\/version\.php/.test(item.message),
  ));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));
});

test("adopt avec wordpress ignore vendor et bloque une fausse extension", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "incomplete-wordpress-plugin");
  const workspace = join(sandbox, "incomplete-wordpress-workspace");
  await copyFixture("existing-wordpress-plugin", repository);
  await rm(join(repository, "universal-starter-plugin.php"));
  await rm(join(repository, "tests"), { recursive: true });
  await rm(join(repository, "phpunit.xml.dist"));
  await mkdir(join(repository, "vendor"));
  await writeFile(
    join(repository, "vendor", "fake-plugin.php"),
    "<?php\n/* Plugin Name: Fausse preuve générée */\n",
  );
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });

  const adopted = runCli([
    "adopt",
    repository,
    "--workspace",
    workspace,
    "--profile",
    "wordpress",
  ], sandbox);
  assert.equal(adopted.status, 2, adopted.stderr || adopted.stdout);
  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_MATCH_ALTERNATIVE" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_TEXT_MATCH" && item.severity === "blocked",
  ));
  assert.ok(report.items.some(
    (item) => item.code === "PROFILE_COMMANDS" && item.severity === "ok",
  ));
});

test("adapter add codex configure le workspace privé sans toucher au dépôt", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "codex-adapter-test");
  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const created = runCli(["new", "Codex Adapter Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const added = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(added.status, 0, added.stderr || added.stdout);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, [{ id: "codex", version: 4 }]);
  const agentsInstructions = await readFile(join(workspace, "AGENTS.md"), "utf8");
  assert.match(agentsInstructions, /Code du produit : `\.\.\/app`/);
  const codexConfig = await readFile(join(workspace, ".codex", "config.toml"), "utf8");
  assert.match(codexConfig, /sandbox_mode = "workspace-write"/);
  assert.match(codexConfig, /network_access = false/);
  assert.ok(codexConfig.includes(await realpath(app)));
  await access(join(workspace, ".agents", "skills"));
  await access(join(workspace, ".codex", "agents"));
  await assert.rejects(access(join(app, "AGENTS.md")));
  await assert.rejects(access(join(app, ".codex")));

  const repeated = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
  assert.match(repeated.stdout, /déjà configuré/);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "ADAPTER_VALID"));
});

test("adapter add protège un AGENTS.md déjà rédigé", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "adapter-conflict-test");
  const workspace = join(target, "ai-workspace");
  const created = runCli(["new", "Adapter Conflict Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  const personalInstructions = "# Mes instructions personnelles\n";
  await writeFile(join(workspace, "AGENTS.md"), personalInstructions);

  const result = runCli(["adapter", "add", "codex", workspace], sandbox);

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /refuse d'écraser/);
  assert.equal(await readFile(join(workspace, "AGENTS.md"), "utf8"), personalInstructions);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, []);
});

test("doctor bloque une version d'adaptateur incompatible", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "adapter-version-test");
  const workspace = join(target, "ai-workspace");
  const created = runCli(["new", "Adapter Version Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  const added = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(added.status, 0, added.stderr || added.stdout);

  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  config.adapters[0].version = 99;
  await writeFile(configPath, YAML.stringify(config));

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "ADAPTER_VERSION"));
});

test("adapter upgrade reprend un projet Claude v3 puis permet de passer à Codex", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "adapter-upgrade-switch-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Adapter Upgrade Switch", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);
  await simulateClaudeAdapterV3(workspace);

  const stateBefore = await readFile(join(workspace, "PROJECT_STATE.md"), "utf8");
  const blocked = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(blocked.status, 2);
  assert.ok(JSON.parse(blocked.stdout).items.some((item) => item.code === "ADAPTER_VERSION"));

  const upgraded = runCli(["adapter", "upgrade", "claude-code", workspace], sandbox);
  assert.equal(upgraded.status, 0, upgraded.stderr || upgraded.stdout);
  assert.match(upgraded.stdout, /v3 → v4/);
  assert.match(await readFile(join(workspace, "CLAUDE.md"), "utf8"), /## Backlog et roadmap/);

  const codex = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(codex.status, 0, codex.stderr || codex.stdout);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, [
    { id: "claude-code", version: 4 },
    { id: "codex", version: 4 },
  ]);
  assert.equal(
    await readFile(join(workspace, "PROJECT_STATE.md"), "utf8"),
    stateBefore,
    "changer d'environnement ne réécrit jamais l'état canonique du projet",
  );
  await access(join(workspace, "AGENTS.md"));
  await access(join(workspace, ".codex", "config.toml"));
});

test("adapter upgrade protège une sortie personnalisée sauf --force explicite", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "adapter-upgrade-conflict-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Adapter Upgrade Conflict", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);
  await simulateClaudeAdapterV3(workspace);

  const instructionsPath = join(workspace, "CLAUDE.md");
  const customized = `${await readFile(instructionsPath, "utf8")}\n## Note personnelle\nConserver ceci.\n`;
  await writeFile(instructionsPath, customized);

  const refused = runCli(["adapter", "upgrade", "claude-code", workspace], sandbox);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /modifié|--force/);
  assert.equal(await readFile(instructionsPath, "utf8"), customized);
  let config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.adapters[0].version, 3);

  const forced = runCli(
    ["adapter", "upgrade", "claude-code", workspace, "--force"],
    sandbox,
  );
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.doesNotMatch(await readFile(instructionsPath, "utf8"), /Note personnelle/);
  config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.adapters[0].version, 4);
});

test("adapter add refuse qu'un lien symbolique fasse sortir ses fichiers du workspace", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "adapter-symlink-test");
  const workspace = join(target, "ai-workspace");
  const outside = join(sandbox, "outside");
  const created = runCli(["new", "Adapter Symlink Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  await mkdir(outside);
  try {
    await symlink(outside, join(workspace, ".codex"), "dir");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      t.skip("Les liens symboliques ne sont pas autorisés sur cette plateforme.");
      return;
    }
    throw error;
  }

  const result = runCli(["adapter", "add", "codex", workspace], sandbox);

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /sort du workspace/);
  await assert.rejects(access(join(outside, "config.toml")));
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, []);
});

test("adapter add claude-code configure mémoire, permissions, skills et agents", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "claude-adapter-test");
  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const created = runCli(["new", "Claude Adapter Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const added = runCli(["adapter", "add", "claude-code", workspace], sandbox);
  assert.equal(added.status, 0, added.stderr || added.stdout);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, [{ id: "claude-code", version: 4 }]);
  const instructions = await readFile(join(workspace, "CLAUDE.md"), "utf8");
  assert.match(instructions, /Code du produit : `\.\.\/app`/);
  assert.doesNotMatch(instructions, /\{\{/);
  const settings = JSON.parse(
    await readFile(join(workspace, ".claude", "settings.json"), "utf8"),
  );
  assert.equal(settings.$schema, "https://json.schemastore.org/claude-code-settings.json");
  assert.deepEqual(settings.permissions.additionalDirectories, [await realpath(app)]);
  assert.equal(settings.permissions.defaultMode, "default");
  assert.equal(settings.permissions.disableBypassPermissionsMode, "disable");
  assert.ok(settings.permissions.deny.includes("Read(//**/.env)"));
  assert.ok(!settings.permissions.deny.includes("Read(//**/.env.*)"));
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(settings.sandbox.autoAllowBashIfSandboxed, false);
  assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
  await access(join(workspace, ".claude", "skills"));
  await access(join(workspace, ".claude", "agents"));
  await assert.rejects(access(join(app, "CLAUDE.md")));
  await assert.rejects(access(join(app, ".claude")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "ADAPTER_VALID" && item.message.includes("Claude Code"),
  ));
});

test("les adaptateurs Codex et Claude Code coexistent sans modifier le cœur", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "multi-adapter-test");
  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  const created = runCli(["new", "Multi Adapter Test", "--target", target], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  const codex = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(codex.status, 0, codex.stderr || codex.stdout);
  const claude = runCli(["adapter", "add", "claude-code", workspace], sandbox);
  assert.equal(claude.status, 0, claude.stderr || claude.stdout);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.adapters, [
    { id: "codex", version: 4 },
    { id: "claude-code", version: 4 },
  ]);
  await access(join(workspace, "AGENTS.md"));
  await access(join(workspace, "CLAUDE.md"));
  await access(join(workspace, ".codex", "config.toml"));
  await access(join(workspace, ".claude", "settings.json"));
  await assert.rejects(access(join(app, "AGENTS.md")));
  await assert.rejects(access(join(app, "CLAUDE.md")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.equal(
    report.items.filter((item) => item.code === "ADAPTER_VALID").length,
    2,
  );
});

test("skill add installe une source unique et les copies natives des deux assistants", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-multi-adapter-test");
  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  assert.equal(runCli(["new", "Skill Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-discover", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.match(installed.stdout, /Copies d'assistant actualisées : 2/);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.skills.length, 1);
  assert.equal(config.skills[0].id, "project-discover");
  assert.equal(config.skills[0].version, 5);
  assert.match(config.skills[0].source_hash, /^[a-f0-9]{64}$/);

  const source = await readFile(
    join(workspace, "skills", "project-discover", "SKILL.md"),
    "utf8",
  );
  assert.equal(
    await readFile(join(workspace, ".agents", "skills", "project-discover", "SKILL.md"), "utf8"),
    source,
  );
  assert.equal(
    await readFile(join(workspace, ".claude", "skills", "project-discover", "SKILL.md"), "utf8"),
    source,
  );
  await assert.rejects(access(join(app, "skills")));

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.equal(
    report.items.filter((item) => item.code === "SKILL_REPLICA_VALID").length,
    2,
  );
});

test("skill sync propage une personnalisation de la source canonique", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-sync-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Sync Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-discover", workspace], sandbox).status, 0);

  const sourcePath = join(workspace, "skills", "project-discover", "SKILL.md");
  const customized = `${await readFile(sourcePath, "utf8")}\n## Règle locale\n\nToujours demander la contrainte budgétaire.\n`;
  await writeFile(sourcePath, customized);

  const before = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(before.status, 2, before.stderr || before.stdout);
  const beforeReport = JSON.parse(before.stdout);
  assert.ok(beforeReport.items.some((item) => item.code === "SKILL_SOURCE_CHANGED"));
  assert.ok(beforeReport.items.some((item) => item.code === "SKILL_REPLICA_DRIFT"));

  const synchronized = runCli(["skill", "sync", workspace], sandbox);
  assert.equal(synchronized.status, 0, synchronized.stderr || synchronized.stdout);
  assert.match(synchronized.stdout, /Copies d'assistant actualisées : 1/);
  assert.equal(
    await readFile(join(workspace, ".agents", "skills", "project-discover", "SKILL.md"), "utf8"),
    customized,
  );
});

test("skill sync protège une copie native modifiée séparément", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-conflict-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Conflict Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-discover", workspace], sandbox).status, 0);

  const replicaPath = join(workspace, ".agents", "skills", "project-discover", "SKILL.md");
  const sourcePath = join(workspace, "skills", "project-discover", "SKILL.md");
  await writeFile(replicaPath, `${await readFile(replicaPath, "utf8")}\nModification directe\n`);

  const refused = runCli(["skill", "sync", workspace], sandbox);
  assert.equal(refused.status, 2, refused.stderr || refused.stdout);
  assert.match(refused.stderr, /modifiée séparément/);

  const forced = runCli(["skill", "sync", workspace, "--force"], sandbox);
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.equal(await readFile(replicaPath, "utf8"), await readFile(sourcePath, "utf8"));
});

test("skill upgrade est un no-op sûr quand la version est déjà à jour", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-upgrade-noop-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Upgrade Noop Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-discover", workspace], sandbox).status, 0);

  const result = runCli(["skill", "upgrade", "project-discover", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /déjà en v5/);
});

test("skill upgrade refuse d'écraser une source modifiée sans --force, puis réussit avec --force", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-upgrade-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Upgrade Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-setup", workspace], sandbox).status, 0);

  // Simule un workspace resté sur l'ancienne v2 de project-setup avant la mise à niveau du starter :
  // la source réellement installée est la v7 courante, mais project.yaml prétend encore v2 avec
  // une empreinte différente (comme si la source locale avait divergé depuis).
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  const reference = config.skills.find((skill) => skill.id === "project-setup");
  reference.version = 2;
  reference.source_hash = "0".repeat(64);
  await writeFile(configPath, YAML.stringify(config));

  const before = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(before.status, 2, before.stderr || before.stdout);
  const beforeReport = JSON.parse(before.stdout);
  assert.ok(beforeReport.items.some((item) => item.code === "SKILL_VERSION"));

  const refused = runCli(["skill", "upgrade", "project-setup", workspace], sandbox);
  assert.equal(refused.status, 2, refused.stderr || refused.stdout);
  assert.match(refused.stderr, /modifiée depuis son installation/);

  const forced = runCli(["skill", "upgrade", "project-setup", workspace, "--force"], sandbox);
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.match(forced.stdout, /v2 → v7/);

  const after = runCli(["doctor", workspace, "--json"], sandbox);
  const afterReport = JSON.parse(after.stdout);
  assert.ok(!afterReport.items.some((item) => item.code === "SKILL_VERSION"));
  assert.ok(!afterReport.items.some((item) => item.code === "SKILL_REPLICA_DRIFT"));

  const upgradedConfig = YAML.parse(await readFile(configPath, "utf8"));
  const upgradedReference = upgradedConfig.skills.find((skill) => skill.id === "project-setup");
  assert.equal(upgradedReference.version, 7);
  assert.notEqual(upgradedReference.source_hash, "0".repeat(64));
});

test("skill upgrade --all met à niveau tous les skills obsolètes d'un workspace", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-upgrade-all-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Upgrade All Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-setup", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-work", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-discover", workspace], sandbox).status, 0);

  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  for (const id of ["project-setup", "project-work"]) {
    const reference = config.skills.find((skill) => skill.id === id);
    reference.version -= 1;
    reference.source_hash = "0".repeat(64);
  }
  config.starter_version = "0.12.0";
  await writeFile(configPath, YAML.stringify(config));

  const result = runCli(["skill", "upgrade", "--all", workspace, "--force"], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /project-setup : v6 → v7/);
  assert.match(result.stdout, /project-work : v3 → v4/);
  assert.match(result.stdout, /project-discover : déjà en v5/);
  assert.match(result.stdout, /starter_version du workspace : 0\.12\.0 → 0\.25\.1/);

  const after = runCli(["doctor", workspace, "--json"], sandbox);
  const afterReport = JSON.parse(after.stdout);
  assert.ok(!afterReport.items.some((item) => item.code === "SKILL_VERSION"));

  const upgradedConfig = YAML.parse(await readFile(configPath, "utf8"));
  assert.equal(upgradedConfig.starter_version, "0.25.1");
});

test("skill upgrade --all ne touche pas starter_version quand une mise à niveau échoue", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-upgrade-all-partial-failure-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Upgrade All Partial Failure Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-setup", workspace], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-work", workspace], sandbox).status, 0);

  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  for (const id of ["project-setup", "project-work"]) {
    const reference = config.skills.find((skill) => skill.id === id);
    reference.version -= 1;
    reference.source_hash = "0".repeat(64);
  }
  config.starter_version = "0.12.0";
  await writeFile(configPath, YAML.stringify(config));

  // Sans --force : project-setup et project-work refusent tous deux, faute d'empreinte correspondante.
  const result = runCli(["skill", "upgrade", "--all", workspace], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stdout, /project-setup : ÉCHEC/);
  assert.match(result.stdout, /project-work : ÉCHEC/);
  assert.match(result.stdout, /starter_version du workspace inchangé/);

  const untouchedConfig = YAML.parse(await readFile(configPath, "utf8"));
  assert.equal(untouchedConfig.starter_version, "0.12.0");
  const reference = untouchedConfig.skills.find((skill) => skill.id === "project-setup");
  assert.equal(reference.version, 6);
});

test("skill upgrade --all avance starter_version même si tous les skills étaient déjà à jour", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-upgrade-all-stale-starter-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Upgrade All Stale Starter Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["skill", "add", "project-discover", workspace], sandbox).status, 0);

  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  config.starter_version = "0.12.0";
  await writeFile(configPath, YAML.stringify(config));

  const result = runCli(["skill", "upgrade", "--all", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /project-discover : déjà en v5/);
  assert.match(result.stdout, /starter_version du workspace : 0\.12\.0 → 0\.25\.1/);

  const upgradedConfig = YAML.parse(await readFile(configPath, "utf8"));
  assert.equal(upgradedConfig.starter_version, "0.25.1");
});

test("adapter add déploie les skills déjà installés", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "skill-before-adapter-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Skill Before Adapter", "--target", target], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-discover", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.match(installed.stdout, /Copies d'assistant actualisées : 0/);

  const adapter = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(adapter.status, 0, adapter.stderr || adapter.stdout);
  await access(join(workspace, ".agents", "skills", "project-discover", "SKILL.md"));
});

test("les agents Builder et Independent Reviewer restent optionnels et sont traduits pour les deux assistants", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "agent-multi-adapter-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Agent Test", "--target", target], sandbox).status, 0);

  const initialConfig = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(initialConfig.agents, []);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);

  const listed = runCli(["agent", "list"], sandbox);
  assert.equal(listed.status, 0, listed.stderr || listed.stdout);
  assert.match(listed.stdout, /builder v1/);
  assert.match(listed.stdout, /independent-reviewer v1/);

  const builder = runCli(["agent", "add", "builder", workspace], sandbox);
  assert.equal(builder.status, 0, builder.stderr || builder.stdout);
  assert.match(builder.stdout, /Copies d'assistant actualisées : 2/);
  const reviewer = runCli(["agent", "add", "independent-reviewer", workspace], sandbox);
  assert.equal(reviewer.status, 0, reviewer.stderr || reviewer.stdout);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.agents.map((agent) => [agent.id, agent.origin]), [
    ["builder", "starter"],
    ["independent-reviewer", "starter"],
  ]);
  for (const agent of config.agents) {
    assert.match(agent.source_hash, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(agent.replicas).sort(), ["claude-code", "codex"]);
  }

  const codexBuilder = await readFile(join(workspace, ".codex", "agents", "builder.toml"), "utf8");
  assert.match(codexBuilder, /name = "builder"/);
  assert.match(codexBuilder, /sandbox_mode = "workspace-write"/);
  assert.match(codexBuilder, /network_access = false/);
  assert.match(codexBuilder, /developer_instructions = /);
  assert.doesNotMatch(codexBuilder, /^model = /m);

  const codexReviewer = await readFile(
    join(workspace, ".codex", "agents", "independent-reviewer.toml"),
    "utf8",
  );
  assert.match(codexReviewer, /sandbox_mode = "read-only"/);
  assert.match(codexReviewer, /constats priorisés/);

  const claudeBuilder = await readFile(join(workspace, ".claude", "agents", "builder.md"), "utf8");
  assert.match(claudeBuilder, /permissionMode: default/);
  assert.match(claudeBuilder, /- Write/);
  assert.match(claudeBuilder, /- Edit/);
  assert.match(claudeBuilder, /model: inherit/);

  const claudeReviewer = await readFile(
    join(workspace, ".claude", "agents", "independent-reviewer.md"),
    "utf8",
  );
  assert.match(claudeReviewer, /permissionMode: plan/);
  assert.doesNotMatch(claudeReviewer, /- Write/);
  assert.doesNotMatch(claudeReviewer, /- Edit/);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.equal(
    report.items.filter((item) => item.code === "AGENT_REPLICA_VALID").length,
    4,
  );
});

test("agent create protège une source personnelle et ne l'active qu'après synchronisation explicite", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "user-agent-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "User Agent Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);

  const created = runCli(["agent", "create", "domain-expert", workspace], sandbox);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  assert.match(created.stdout, /désactivé/);
  const sourcePath = join(workspace, "agents", "domain-expert");
  const manifestPath = join(sourcePath, "agent.yaml");
  const instructionsPath = join(sourcePath, "instructions.md");
  const manifest = YAML.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.enabled, false);
  await assert.rejects(access(join(workspace, ".codex", "agents", "domain-expert.toml")));

  const personalManifest = await readFile(
    join(fixturesRoot, "domain-expert-agent", "agent.yaml"),
    "utf8",
  );
  const personalInstructions = await readFile(
    join(fixturesRoot, "domain-expert-agent", "instructions.md"),
    "utf8",
  );
  await writeFile(manifestPath, personalManifest);
  await writeFile(instructionsPath, personalInstructions);

  const synchronized = runCli(["agent", "sync", workspace], sandbox);
  assert.equal(synchronized.status, 0, synchronized.stderr || synchronized.stdout);
  const native = await readFile(join(workspace, ".codex", "agents", "domain-expert.toml"), "utf8");
  assert.match(native, /Analyser uniquement les documents transmis/);
  assert.equal(await readFile(instructionsPath, "utf8"), personalInstructions);

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.equal(config.agents[0].origin, "user");
  assert.match(config.agents[0].replicas.codex, /^[a-f0-9]{64}$/);
});

test("agent sync bloque une fixture qui tente de s'accorder une approbation humaine", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "invalid-agent-fixture-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Invalid Agent Fixture", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["agent", "create", "invalid-agent", workspace], sandbox).status, 0);

  const sourcePath = join(workspace, "agents", "invalid-agent");
  await writeFile(
    join(sourcePath, "agent.yaml"),
    await readFile(join(fixturesRoot, "invalid-agent", "agent.yaml"), "utf8"),
  );
  await writeFile(
    join(sourcePath, "instructions.md"),
    await readFile(join(fixturesRoot, "invalid-agent", "instructions.md"), "utf8"),
  );

  const synchronized = runCli(["agent", "sync", workspace], sandbox);
  assert.equal(synchronized.status, 2, synchronized.stderr || synchronized.stdout);
  assert.match(synchronized.stderr, /brief_approval/);
  await assert.rejects(access(join(workspace, ".codex", "agents", "invalid-agent.toml")));
});

test("agent sync refuse d'écraser une copie native modifiée séparément", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "agent-conflict-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Agent Conflict Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);
  assert.equal(runCli(["agent", "add", "builder", workspace], sandbox).status, 0);

  const replicaPath = join(workspace, ".codex", "agents", "builder.toml");
  await writeFile(replicaPath, `${await readFile(replicaPath, "utf8")}\n# Modification directe\n`);
  const refused = runCli(["agent", "sync", workspace], sandbox);
  assert.equal(refused.status, 2, refused.stderr || refused.stdout);
  assert.match(refused.stderr, /modifié séparément/);

  const forced = runCli(["agent", "sync", workspace, "--force"], sandbox);
  assert.equal(forced.status, 0, forced.stderr || forced.stdout);
  assert.doesNotMatch(await readFile(replicaPath, "utf8"), /Modification directe/);
});

test("adapter add déploie les agents déjà installés", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "agent-before-adapter-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Agent Before Adapter", "--target", target], sandbox).status, 0);

  const installed = runCli(["agent", "add", "builder", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.match(installed.stdout, /Copies d'assistant actualisées : 0/);
  const adapter = runCli(["adapter", "add", "codex", workspace], sandbox);
  assert.equal(adapter.status, 0, adapter.stderr || adapter.stdout);
  await access(join(workspace, ".codex", "agents", "builder.toml"));
});

test("project-discover accepte un projet existant et limite la découverte aux lacunes", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "existing");
  const workspace = join(sandbox, "existing-workspace");
  await mkdir(repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });
  assert.equal(runCli(["adopt", repository, "--workspace", workspace], sandbox).status, 0);

  const result = runCli(["skill", "add", "project-discover", workspace], sandbox);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const source = await readFile(join(workspace, "skills", "project-discover", "SKILL.md"), "utf8");
  assert.match(source, /Ne pas refaire/);
  assert.match(source, /existants/);
});

test("project-handoff est installable comme skill universel", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "handoff-skill-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Handoff Skill Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);

  const listed = runCli(["skill", "list"], sandbox);
  assert.equal(listed.status, 0, listed.stderr || listed.stdout);
  assert.match(listed.stdout, /project-discover v5/);
  assert.match(listed.stdout, /project-handoff v4/);
  assert.match(listed.stdout, /project-setup v7/);
  assert.match(listed.stdout, /project-plan v5/);
  assert.match(listed.stdout, /project-work v4/);
  assert.match(listed.stdout, /project-ship v5/);

  const installed = runCli(["skill", "add", "project-handoff", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  await access(join(workspace, "skills", "project-handoff", "SKILL.md"));
  await access(join(workspace, ".agents", "skills", "project-handoff", "SKILL.md"));
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.skills.map((skill) => skill.id), ["project-handoff"]);
});

test("doctor bloque une fausse approbation sans identité humaine", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "approval-identity-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Approval Identity Test", "--target", target], sandbox).status, 0);

  const briefPath = join(workspace, "PROJECT_BRIEF.md");
  const brief = (await readFile(briefPath, "utf8"))
    .replace("status: draft", "status: approved")
    .replace("approved_at: null", "approved_at: 2026-08-04");
  await writeFile(briefPath, brief);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 2, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "APPROVAL_IDENTITY"));
  assert.ok(!report.items.some((item) => item.code === "APPROVAL_DATE"));
});

test("doctor bloque des métadonnées d'approbation conservées sur un brouillon", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "draft-approval-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Draft Approval Test", "--target", target], sandbox).status, 0);

  const briefPath = join(workspace, "PROJECT_BRIEF.md");
  const brief = (await readFile(briefPath, "utf8"))
    .replace("approved_by: null", "approved_by: Kelly")
    .replace("approved_at: null", "approved_at: 2026-08-04");
  await writeFile(briefPath, brief);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 2, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "DRAFT_APPROVAL_METADATA"));
});

test("doctor refuse une date d'approbation impossible", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "approval-date-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Approval Date Test", "--target", target], sandbox).status, 0);

  const briefPath = join(workspace, "PROJECT_BRIEF.md");
  const brief = (await readFile(briefPath, "utf8"))
    .replace("status: draft", "status: approved")
    .replace("approved_by: null", "approved_by: Kelly")
    .replace("approved_at: null", "approved_at: 2026-02-30");
  await writeFile(briefPath, brief);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 2, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "APPROVAL_DATE"));
});

test("doctor n'exige aucun backlog ni stratégie d'agents quand project-plan n'est pas installé", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "plan-absent-test");

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.code?.startsWith("BACKLOG_")));
  assert.ok(!report.items.some((item) => item.code?.startsWith("AGENT_STRATEGY_")));
});

test("doctor accepte un backlog brouillon structurellement cohérent", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-draft-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("BACKLOG_")));
  assert.ok(report.items.some((item) => item.code === "BACKLOG_CANDIDATES_VALID"));
});

test("doctor bloque un backlog approuvé sans identité ni date", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-approval-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({ status: "approved" }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "PLAN_APPROVAL_IDENTITY"));
  assert.ok(report.items.some((item) => item.code === "PLAN_APPROVAL_DATE"));
});

test("doctor bloque un candidat selected sans unité de travail liée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-selected-empty-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "selected", rank: 1, priority: "P0", depends_on: [], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_WORK_ITEM_REQUIRED"));
});

test("doctor bloque un candidat référençant une unité de travail inexistante", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-missing-work-item-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-999"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_WORK_ITEM_MISSING"));
});

test("doctor autorise ready à référencer une unité proposed existante, comme WORK-001 du pilote", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-ready-proposed-test");
  await writeWorkItem(workspace, "WORK-001", "proposed");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("BACKLOG_")));
});

test("doctor bloque selected quand l'unité liée est encore proposed, non approuvée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-selected-proposed-test");
  await writeWorkItem(workspace, "WORK-001", "proposed");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "selected", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_SELECTION_UNAPPROVED"));
});

test("doctor autorise selected quand l'unité liée est approved", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-selected-approved-test");
  await writeWorkItem(workspace, "WORK-001", "approved");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "selected", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("BACKLOG_")));
});

test("doctor bloque des identifiants de candidats dupliqués", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-duplicate-id-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
        { id: "BLG-001", status: "candidate", rank: 2, priority: "P1", depends_on: [], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_ID_DUPLICATE"));
});

test("doctor bloque des rangs dupliqués", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-duplicate-rank-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
        { id: "BLG-002", status: "candidate", rank: 1, priority: "P1", depends_on: [], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_RANK_DUPLICATE"));
});

test("doctor bloque une dépendance autoréférente", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-self-dependency-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "candidate", rank: 1, priority: "P0", depends_on: ["BLG-001"], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_DEPENDENCY_SELF"));
});

test("doctor bloque une dépendance manquante", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-missing-dependency-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "candidate", rank: 1, priority: "P0", depends_on: ["BLG-404"], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_DEPENDENCY_MISSING"));
});

test("doctor détecte un cycle réel de dépendances entre trois candidats", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-cycle-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "candidate", rank: 1, priority: "P0", depends_on: ["BLG-003"], work_items: [] },
        { id: "BLG-002", status: "candidate", rank: 2, priority: "P0", depends_on: ["BLG-001"], work_items: [] },
        { id: "BLG-003", status: "candidate", rank: 3, priority: "P0", depends_on: ["BLG-002"], work_items: [] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_DEPENDENCY_CYCLE"));
});

test("doctor bloque un backlog approuvé référençant un brief obsolète", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-stale-brief-test");

  const briefPath = join(workspace, "PROJECT_BRIEF.md");
  const brief = (await readFile(briefPath, "utf8"))
    .replace("brief_version: 1", "brief_version: 2")
    .replace("status: draft", "status: approved")
    .replace("approved_by: null", "approved_by: Kelly")
    .replace("approved_at: null", "approved_at: 2026-08-06");
  await writeFile(briefPath, brief);

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      status: "approved",
      approved_by: "Kelly",
      approved_at: "2026-08-06",
      source_brief_version: 1,
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_BRIEF_STALE"));
});

test("doctor accepte une stratégie d'agents brouillon avec un agent personnalisé pas encore créé", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-custom-draft-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
      ],
    }),
  );
  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({
      entries: [
        { id: "STR-001", covers: ["BLG-001"], mode: "custom_agent", agent_id: "reseau-specialiste" },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("AGENT_STRATEGY_")));
  await assert.rejects(access(join(workspace, "agents", "reseau-specialiste")));
});

test("doctor bloque un agent du noyau recommandé inconnu du catalogue", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-unknown-core-agent-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({
      entries: [
        { id: "STR-001", covers: ["BLG-001"], mode: "core_agent", agent_id: "orchestrateur-inexistant" },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "AGENT_STRATEGY_UNKNOWN_CORE_AGENT"));
});

test("doctor bloque un mode conversation principale portant un identifiant d'agent", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-unexpected-agent-id-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({
      entries: [
        { id: "STR-001", covers: ["BLG-001"], mode: "main_conversation", agent_id: "builder" },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "AGENT_STRATEGY_UNEXPECTED_AGENT_ID"));
});

test("doctor bloque une incohérence de version entre backlog et stratégie d'agents", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "plan-version-mismatch-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({ backlog_version: 2 }),
  );
  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({ source_backlog_version: 1 }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "PLAN_VERSION_MISMATCH"));
});

test("doctor bloque quand PROJECT_STATE.md affirme un plan_version sans backlog ni stratégie approuvés", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "plan-ready-claim-test");

  const statePath = join(workspace, "PROJECT_STATE.md");
  const state = (await readFile(statePath, "utf8")).replace("plan_version: null", "plan_version: 1");
  await writeFile(statePath, state);

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "PLAN_READY_BACKLOG_MISMATCH"));
  assert.ok(report.items.some((item) => item.code === "PLAN_READY_STRATEGY_MISMATCH"));
});

test("doctor confirme PLAN_READY quand backlog et stratégie approuvés correspondent à plan_version", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "plan-ready-valid-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({ status: "approved", approved_by: "Kelly", approved_at: "2026-08-06" }),
  );
  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({ status: "approved", approved_by: "Kelly", approved_at: "2026-08-06" }),
  );
  const statePath = join(workspace, "PROJECT_STATE.md");
  const state = (await readFile(statePath, "utf8")).replace("plan_version: null", "plan_version: 1");
  await writeFile(statePath, state);

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.code === "PLAN_READY_BACKLOG_MISMATCH"));
  assert.ok(!report.items.some((item) => item.code === "PLAN_READY_STRATEGY_MISMATCH"));
});

test("doctor bloque un candidat done dont l'unité liée reste proposed", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-done-proposed-test");
  await writeWorkItem(workspace, "WORK-001", "proposed");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "done", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_DONE_UNACCEPTED"));
});

test("doctor autorise un candidat done dont l'unité liée est accepted", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-done-accepted-test");
  await writeWorkItem(workspace, "WORK-001", "accepted");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "done", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("BACKLOG_")));
  assert.ok(report.items.some((item) => item.code === "BACKLOG_CANDIDATES_VALID"));
});

test("doctor bloque une même unité rattachée à deux candidats actifs", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-work-item-multiple-active-test");
  await writeWorkItem(workspace, "WORK-001", "proposed");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
        { id: "BLG-002", status: "candidate", rank: 2, priority: "P1", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_WORK_ITEM_MULTIPLE_ACTIVE"));
});

test("doctor autorise une même unité rattachée à un candidat actif et à un candidat retiré", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-work-item-retired-history-test");
  await writeWorkItem(workspace, "WORK-001", "proposed");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: ["WORK-001"] },
        { id: "BLG-002", status: "retired", rank: 2, priority: "P1", depends_on: [], work_items: ["WORK-001"] },
      ],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.code === "BACKLOG_WORK_ITEM_MULTIPLE_ACTIVE"));
  assert.ok(report.items.some((item) => item.code === "BACKLOG_CANDIDATES_VALID"));
});

test("doctor bloque une stratégie couvrant un candidat inexistant", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-candidate-missing-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
      ],
    }),
  );
  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({
      entries: [{ id: "STR-001", covers: ["BLG-999"], mode: "main_conversation", agent_id: null }],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "AGENT_STRATEGY_CANDIDATE_MISSING"));
});

test("doctor autorise une stratégie couvrant un candidat existant du backlog", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-candidate-present-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({
      candidates: [
        { id: "BLG-001", status: "ready", rank: 1, priority: "P0", depends_on: [], work_items: [] },
      ],
    }),
  );
  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({
      entries: [{ id: "STR-001", covers: ["BLG-001"], mode: "main_conversation", agent_id: null }],
    }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.items.some((item) => item.severity === "blocked" && item.code?.startsWith("AGENT_STRATEGY_")));
  assert.ok(report.items.some((item) => item.code === "AGENT_STRATEGY_ENTRIES_VALID"));
});

test("doctor bloque une stratégie d'agents présente sans backlog", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "strategy-without-backlog-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "docs", "agent-strategy.md"),
    baseStrategyAttributes({ entries: [] }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "AGENT_STRATEGY_BACKLOG_MISSING"));
});

test("doctor bloque un source_setup_report qui sort du workspace", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-setup-report-escape-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({ source_setup_report: "../../etc/passwd" }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_SETUP_REPORT_PATH"));
});

test("doctor bloque un source_setup_report absolu", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const { workspace } = await preparePlanningWorkspace(sandbox, "backlog-setup-report-absolute-test");

  await writeMarkdownWithFrontmatter(
    join(workspace, "taches", "BACKLOG.md"),
    baseBacklogAttributes({ source_setup_report: "/etc/passwd" }),
  );

  const result = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.items.some((item) => item.code === "BACKLOG_SETUP_REPORT_PATH"));
});

test("project-setup installe ses portes et modèles pour un projet neuf", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "setup-new-project-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(
    runCli(["new", "Setup New Project", "--target", target, "--entry-mode", "idea"], sandbox).status,
    0,
  );
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-setup", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  await access(join(workspace, "skills", "project-setup", "references", "setup-gates.md"));
  await access(join(workspace, "skills", "project-setup", "assets", "architecture-template.md"));
  await access(join(workspace, "skills", "project-setup", "assets", "setup-report-template.md"));
  await access(join(workspace, ".claude", "skills", "project-setup", "SKILL.md"));

  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
  assert.deepEqual(config.skills.map((skill) => skill.id), ["project-setup"]);
});

test("project-setup peut fiabiliser un dépôt existant sans adaptateur préalable", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "setup-existing-repository");
  const workspace = join(sandbox, "setup-existing-workspace");
  await mkdir(repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });
  assert.equal(runCli(["adopt", repository, "--workspace", workspace], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-setup", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert.match(installed.stdout, /Copies d'assistant actualisées : 0/);
  await access(join(workspace, "skills", "project-setup", "SKILL.md"));
  await assert.rejects(access(join(repository, "skills")));
});

test("project-work installe son contrat, ses portes et ses rapports", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "project-work-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Project Work Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "codex", workspace], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-work", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  await access(join(workspace, "skills", "project-work", "references", "work-gates.md"));
  await access(join(workspace, "skills", "project-work", "assets", "work-item-template.md"));
  await access(join(workspace, "skills", "project-work", "assets", "work-report-template.md"));
  const nativeSkill = await readFile(
    join(workspace, ".agents", "skills", "project-work", "SKILL.md"),
    "utf8",
  );
  assert.match(nativeSkill, /ready_for_acceptance/);
  assert.match(nativeSkill, /acceptation humaine/);
});

test("project-work prend en charge une maintenance explicitement adoptée", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "work-maintenance-repository");
  const workspace = join(sandbox, "work-maintenance-workspace");
  await mkdir(repository);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });
  assert.equal(
    runCli([
      "adopt",
      repository,
      "--workspace",
      workspace,
      "--entry-mode",
      "maintenance",
    ], sandbox).status,
    0,
  );

  const installed = runCli(["skill", "add", "project-work", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  await access(join(workspace, "skills", "project-work", "SKILL.md"));
  await assert.rejects(access(join(repository, "taches")));
});

test("project-ship installe son manifeste, ses portes et ses modèles de preuve", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "project-ship-test");
  const workspace = join(target, "ai-workspace");
  assert.equal(runCli(["new", "Project Ship Test", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["adapter", "add", "claude-code", workspace], sandbox).status, 0);

  const installed = runCli(["skill", "add", "project-ship", workspace], sandbox);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  await access(join(workspace, "skills", "project-ship", "references", "ship-gates.md"));
  await access(join(workspace, "skills", "project-ship", "assets", "shipment-template.md"));
  await access(join(workspace, "skills", "project-ship", "assets", "ship-report-template.md"));
  await access(join(workspace, "skills", "project-ship", "assets", "release-notes-template.md"));
  const nativeSkill = await readFile(
    join(workspace, ".claude", "skills", "project-ship", "SKILL.md"),
    "utf8",
  );
  assert.equal(nativeSkill, await readFile(join(workspace, "skills", "project-ship", "SKILL.md"), "utf8"));
  assert.match(await readFile(join(workspace, "skills", "project-ship", "references", "legacy-v014.md"), "utf8"), /ready_to_ship/);
  assert.match(nativeSkill, /preuve externe/);
});

test("doctor bloque la fuite d'un manifeste de livraison même pour un ancien projet", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "shipment-leak-test");
  const workspace = join(target, "ai-workspace");
  const app = join(target, "app");
  assert.equal(runCli(["new", "Shipment Leak Test", "--target", target], sandbox).status, 0);

  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8"));
  config.privacy.private_paths = config.privacy.private_paths.filter(
    (path) => path !== "livraisons/",
  );
  await writeFile(configPath, YAML.stringify(config));
  await mkdir(join(app, "livraisons"));
  await writeFile(join(app, "livraisons", "SHIP-001.md"), "private\n");

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 2, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some(
    (item) => item.code === "PRIVATE_LEAK" && basename(item.path) === "livraisons",
  ));
});

test("intake import archive un product-package prêt sans approuver ni réécrire le brief", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "imported-product");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "product-package");
  await copyFixture("product-package-ready", packagePath);
  assert.equal(
    runCli(["new", "Imported Product", "--target", target, "--entry-mode", "idea"], sandbox).status,
    0,
  );
  const briefBefore = await readFile(join(workspace, "PROJECT_BRIEF.md"), "utf8");
  const sourceBefore = await readFile(join(packagePath, "BUILD_HANDOFF.md"), "utf8");

  const imported = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(imported.status, 0, imported.stderr || imported.stdout);
  assert.match(imported.stdout, /Product-package importé/);
  assert.match(imported.stdout, /project-discover/);

  const archive = join(
    workspace,
    "intake",
    "product-package",
    "imported-product-pp-001",
    "v1",
  );
  await access(join(archive, "manifest.yaml"));
  await access(join(archive, "REVIEW_REPORT.md"));
  await access(join(workspace, "intake", "research", "product-package", "imported-product-pp-001-v1.md"));
  await access(join(workspace, "prototype", "product-package", "imported-product-pp-001-v1.md"));
  await access(join(workspace, "docs", "internal", "product-package", "imported-product-pp-001-v1.md"));
  await access(join(workspace, "reports", "intake", "imported-product-pp-001-v1.md"));

  const registry = YAML.parse(
    await readFile(join(workspace, "intake", "product-package", "registry.yaml"), "utf8"),
  );
  assert.equal(registry.schema_version, 1);
  assert.equal(registry.imports.length, 1);
  assert.equal(registry.imports[0].package_id, "imported-product-pp-001");
  assert.match(registry.imports[0].source_hash, /^[a-f0-9]{64}$/);

  assert.equal(await readFile(join(workspace, "PROJECT_BRIEF.md"), "utf8"), briefBefore);
  assert.equal(await readFile(join(packagePath, "BUILD_HANDOFF.md"), "utf8"), sourceBefore);
  const state = await readFile(join(workspace, "PROJECT_STATE.md"), "utf8");
  assert.match(state, /current_phase: product-package-intake/);
  assert.match(state, /brief_version: 1/);
  assert.match(state, /Dernier product-package importé/);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 1, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "PRODUCT_PACKAGE_VALID"));
  assert.ok(!report.items.some((item) => item.severity === "blocked"));

  const repeated = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
  assert.match(repeated.stdout, /déjà importé à l'identique/);
  const registryAfter = YAML.parse(
    await readFile(join(workspace, "intake", "product-package", "registry.yaml"), "utf8"),
  );
  assert.equal(registryAfter.imports.length, 1);
});

test("intake import refuse un package encore brouillon sans créer d'archive", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "draft-package-project");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "draft-package");
  await copyFixture("product-package-ready", packagePath);
  const manifestPath = join(packagePath, "manifest.yaml");
  const manifest = YAML.parse(await readFile(manifestPath, "utf8"));
  manifest.package_status = "draft";
  await writeFile(manifestPath, YAML.stringify(manifest));
  assert.equal(runCli(["new", "Imported Product", "--target", target], sandbox).status, 0);

  const imported = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(imported.status, 2, imported.stderr || imported.stdout);
  assert.match(imported.stderr, /ready_for_intake/);
  await assert.rejects(access(join(workspace, "intake", "product-package", "registry.yaml")));
});

test("intake import refuse un package destiné à un autre projet", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "other-project");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "product-package");
  await copyFixture("product-package-ready", packagePath);
  assert.equal(runCli(["new", "Other Product", "--target", target], sandbox).status, 0);

  const imported = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(imported.status, 2, imported.stderr || imported.stdout);
  assert.match(imported.stderr, /concerne « Imported Product »/);
});

test("intake import refuse les liens symboliques et secrets potentiels", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "unsafe-package-project");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "unsafe-package");
  await copyFixture("product-package-ready", packagePath);
  await symlink(join(packagePath, "PROJECT_PASSPORT.md"), join(packagePath, "passport-link.md"));
  assert.equal(runCli(["new", "Imported Product", "--target", target], sandbox).status, 0);

  const linked = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(linked.status, 2, linked.stderr || linked.stdout);
  assert.match(linked.stderr, /lien symbolique est interdit/);
  await rm(join(packagePath, "passport-link.md"));
  await writeFile(join(packagePath, ".env"), "TOKEN=secret\n");

  const secret = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(secret.status, 2, secret.stderr || secret.stdout);
  assert.match(secret.stderr, /secret potentiel est interdit/);
});

test("intake import protège un brief déjà approuvé", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "approved-brief-project");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "product-package");
  await copyFixture("product-package-ready", packagePath);
  assert.equal(runCli(["new", "Imported Product", "--target", target], sandbox).status, 0);

  const briefPath = join(workspace, "PROJECT_BRIEF.md");
  const approved = (await readFile(briefPath, "utf8"))
    .replace("status: draft", "status: approved")
    .replace("approved_by: null", "approved_by: Kelly")
    .replace("approved_at: null", "approved_at: 2026-08-05")
    .replaceAll("[à compléter]", "Défini")
    .replaceAll("[À compléter]", "Défini")
    .replaceAll("À compléter", "Défini");
  await writeFile(briefPath, approved);

  const imported = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(imported.status, 2, imported.stderr || imported.stdout);
  assert.match(imported.stderr, /brief est déjà approuvé/);
  assert.equal(await readFile(briefPath, "utf8"), approved);
});

test("intake import reste réservé aux projets idea ou brief", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const repository = join(sandbox, "imported-product");
  const workspace = join(sandbox, "existing-workspace");
  const packagePath = join(sandbox, "product-package");
  await mkdir(repository);
  await copyFixture("product-package-ready", packagePath);
  execFileSync("git", ["init", "-b", "main"], { cwd: repository, stdio: "ignore" });
  assert.equal(
    runCli(["adopt", repository, "--workspace", workspace, "--name", "Imported Product"], sandbox).status,
    0,
  );

  const imported = runCli(["intake", "import", packagePath, workspace], sandbox);
  assert.equal(imported.status, 2, imported.stderr || imported.stdout);
  assert.match(imported.stderr, /réservé aux workspaces idea ou brief/);
});

test("doctor bloque une archive product-package modifiée après import", async (t) => {
  const sandbox = await temporaryDirectory(t);
  const target = join(sandbox, "tampered-package-project");
  const workspace = join(target, "ai-workspace");
  const packagePath = join(sandbox, "product-package");
  await copyFixture("product-package-ready", packagePath);
  assert.equal(runCli(["new", "Imported Product", "--target", target], sandbox).status, 0);
  assert.equal(runCli(["intake", "import", packagePath, workspace], sandbox).status, 0);

  const archivedHandoff = join(
    workspace,
    "intake",
    "product-package",
    "imported-product-pp-001",
    "v1",
    "BUILD_HANDOFF.md",
  );
  await writeFile(archivedHandoff, `${await readFile(archivedHandoff, "utf8")}\nModification\n`);

  const diagnosed = runCli(["doctor", workspace, "--json"], sandbox);
  assert.equal(diagnosed.status, 2, diagnosed.stderr || diagnosed.stdout);
  const report = JSON.parse(diagnosed.stdout);
  assert.ok(report.items.some((item) => item.code === "PRODUCT_PACKAGE_INVALID"));
});
