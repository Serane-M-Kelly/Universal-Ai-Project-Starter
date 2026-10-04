import { randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { loadAdapter } from "./adapters.js";
import { NATIVE_ADAPTERS, installedNativeAdapters } from "./native-adapters.js";
import { hashDirectory } from "./content-hash.js";
import { parseFrontmatter } from "./frontmatter.js";
import { canonicalPath, pathExists, writeFileAtomic } from "./fs-safe.js";
import { packageRoot, schemasRoot, skillsRoot } from "./paths.js";
import { isPathInsideOrEqual } from "./text.js";
import type {
  AdapterReference,
  ProjectConfig,
  SkillCatalog,
  SkillManifest,
} from "../types.js";

const skillIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SkillInstallationResult {
  manifest: SkillManifest;
  workspace: string;
  alreadyInstalled: boolean;
  replicasUpdated: number;
}

export interface SkillSynchronizationResult {
  workspace: string;
  skillsSynchronized: number;
  replicasUpdated: number;
}

export interface SkillUpgradeResult {
  workspace: string;
  skillId: string;
  previousVersion: number;
  newVersion: number;
  alreadyUpToDate: boolean;
  replicasUpdated: number;
}

export interface SkillUpgradeAllResult {
  workspace: string;
  results: SkillUpgradeResult[];
  failures: Array<{ skillId: string; error: string }>;
  starterVersionUpdated: boolean;
  previousStarterVersion: string | null;
  newStarterVersion: string | null;
}

interface LoadedSkill {
  manifest: SkillManifest;
  sourcePath: string;
}

interface ReplicaOperation {
  source: string;
  destination: string;
}

export async function loadSkillCatalog(): Promise<SkillCatalog> {
  let catalog: unknown;
  try {
    catalog = YAML.parse(await readFile(join(skillsRoot, "catalog.yaml"), "utf8"));
  } catch (error) {
    throw new Error(`Le catalogue des skills est illisible : ${messageOf(error)}`);
  }

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "skill-catalog.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const valid = ajv.validate(schema, catalog);
  if (!valid) {
    const details = (ajv.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
      .join(" ; ");
    throw new Error(`Le catalogue des skills ne respecte pas son schéma : ${details}`);
  }

  const typedCatalog = catalog as SkillCatalog;
  const ids = new Set<string>();
  for (const skill of typedCatalog.skills) {
    if (ids.has(skill.id)) {
      throw new Error(`Le skill ${skill.id} est déclaré plusieurs fois dans le catalogue.`);
    }
    ids.add(skill.id);
  }
  return typedCatalog;
}

export async function loadSkill(skillId: string): Promise<LoadedSkill> {
  if (!skillIdPattern.test(skillId)) {
    throw new Error(`Identifiant de skill invalide : ${skillId}`);
  }

  const catalog = await loadSkillCatalog();
  const manifest = catalog.skills.find((candidate) => candidate.id === skillId);
  if (!manifest) {
    throw new Error(`Skill introuvable : ${skillId}`);
  }

  const root = await canonicalPath(skillsRoot);
  const sourcePath = await canonicalPath(join(skillsRoot, manifest.source));
  if (!isPathInsideOrEqual(sourcePath, root)) {
    throw new Error(`La source du skill ${skillId} sort du catalogue.`);
  }
  await validateSkillDirectory(sourcePath, skillId);
  return { manifest, sourcePath };
}

export async function validateSkillDirectory(
  directoryPath: string,
  skillId: string,
): Promise<void> {
  const details = await lstat(directoryPath).catch(() => null);
  if (details?.isSymbolicLink()) {
    throw new Error(`Le dossier du skill ${skillId} ne peut pas être un lien symbolique.`);
  }
  if (!details?.isDirectory()) {
    throw new Error(`Le dossier du skill ${skillId} est introuvable.`);
  }

  const skillFile = join(directoryPath, "SKILL.md");
  let parsed;
  try {
    parsed = parseFrontmatter(await readFile(skillFile, "utf8"));
  } catch (error) {
    throw new Error(`SKILL.md de ${skillId} est invalide : ${messageOf(error)}`);
  }

  const frontmatterKeys = Object.keys(parsed.attributes).sort();
  if (
    frontmatterKeys.length !== 2 ||
    frontmatterKeys[0] !== "description" ||
    frontmatterKeys[1] !== "name"
  ) {
    throw new Error(
      `SKILL.md de ${skillId} doit contenir uniquement name et description dans son frontmatter.`,
    );
  }
  if (parsed.attributes.name !== skillId) {
    throw new Error(`SKILL.md de ${skillId} déclare le nom ${String(parsed.attributes.name)}.`);
  }
  if (
    typeof parsed.attributes.description !== "string" ||
    parsed.attributes.description.trim().length < 80 ||
    parsed.attributes.description.length > 1024
  ) {
    throw new Error(
      `La description de ${skillId} doit expliquer précisément son rôle et ses déclencheurs.`,
    );
  }
  if (!parsed.body.trim()) {
    throw new Error(`SKILL.md de ${skillId} ne contient aucune procédure.`);
  }

  let openAiMetadata: unknown;
  try {
    openAiMetadata = YAML.parse(
      await readFile(join(directoryPath, "agents", "openai.yaml"), "utf8"),
    );
  } catch (error) {
    throw new Error(`agents/openai.yaml de ${skillId} est invalide : ${messageOf(error)}`);
  }
  const interfaceMetadata = isRecord(openAiMetadata) && isRecord(openAiMetadata.interface)
    ? openAiMetadata.interface
    : null;
  const displayName = interfaceMetadata?.display_name;
  const shortDescription = interfaceMetadata?.short_description;
  const defaultPrompt = interfaceMetadata?.default_prompt;
  if (typeof displayName !== "string" || !displayName.trim()) {
    throw new Error(`Le display_name de ${skillId} est absent.`);
  }
  if (
    typeof shortDescription !== "string" ||
    shortDescription.length < 25 ||
    shortDescription.length > 64
  ) {
    throw new Error(`La short_description de ${skillId} doit contenir entre 25 et 64 caractères.`);
  }
  if (
    typeof defaultPrompt !== "string" ||
    !defaultPrompt.includes(`$${skillId}`)
  ) {
    throw new Error(`Le default_prompt de ${skillId} doit mentionner $${skillId}.`);
  }
}

export async function installSkill(
  workspacePath: string,
  skillId: string,
): Promise<SkillInstallationResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const loaded = await loadSkill(skillId);
  await assertSkillCompatibility(loaded.manifest, config, workspace);

  const existing = (config.skills ?? []).find((skill) => skill.id === skillId);
  if (existing) {
    if (existing.version !== loaded.manifest.version) {
      throw new Error(
        `Le projet utilise ${skillId} v${existing.version}, mais le starter fournit la v${loaded.manifest.version}.`,
      );
    }
    const synchronized = await synchronizeSkills(workspace, false);
    return {
      manifest: loaded.manifest,
      workspace,
      alreadyInstalled: true,
      replicasUpdated: synchronized.replicasUpdated,
    };
  }

  const projectSource = join(workspace, "skills", skillId);
  await assertDestinationInsideWorkspace(workspace, projectSource, skillId);
  if (await pathExists(projectSource)) {
    throw new Error(`Le CLI refuse d'écraser la source existante du skill : ${projectSource}`);
  }

  const replicaDestinations = await destinationsForAdapters(
    workspace,
    config.adapters ?? [],
    skillId,
  );
  for (const destination of replicaDestinations) {
    if (await pathExists(destination)) {
      throw new Error(`Le CLI refuse d'écraser la copie existante du skill : ${destination}`);
    }
  }

  const createdDirectories: string[] = [];
  try {
    await copyDirectoryNew(loaded.sourcePath, projectSource);
    createdDirectories.push(projectSource);
    const sourceHash = await hashDirectory(projectSource);

    for (const destination of replicaDestinations) {
      await copyDirectoryNew(projectSource, destination);
      createdDirectories.push(destination);
    }

    config.skills = [
      ...(config.skills ?? []),
      { id: skillId, version: loaded.manifest.version, source_hash: sourceHash },
    ];
    await writeFileAtomic(configPath, YAML.stringify(config));
  } catch (error) {
    for (const directory of createdDirectories.reverse()) {
      await rm(directory, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    manifest: loaded.manifest,
    workspace,
    alreadyInstalled: false,
    replicasUpdated: replicaDestinations.length,
  };
}

export async function synchronizeSkills(
  workspacePath: string,
  force: boolean,
): Promise<SkillSynchronizationResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const references = config.skills ?? [];
  const operations: ReplicaOperation[] = [];
  const currentHashes = new Map<string, string>();

  for (const reference of references) {
    const loaded = await loadSkill(reference.id);
    if (reference.version !== loaded.manifest.version) {
      throw new Error(
        `Le projet utilise ${reference.id} v${reference.version}, mais le starter fournit la v${loaded.manifest.version}.`,
      );
    }
    await assertSkillCompatibility(loaded.manifest, config, workspace);

    const projectSource = join(workspace, "skills", reference.id);
    await assertDestinationInsideWorkspace(workspace, projectSource, reference.id);
    await validateSkillDirectory(projectSource, reference.id);
    const currentHash = await hashDirectory(projectSource);
    currentHashes.set(reference.id, currentHash);

    const destinations = await destinationsForAdapters(
      workspace,
      config.adapters ?? [],
      reference.id,
    );
    for (const destination of destinations) {
      if (!(await pathExists(destination))) {
        operations.push({ source: projectSource, destination });
        continue;
      }
      const replicaHash = await hashDirectory(destination);
      if (replicaHash === currentHash) continue;
      if (!force && replicaHash !== reference.source_hash) {
        throw new Error(
          `La copie ${destination} a été modifiée séparément. Reporter ses changements dans ${projectSource}, puis relancer avec --force si son remplacement est voulu.`,
        );
      }
      operations.push({ source: projectSource, destination });
    }
  }

  for (const operation of operations) {
    await replaceDirectoryAtomic(operation.source, operation.destination);
  }

  let configChanged = false;
  for (const reference of references) {
    const currentHash = currentHashes.get(reference.id);
    if (currentHash && reference.source_hash !== currentHash) {
      reference.source_hash = currentHash;
      configChanged = true;
    }
  }
  if (configChanged) {
    config.skills = references;
    await writeFileAtomic(configPath, YAML.stringify(config));
  }

  return {
    workspace,
    skillsSynchronized: references.length,
    replicasUpdated: operations.length,
  };
}

export async function upgradeSkill(
  workspacePath: string,
  skillId: string,
  force: boolean,
): Promise<SkillUpgradeResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const references = config.skills ?? [];
  const reference = references.find((skill) => skill.id === skillId);
  if (!reference) {
    throw new Error(
      `Le skill ${skillId} n'est pas installé dans ce workspace. Utiliser "skill add" d'abord.`,
    );
  }
  const previousVersion = reference.version;

  const loaded = await loadSkill(skillId);
  await assertSkillCompatibility(loaded.manifest, config, workspace);
  if (previousVersion === loaded.manifest.version) {
    return {
      workspace,
      skillId,
      previousVersion,
      newVersion: loaded.manifest.version,
      alreadyUpToDate: true,
      replicasUpdated: 0,
    };
  }
  if (previousVersion > loaded.manifest.version) {
    throw new Error(
      `Le workspace utilise ${skillId} v${previousVersion}, plus récent que la v${loaded.manifest.version} fournie par ce starter.`,
    );
  }

  const projectSource = join(workspace, "skills", skillId);
  await assertDestinationInsideWorkspace(workspace, projectSource, skillId);
  const currentSourceHash = await hashDirectory(projectSource);
  if (!force && currentSourceHash !== reference.source_hash) {
    throw new Error(
      `La source de ${skillId} a été modifiée depuis son installation. Reporter les changements ailleurs, ` +
        `puis relancer avec --force si le remplacement par la v${loaded.manifest.version} est voulu.`,
    );
  }

  const destinations = await destinationsForAdapters(workspace, config.adapters ?? [], skillId);
  for (const destination of destinations) {
    if (!(await pathExists(destination))) continue;
    const replicaHash = await hashDirectory(destination);
    if (!force && replicaHash !== reference.source_hash) {
      throw new Error(
        `La copie ${destination} de ${skillId} a été modifiée séparément. Reporter ses changements, ` +
          `puis relancer avec --force si son remplacement est voulu.`,
      );
    }
  }

  await replaceDirectoryAtomic(loaded.sourcePath, projectSource);
  const newSourceHash = await hashDirectory(projectSource);

  let replicasUpdated = 0;
  for (const destination of destinations) {
    await replaceDirectoryAtomic(projectSource, destination);
    replicasUpdated += 1;
  }

  reference.version = loaded.manifest.version;
  reference.source_hash = newSourceHash;
  config.skills = references;
  await writeFileAtomic(configPath, YAML.stringify(config));

  return {
    workspace,
    skillId,
    previousVersion,
    newVersion: loaded.manifest.version,
    alreadyUpToDate: false,
    replicasUpdated,
  };
}

export async function upgradeAllSkills(
  workspacePath: string,
  force: boolean,
): Promise<SkillUpgradeAllResult> {
  const workspace = await canonicalPath(workspacePath);
  const configPath = join(workspace, "project.yaml");
  const config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  const skillIds = (config.skills ?? []).map((skill) => skill.id);

  const results: SkillUpgradeResult[] = [];
  const failures: Array<{ skillId: string; error: string }> = [];
  for (const skillId of skillIds) {
    try {
      results.push(await upgradeSkill(workspace, skillId, force));
    } catch (error) {
      failures.push({ skillId, error: messageOf(error) });
    }
  }

  let starterVersionUpdated = false;
  let previousStarterVersion: string | null = null;
  let newStarterVersion: string | null = null;

  // starter_version représente le niveau de compatibilité de l'ensemble du workspace : il ne peut
  // avancer que si toutes les mises à niveau de skills requises ont réussi (aucune échec partiel),
  // jamais depuis une mise à niveau isolée d'un seul skill (`upgradeSkill`).
  if (failures.length === 0) {
    const currentStarterVersion = (
      JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version: string }
    ).version;
    const latestConfig = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
    if (latestConfig.starter_version !== currentStarterVersion) {
      previousStarterVersion = latestConfig.starter_version;
      newStarterVersion = currentStarterVersion;
      latestConfig.starter_version = currentStarterVersion;
      await writeFileAtomic(configPath, YAML.stringify(latestConfig));
      starterVersionUpdated = true;
    }
  }

  return {
    workspace,
    results,
    failures,
    starterVersionUpdated,
    previousStarterVersion,
    newStarterVersion,
  };
}

export async function assertSkillCompatibility(manifest: SkillManifest, config: ProjectConfig, workspace: string): Promise<void> {
  const phased = await pathExists(join(workspace, ".starter/workflow.json"));
  const workflow = phased ? "phases-v3" : "legacy";
  if (!manifest.compatibility.workflows.includes(workflow)) {
    throw new Error(`Le skill ${manifest.id} n'est pas compatible avec ${workflow}. ` +
      (phased ? "Utiliser project-phase et project-review." : "Migrer vers un nouveau workspace par phases ou utiliser les skills historiques."));
  }
  if (phased && manifest.compatibility.phase_runtime_min && await pathExists(join(workspace, ".starter/run.mjs"))) {
    const runtime = JSON.parse(await readFile(join(workspace, ".starter/runtime/package.json"), "utf8"));
    const minimum = manifest.compatibility.phase_runtime_min;
    const parts = (version: string) => {
      if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Version du runtime illisible.");
      return version.split(".").map(Number);
    };
    const actual = parts(runtime.version), required = parts(minimum);
    const difference = actual.map((n, i) => n - required[i]!).find(n => n !== 0) ?? 0;
    if (difference < 0) throw new Error(`Le skill ${manifest.id} requiert le runtime ${minimum} ou supérieur ; runtime installé ${runtime.version}. Ne pas mettre à jour les seuls skills. Créer une installation cohérente depuis la nouvelle distribution.`);
  }
  if (!manifest.compatibility.entry_modes.includes(config.project.entry_mode)) {
    throw new Error(
      `Le skill ${manifest.id} ne prend pas en charge le mode ${config.project.entry_mode}.`,
    );
  }
  if (
    !manifest.compatibility.profiles.includes("*") &&
    !manifest.compatibility.profiles.includes(config.profile.id)
  ) {
    throw new Error(
      `Le skill ${manifest.id} ne prend pas en charge le profil ${config.profile.id}.`,
    );
  }
}

async function destinationsForAdapters(
  workspace: string,
  references: AdapterReference[],
  skillId: string,
): Promise<string[]> {
  const destinations: string[] = [];
  if (await pathExists(join(workspace, ".starter/workflow.json"))) {
    // Phase workspaces own their native configuration through models.json, not legacy adapters:
    // every assistant listed there receives its copy (single registry, see native-adapters.ts).
    if (!(await pathExists(join(workspace, ".starter/models.json")))) throw new Error("Configuration native absente : .starter/models.json est requis avant la gestion des skills.");
    for (const id of await installedNativeAdapters(workspace)) {
      const destination = join(workspace, NATIVE_ADAPTERS[id].skills, skillId);
      await assertDestinationInsideWorkspace(workspace, destination, skillId);
      destinations.push(destination);
    }
    return destinations;
  }
  for (const reference of references) {
    const adapter = await loadAdapter(reference.id);
    if (reference.version !== adapter.adapter.version) {
      throw new Error(
        `Le projet utilise ${reference.id} v${reference.version}, mais le starter fournit la v${adapter.adapter.version}.`,
      );
    }
    const destination = join(workspace, adapter.skills.destination, skillId);
    await assertDestinationInsideWorkspace(workspace, destination, skillId);
    destinations.push(destination);
  }
  return destinations;
}

async function assertDestinationInsideWorkspace(
  workspace: string,
  destination: string,
  skillId: string,
): Promise<void> {
  const canonical = await canonicalPath(destination);
  if (!isPathInsideOrEqual(canonical, workspace)) {
    throw new Error(
      `Le skill ${skillId} refuse un chemin qui sort du workspace : ${destination}`,
    );
  }
}

async function copyDirectoryNew(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
}

async function replaceDirectoryAtomic(source: string, destination: string): Promise<void> {
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const token = randomUUID();
  const temporary = join(parent, `.${token}.skill.tmp`);
  const backup = join(parent, `.${token}.skill.backup`);
  const destinationExists = await pathExists(destination);

  await cp(source, temporary, { recursive: true, errorOnExist: true, force: false });
  let backupCreated = false;
  try {
    if (destinationExists) {
      await rename(destination, backup);
      backupCreated = true;
    }
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (backupCreated && !(await pathExists(destination))) {
      await rename(backup, destination);
    }
    throw error;
  }
  if (backupCreated) {
    await rm(backup, { recursive: true, force: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
