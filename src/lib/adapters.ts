import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { canonicalPath, pathExists, writeFileAtomic, writeNewFile } from "./fs-safe.js";
import { adaptersRoot, schemasRoot } from "./paths.js";
import { isPathInsideOrEqual, portableRelative } from "./text.js";
import type { AdapterManifest, ProjectConfig } from "../types.js";

const adapterIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AdapterApplicationResult {
  manifest: AdapterManifest;
  workspace: string;
  alreadyConfigured: boolean;
}

export async function loadAdapter(adapterId: string): Promise<AdapterManifest> {
  return loadAdapterFromRoot(adapterId, join(adaptersRoot, adapterId));
}

async function loadAdapterFromRoot(
  adapterId: string,
  adapterRoot: string,
): Promise<AdapterManifest> {
  if (!adapterIdPattern.test(adapterId)) {
    throw new Error(`Identifiant d'adaptateur invalide : ${adapterId}`);
  }

  const manifestPath = join(adapterRoot, "adapter.yaml");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Adaptateur introuvable : ${adapterId}`);
  }

  let manifest: unknown;
  try {
    manifest = YAML.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`L'adaptateur ${adapterId} est illisible : ${messageOf(error)}`);
  }

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "adapter.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const valid = ajv.validate(schema, manifest);
  if (!valid) {
    const details = (ajv.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
      .join(" ; ");
    throw new Error(`L'adaptateur ${adapterId} ne respecte pas son schéma : ${details}`);
  }

  const typedManifest = manifest as AdapterManifest;
  if (typedManifest.adapter.id !== adapterId) {
    throw new Error(
      `Le manifeste de l'adaptateur ${adapterId} déclare l'identifiant ${typedManifest.adapter.id}.`,
    );
  }

  const outputPaths = new Set<string>();
  for (const directory of typedManifest.directories) {
    assertSafeRelativePath(adapterId, directory, "dossier");
  }
  assertSafeRelativePath(
    adapterId,
    typedManifest.skills.destination,
    "dossier de skills",
  );
  if (!typedManifest.directories.includes(typedManifest.skills.destination)) {
    throw new Error(
      `L'adaptateur ${adapterId} doit déclarer ${typedManifest.skills.destination} dans directories.`,
    );
  }
  assertSafeRelativePath(
    adapterId,
    typedManifest.agents.destination,
    "dossier d'agents",
  );
  if (!typedManifest.directories.includes(typedManifest.agents.destination)) {
    throw new Error(
      `L'adaptateur ${adapterId} doit déclarer ${typedManifest.agents.destination} dans directories.`,
    );
  }
  for (const output of typedManifest.outputs) {
    assertSafeRelativePath(adapterId, output.path, "sortie");
    assertSafeRelativePath(adapterId, output.template, "modèle");
    if (outputPaths.has(output.path)) {
      throw new Error(`L'adaptateur ${adapterId} déclare deux fois la sortie ${output.path}.`);
    }
    outputPaths.add(output.path);
  }

  return typedManifest;
}

export async function applyAdapter(
  workspacePath: string,
  adapterId: string,
): Promise<AdapterApplicationResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const manifest = await loadAdapter(adapterId);

  if (!manifest.compatibility.project_schema_versions.includes(config.schema_version)) {
    throw new Error(
      `L'adaptateur ${adapterId} n'est pas compatible avec le schéma projet v${config.schema_version}.`,
    );
  }
  if (
    !manifest.compatibility.profiles.includes("*") &&
    !manifest.compatibility.profiles.includes(config.profile.id)
  ) {
    throw new Error(
      `L'adaptateur ${adapterId} n'est pas compatible avec le profil ${config.profile.id}.`,
    );
  }

  const existing = config.adapters.find((adapter) => adapter.id === adapterId);
  if (existing) {
    if (existing.version !== manifest.adapter.version) {
      throw new Error(
        `Le projet référence ${adapterId} v${existing.version}, mais le starter fournit la v${manifest.adapter.version}.`,
      );
    }
    return { manifest, workspace, alreadyConfigured: true };
  }

  const codeRoot = await canonicalPath(resolveFromWorkspace(workspace, config.paths.code_root));
  const repositoryRoot = await canonicalPath(
    resolveFromWorkspace(workspace, config.paths.repository_root),
  );
  const variables = buildTemplateVariables(
    workspace,
    codeRoot,
    repositoryRoot,
    config.project.name,
  );

  const renderedOutputs: Array<{ path: string; content: string }> = [];
  const adapterRoot = await canonicalPath(join(adaptersRoot, adapterId));
  for (const directory of manifest.directories) {
    await assertDestinationInsideWorkspace(workspace, join(workspace, directory), adapterId);
  }
  for (const output of manifest.outputs) {
    const destination = join(workspace, output.path);
    await assertDestinationInsideWorkspace(workspace, destination, adapterId);
    if (await pathExists(destination)) {
      throw new Error(
        `L'adaptateur refuse d'écraser le fichier existant : ${destination}`,
      );
    }
    const templatePath = await canonicalPath(join(adapterRoot, output.template));
    if (!isPathInsideOrEqual(templatePath, adapterRoot)) {
      throw new Error(
        `Le modèle ${output.template} sort du dossier de l'adaptateur ${adapterId}.`,
      );
    }
    const templateDetails = await stat(templatePath).catch(() => null);
    if (!templateDetails?.isFile()) {
      throw new Error(`Modèle introuvable pour l'adaptateur ${adapterId} : ${output.template}`);
    }
    renderedOutputs.push({
      path: destination,
      content: renderTemplate(await readFile(templatePath, "utf8"), variables),
    });
  }

  const createdFiles: string[] = [];
  try {
    for (const directory of manifest.directories) {
      await mkdir(join(workspace, directory), { recursive: true });
    }
    for (const output of renderedOutputs) {
      await writeNewFile(output.path, output.content);
      createdFiles.push(output.path);
    }

    config.adapters.push({ id: adapterId, version: manifest.adapter.version });
    await writeFileAtomic(configPath, YAML.stringify(config));
  } catch (error) {
    for (const path of createdFiles) {
      await rm(path, { force: true });
    }
    throw error;
  }

  return { manifest, workspace, alreadyConfigured: false };
}

export interface AdapterUpgradeResult {
  manifest: AdapterManifest;
  workspace: string;
  previousVersion: number;
  newVersion: number;
  alreadyUpToDate: boolean;
  outputsUpdated: number;
}

/**
 * Met à niveau un adaptateur sans écraser silencieusement ses sorties user-owned.
 * La version installée est comparée au modèle historique exact. Une reprise après
 * interruption accepte aussi une sortie déjà identique au nouveau modèle.
 */
export async function upgradeAdapter(
  workspacePath: string,
  adapterId: string,
  force: boolean,
): Promise<AdapterUpgradeResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const manifest = await loadAdapter(adapterId);
  const existing = config.adapters.find((adapter) => adapter.id === adapterId);
  if (!existing) {
    throw new Error(
      `L'adaptateur ${adapterId} n'est pas installé dans ce workspace. Utiliser d'abord adapter add.`,
    );
  }
  if (existing.version === manifest.adapter.version) {
    return {
      manifest,
      workspace,
      previousVersion: existing.version,
      newVersion: existing.version,
      alreadyUpToDate: true,
      outputsUpdated: 0,
    };
  }
  if (existing.version > manifest.adapter.version) {
    throw new Error(
      `Le workspace référence ${adapterId} v${existing.version}, plus récente que la v${manifest.adapter.version} du starter.`,
    );
  }

  const currentRoot = await canonicalPath(join(adaptersRoot, adapterId));
  const previousRoot = await canonicalPath(
    join(currentRoot, "versions", `v${existing.version}`),
  );
  if (!isPathInsideOrEqual(previousRoot, currentRoot) || !(await pathExists(previousRoot))) {
    throw new Error(
      `Aucun modèle historique sûr pour ${adapterId} v${existing.version}. ` +
        "La mise à niveau automatique est refusée.",
    );
  }
  const previousManifest = await loadAdapterFromRoot(adapterId, previousRoot);
  if (previousManifest.adapter.version !== existing.version) {
    throw new Error(
      `Le modèle historique de ${adapterId} déclare la v${previousManifest.adapter.version} ` +
        `au lieu de la v${existing.version}.`,
    );
  }

  const previousOutputs = new Map(
    previousManifest.outputs.map((output) => [output.path, output]),
  );
  const currentOutputs = new Set(manifest.outputs.map((output) => output.path));
  if (
    previousManifest.outputs.some((output) => !currentOutputs.has(output.path)) ||
    manifest.outputs.some((output) => !previousOutputs.has(output.path))
  ) {
    throw new Error(
      `La structure des sorties de ${adapterId} a changé entre v${existing.version} et ` +
        `v${manifest.adapter.version}. Une migration dédiée est requise ; aucun fichier n'a été modifié.`,
    );
  }

  const codeRoot = await canonicalPath(resolveFromWorkspace(workspace, config.paths.code_root));
  const repositoryRoot = await canonicalPath(
    resolveFromWorkspace(workspace, config.paths.repository_root),
  );
  const variables = buildTemplateVariables(
    workspace,
    codeRoot,
    repositoryRoot,
    config.project.name,
  );
  const pending: Array<{ path: string; content: string }> = [];

  for (const output of manifest.outputs) {
    const destination = join(workspace, output.path);
    await assertDestinationInsideWorkspace(workspace, destination, adapterId);
    if (!(await pathExists(destination))) {
      throw new Error(
        `La sortie ${output.path} de ${adapterId} v${existing.version} est absente. ` +
          "La mise à niveau refuse d'inventer son état ; restaurer le fichier ou utiliser une migration manuelle.",
      );
    }
    const previousOutput = previousOutputs.get(output.path)!;
    const previousTemplatePath = await canonicalPath(
      join(previousRoot, previousOutput.template),
    );
    const currentTemplatePath = await canonicalPath(join(currentRoot, output.template));
    if (
      !isPathInsideOrEqual(previousTemplatePath, previousRoot) ||
      !isPathInsideOrEqual(currentTemplatePath, currentRoot)
    ) {
      throw new Error(`Un modèle de ${adapterId} sort de son dossier versionné.`);
    }

    const actual = await readFile(destination, "utf8");
    const previousContent = renderTemplate(
      await readFile(previousTemplatePath, "utf8"),
      variables,
    );
    const currentContent = renderTemplate(
      await readFile(currentTemplatePath, "utf8"),
      variables,
    );
    if (actual === currentContent) continue;
    if (actual !== previousContent && !force) {
      throw new Error(
        `${output.path} a été modifié depuis l'installation de ${adapterId} v${existing.version}. ` +
          "La mise à niveau refuse de l'écraser ; examiner les différences puis relancer avec --force uniquement si ce remplacement est voulu.",
      );
    }
    pending.push({ path: destination, content: currentContent });
  }

  for (const output of pending) {
    await writeFileAtomic(output.path, output.content);
  }
  const previousVersion = existing.version;
  existing.version = manifest.adapter.version;
  await writeFileAtomic(configPath, YAML.stringify(config));

  return {
    manifest,
    workspace,
    previousVersion,
    newVersion: manifest.adapter.version,
    alreadyUpToDate: false,
    outputsUpdated: pending.length,
  };
}

async function assertDestinationInsideWorkspace(
  workspace: string,
  destination: string,
  adapterId: string,
): Promise<void> {
  const canonicalDestination = await canonicalPath(destination);
  if (!isPathInsideOrEqual(canonicalDestination, workspace)) {
    throw new Error(
      `L'adaptateur ${adapterId} refuse un chemin qui sort du workspace : ${destination}`,
    );
  }
}

function resolveFromWorkspace(workspace: string, configuredPath: string): string {
  return isAbsolute(configuredPath)
    ? resolve(configuredPath)
    : resolve(workspace, configuredPath);
}

function assertSafeRelativePath(adapterId: string, path: string, kind: string): void {
  const normalized = normalize(path);
  if (
    !path ||
    isAbsolute(path) ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `L'adaptateur ${adapterId} contient un ${kind} dangereux : ${path}`,
    );
  }
}

function buildTemplateVariables(
  workspace: string,
  codeRoot: string,
  repositoryRoot: string,
  projectName: string,
): Record<string, string> {
  return {
    PROJECT_NAME: escapeMarkdown(projectName),
    CODE_ROOT_RELATIVE: escapeMarkdown(portableRelative(workspace, codeRoot)),
    REPOSITORY_ROOT_RELATIVE: escapeMarkdown(portableRelative(workspace, repositoryRoot)),
    CODE_ROOT_TOML: escapeToml(codeRoot),
    CODE_ROOT_JSON: JSON.stringify(codeRoot),
    WORKSPACE_ROOT_SHELL: escapeShellDoubleQuoted(workspace),
  };
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`Variable de modèle inconnue : ${match}`);
    }
    return value;
  });
}

function escapeToml(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("`", "\\`");
}

function escapeShellDoubleQuoted(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("$", "\\$")
    .replaceAll("`", "\\`");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Exact renderings of the historical `adapter add` outputs (current and archived versions) for a
 * workspace-relative path. Used to recognise an untouched legacy file before a phase workspace
 * takes ownership of it; any other content is treated as a personalization.
 */
export async function legacyAdapterRenderings(
  workspacePath: string,
  outputPath: string,
): Promise<string[]> {
  const workspace = await canonicalPath(workspacePath);
  const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8")) as ProjectConfig;
  const codeRoot = await canonicalPath(resolveFromWorkspace(workspace, config.paths.code_root));
  const repositoryRoot = await canonicalPath(
    resolveFromWorkspace(workspace, config.paths.repository_root),
  );
  const variables = buildTemplateVariables(workspace, codeRoot, repositoryRoot, config.project.name);
  const renderings: string[] = [];
  for (const adapterId of ["codex", "claude-code"]) {
    const currentRoot = await canonicalPath(join(adaptersRoot, adapterId));
    const roots = [currentRoot];
    const versions = join(currentRoot, "versions");
    if (await pathExists(versions))
      for (const entry of (await readdir(versions)).sort()) roots.push(join(versions, entry));
    for (const root of roots) {
      const manifest = await loadAdapterFromRoot(adapterId, root).catch(() => null);
      const output = manifest?.outputs.find((candidate) => candidate.path === outputPath);
      if (!output) continue;
      const template = await canonicalPath(join(root, output.template));
      if (!isPathInsideOrEqual(template, currentRoot)) continue;
      renderings.push(renderTemplate(await readFile(template, "utf8"), variables));
    }
  }
  return renderings;
}
