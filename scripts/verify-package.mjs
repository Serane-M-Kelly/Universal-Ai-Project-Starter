import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const projectTemplate = YAML.parse(
  await readFile(join(packageRoot, "core", "templates", "project.yaml"), "utf8"),
);

assert.equal(
  projectTemplate.starter_version,
  packageJson.version,
  "La version du modèle project.yaml doit suivre celle du paquet.",
);

const npmArguments = ["pack", "--dry-run", "--json", "--ignore-scripts"];
const npmExecPath = process.env.npm_execpath;
const packed = spawnSync(
  npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm",
  npmExecPath ? [npmExecPath, ...npmArguments] : npmArguments,
  { cwd: packageRoot, encoding: "utf8" },
);
if (packed.status !== 0) {
  throw new Error(packed.stderr || packed.stdout || "npm pack --dry-run a échoué.");
}

const reports = JSON.parse(packed.stdout);
assert.equal(reports.length, 1, "npm pack doit décrire un seul paquet.");
const report = reports[0];
assert.equal(report.name, packageJson.name);
assert.equal(report.version, packageJson.version);

const packagedPaths = new Set(report.files.map((file) => file.path));
const requiredPaths = [
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/commands/workflow.js",
  "dist/lib/phase-workflow.js",
  "dist/lib/phase-sources.js",
  "dist/lib/context-output.js",
  "dist/lib/workflow-models.js",
  "dist/lib/native-adapters.js",
  "dist/lib/native-switch.js",
  "core/schemas/workflow.schema.json",
  "core/contracts/phase-workflow.md",
  "core/contracts/workflow-cli.md",
  "core/contracts/search-visibility.md",
  "core/skills/project-start/SKILL.md",
  "core/skills/project-next/SKILL.md",
  "core/skills/project-phase/SKILL.md",
  "core/skills/project-review/SKILL.md",
  "dist/commands/profile.js",
  "dist/commands/intake.js",
  "dist/lib/product-package.js",
  "core/templates/project.yaml",
  "core/schemas/project.schema.json",
  "core/schemas/agent.schema.json",
  "core/schemas/product-package.schema.json",
  "core/contracts/product-package.md",
  "core/skills/project-discover/SKILL.md",
  "core/skills/project-discover/references/package-intake.md",
  "core/skills/project-handoff/SKILL.md",
  "core/skills/project-setup/SKILL.md",
  "core/skills/project-work/SKILL.md",
  "core/skills/project-ship/SKILL.md",
  "core/agents/catalog.yaml",
  "core/agents/builder/agent.yaml",
  "core/agents/builder/instructions.md",
  "core/agents/independent-reviewer/agent.yaml",
  "core/agents/independent-reviewer/instructions.md",
  "profiles/generic/profile.yaml",
  "profiles/node-api/profile.yaml",
  "profiles/node-api/README.md",
  "profiles/nextjs/profile.yaml",
  "profiles/nextjs/README.md",
  "profiles/swiftui/profile.yaml",
  "profiles/swiftui/README.md",
  "profiles/wordpress/profile.yaml",
  "profiles/wordpress/README.md",
  "adapters/codex/adapter.yaml",
  "adapters/codex/templates/AGENTS.md",
  "adapters/claude-code/adapter.yaml",
  "adapters/claude-code/templates/CLAUDE.md",
];

for (const path of requiredPaths) {
  assert.ok(packagedPaths.has(path), `Fichier requis absent du paquet : ${path}`);
}

const forbiddenPrefixes = ["src/", "tests/", "scripts/", ".github/", "node_modules/"];
for (const path of packagedPaths) {
  assert.ok(!path.endsWith(".DS_Store"), `Fichier macOS parasite distribué : ${path}`);
  assert.ok(
    !forbiddenPrefixes.some((prefix) => path.startsWith(prefix)),
    `Fichier interne distribué par erreur : ${path}`,
  );
}

console.log(
  `Paquet vérifié : ${report.name}@${report.version}, ${report.entryCount} fichiers, ${report.unpackedSize} octets décompressés.`,
);
