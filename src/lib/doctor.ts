import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { parseFrontmatter } from "./frontmatter.js";
import { canonicalPath, pathExists } from "./fs-safe.js";
import { schemasRoot } from "./paths.js";
import { isPathInsideOrEqual } from "./text.js";
import { loadProfile } from "./profiles.js";
import { loadAdapter } from "./adapters.js";
import { hashDirectory, hashText } from "./content-hash.js";
import {
  loadAgentCatalog,
  loadAgentSource,
  loadBuiltinAgent,
  renderNativeAgent,
} from "./agents.js";
import {
  loadSkill,
  assertSkillCompatibility,
  validateSkillDirectory,
} from "./skills.js";
import {
  MarkerLayoutError,
  VIEW_BEGIN,
  VIEW_END,
  analyzeMarkers,
  assertRenderedMarkersAbsent,
  findMarkerInFields,
  WORK_ACTIVE,
  WORK_APPROVED_OR_LATER,
  deriveItemState,
  deriveTaskState,
  extractRoadmapBlock,
  itemHasAcceptance,
  itemProgress,
  listUnreadableWorkUnits,
  loadWorkUnits,
  readBacklogFile,
  renderRoadmap,
  roadmapBlockIsCurrent,
  validEvidence,
  workUnitsForItem,
} from "./backlog.js";
import { diagnoseImportedProductPackages } from "./product-package.js";
import type {
  BacklogDocument,
  BacklogItem,
  BacklogTask,
  DiagnosticItem,
  DiagnosticReport,
  DiagnosticSeverity,
  ProfileManifest,
  ProjectConfig,
  WorkUnitSummary,
} from "../types.js";

import { STATE, diagnoseWorkflow } from "./phase-workflow.js";

export async function inspectWorkspace(workspacePath: string): Promise<DiagnosticReport> {
  const workspace = await canonicalPath(resolve(workspacePath));
  const items: DiagnosticItem[] = [];
  const add = (
    severity: DiagnosticSeverity,
    code: string,
    message: string,
    path?: string,
  ): void => {
    items.push(path ? { severity, code, message, path } : { severity, code, message });
  };

  const configPath = join(workspace, "project.yaml");
  if (!(await pathExists(configPath))) {
    add("blocked", "CONFIG_MISSING", "Le fichier project.yaml est absent.", configPath);
    return reportFor(workspace, items);
  }

  let config: ProjectConfig;
  try {
    config = YAML.parse(await readFile(configPath, "utf8")) as ProjectConfig;
  } catch (error) {
    add("blocked", "CONFIG_PARSE", `project.yaml est illisible : ${messageOf(error)}`, configPath);
    return reportFor(workspace, items);
  }

  try {
    const schema = JSON.parse(
      await readFile(join(schemasRoot, "project.schema.json"), "utf8"),
    ) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const valid = ajv.validate(schema, config);
    if (!valid) {
      for (const error of ajv.errors ?? []) {
        add(
          "blocked",
          "CONFIG_SCHEMA",
          `${error.instancePath || "/"} ${error.message ?? "est invalide"}`,
          configPath,
        );
      }
    } else {
      add("ok", "CONFIG_VALID", "project.yaml respecte le schéma.", configPath);
    }
  } catch (error) {
    add("blocked", "SCHEMA_ERROR", `Le schéma ne peut pas être appliqué : ${messageOf(error)}`);
  }

  let profile: ProfileManifest | null = null;
  const configuredProfileId = config.profile?.id;
  if (typeof configuredProfileId === "string") {
    try {
      profile = await loadProfile(configuredProfileId);
      if (config.profile.version !== profile.profile.version) {
        add(
          "blocked",
          "PROFILE_VERSION",
          `Le projet utilise ${configuredProfileId} v${config.profile.version}, mais le starter fournit la v${profile.profile.version}.`,
        );
      } else {
        add(
          "ok",
          "PROFILE_VALID",
          `Le profil ${profile.profile.label} v${profile.profile.version} est disponible.`,
        );
      }

      if (!profile.compatibility.entry_modes.includes(config.project?.entry_mode)) {
        add(
          "blocked",
          "PROFILE_ENTRY_MODE",
          `Le profil ${configuredProfileId} ne prend pas en charge le mode ${String(config.project?.entry_mode)}.`,
        );
      }
    } catch (error) {
      add("blocked", "PROFILE_INVALID", messageOf(error));
    }
  } else {
    add("blocked", "PROFILE_MISSING", "Aucun profil valide n'est configuré.", configPath);
  }

  const codeRoot = await canonicalPath(resolveFromWorkspace(workspace, config.paths?.code_root));
  const repositoryRoot = await canonicalPath(
    resolveFromWorkspace(workspace, config.paths?.repository_root),
  );

  await checkDirectory(codeRoot, "CODE_ROOT", "Code root", add);
  await checkDirectory(repositoryRoot, "REPOSITORY_ROOT", "Repository root", add);

  for (const [label, path] of [
    ["PROJECT_BRIEF.md", join(workspace, "PROJECT_BRIEF.md")],
    ["PROJECT_STATE.md", join(workspace, "PROJECT_STATE.md")],
    ["docs/decisions.md", join(workspace, "docs", "decisions.md")],
  ] as const) {
    if (await pathExists(path)) {
      add("ok", "FILE_PRESENT", `${label} est présent.`, path);
    } else {
      add("blocked", "FILE_MISSING", `${label} est absent.`, path);
    }
  }

  await checkFrontmatter(join(workspace, "PROJECT_BRIEF.md"), "brief", add);
  await checkFrontmatter(join(workspace, "PROJECT_STATE.md"), "state", add);

  try {
    items.push(...await diagnoseImportedProductPackages(workspace));
  } catch (error) {
    add(
      "blocked",
      "PRODUCT_PACKAGE_DIAGNOSTIC",
      `Le diagnostic des product-packages a échoué : ${messageOf(error)}`,
    );
  }

  await checkAdapters(workspace, config, add);
  await checkSkills(workspace, config, add);
  await checkAgents(workspace, config, add);
  if (await pathExists(join(workspace, STATE))) {
    const errors = await diagnoseWorkflow(workspace);
    for (const error of errors) add("blocked", "PHASE_WORKFLOW", error);
    if (!errors.length) add("ok", "PHASE_WORKFLOW", "Le suivi des phases est cohérent ; ce verdict ne prouve pas la disponibilité des modèles ni la qualité du produit.");
  } else {
    await checkPlanning(workspace, config, add);
  }

  if (await pathExists(join(workspace, ".git"))) {
    if (await pathExists(join(workspace, STATE))) add("ok", "WORKSPACE_GIT", "Dépôt du suivi distinct du dépôt applicatif ; sa confidentialité dépend de la destination de sauvegarde.", workspace);
    else add("blocked", "WORKSPACE_GIT", "Le workspace privé contient son propre dépôt Git.", workspace);
  } else {
    add("ok", "WORKSPACE_NO_GIT", "Aucun dépôt Git n'est présent dans le workspace privé.");
  }

  if (isPathInsideOrEqual(workspace, repositoryRoot)) {
    add(
      "blocked",
      "WORKSPACE_INSIDE_REPOSITORY",
      "Le workspace privé se trouve dans le dépôt applicatif et pourrait être suivi par Git.",
      workspace,
    );
  }

  const projectParent = dirname(workspace);
  if (
    repositoryRoot !== projectParent &&
    (await pathExists(join(projectParent, ".git")))
  ) {
    add(
      "blocked",
      "PARENT_GIT",
      "Le dossier parent est un dépôt Git et pourrait inclure le workspace privé.",
      projectParent,
    );
  }

  if (await pathExists(join(repositoryRoot, ".git"))) {
    add("ok", "REPOSITORY_GIT", "Le dépôt Git est présent dans le repository root.", repositoryRoot);
  } else {
    add("warning", "REPOSITORY_NO_GIT", "Aucun dépôt Git n'est détecté dans le repository root.", repositoryRoot);
  }

  if (isDangerousRoot(codeRoot) || isDangerousRoot(repositoryRoot)) {
    add(
      "blocked",
      "UNSAFE_ROOT",
      "Un chemin pointe vers la racine du système ou le dossier personnel.",
    );
  }

  if (codeRoot && (await pathExists(codeRoot))) {
    if (profile) {
      await checkProfileRequirements(codeRoot, config, profile, add);
    }
    await checkPrivateLeaks(codeRoot, config.privacy?.private_paths ?? [], add);
    await checkTrackedSensitiveFiles(repositoryRoot, config, add);
  }

  return reportFor(workspace, items);
}

async function checkAgents(
  workspace: string,
  config: ProjectConfig,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const references = Array.isArray(config.agents) ? config.agents : [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (
      !reference ||
      typeof reference.id !== "string" ||
      typeof reference.version !== "number" ||
      typeof reference.origin !== "string" ||
      typeof reference.source_hash !== "string" ||
      !reference.replicas ||
      typeof reference.replicas !== "object"
    ) {
      continue;
    }
    if (seen.has(reference.id)) {
      add("blocked", "AGENT_DUPLICATE", `L'agent ${reference.id} est déclaré plusieurs fois.`);
      continue;
    }
    seen.add(reference.id);

    const sourcePath = join(workspace, "agents", reference.id);
    try {
      const canonicalSource = await canonicalPath(sourcePath);
      if (!isPathInsideOrEqual(canonicalSource, workspace)) {
        add(
          "blocked",
          "AGENT_PATH_ESCAPE",
          `La source de l'agent ${reference.id} sort du workspace privé.`,
          sourcePath,
        );
        continue;
      }

      const source = await loadAgentSource(sourcePath, reference.id);
      if (reference.version !== source.manifest.agent.version) {
        add(
          "blocked",
          "AGENT_VERSION",
          `Le projet utilise ${reference.id} v${reference.version}, mais sa source déclare la v${source.manifest.agent.version}.`,
          sourcePath,
        );
        continue;
      }
      if (reference.origin === "starter") {
        const builtin = await loadBuiltinAgent(reference.id);
        if (builtin.manifest.agent.version !== reference.version) {
          add(
            "blocked",
            "AGENT_STARTER_VERSION",
            `Le starter fournit ${reference.id} v${builtin.manifest.agent.version}, incompatible avec la v${reference.version}.`,
            sourcePath,
          );
          continue;
        }
      }
      if (!source.manifest.compatibility.entry_modes.includes(config.project?.entry_mode)) {
        add(
          "blocked",
          "AGENT_ENTRY_MODE",
          `L'agent ${reference.id} ne prend pas en charge le mode ${String(config.project?.entry_mode)}.`,
        );
      }
      if (
        !source.manifest.compatibility.profiles.includes("*") &&
        !source.manifest.compatibility.profiles.includes(config.profile?.id)
      ) {
        add(
          "blocked",
          "AGENT_PROFILE",
          `L'agent ${reference.id} ne prend pas en charge le profil ${String(config.profile?.id)}.`,
        );
      }

      const sourceHash = await hashDirectory(sourcePath);
      if (sourceHash !== reference.source_hash) {
        add(
          "warning",
          "AGENT_SOURCE_CHANGED",
          `La source de ${reference.id} a changé depuis sa dernière synchronisation.`,
          sourcePath,
        );
      } else {
        add(
          "ok",
          "AGENT_SOURCE_VALID",
          `La source de ${source.manifest.agent.label} v${source.manifest.agent.version} est valide.`,
          sourcePath,
        );
      }

      for (const adapterReference of config.adapters ?? []) {
        const adapter = await loadAdapter(adapterReference.id);
        if (adapterReference.version !== adapter.adapter.version) continue;
        const extension = adapter.agents.format === "codex-toml" ? ".toml" : ".md";
        const replicaPath = join(
          workspace,
          adapter.agents.destination,
          `${reference.id}${extension}`,
        );
        const canonicalReplica = await canonicalPath(replicaPath);
        if (!isPathInsideOrEqual(canonicalReplica, workspace)) {
          add(
            "blocked",
            "AGENT_PATH_ESCAPE",
            `La copie de ${reference.id} pour ${adapterReference.id} sort du workspace privé.`,
            replicaPath,
          );
          continue;
        }

        const replicaExists = await pathExists(replicaPath);
        if (!source.manifest.enabled) {
          if (replicaExists) {
            add(
              "blocked",
              "AGENT_DISABLED_REPLICA",
              `L'agent ${reference.id} est désactivé, mais une copie native subsiste pour ${adapterReference.id}.`,
              replicaPath,
            );
          } else {
            add(
              "ok",
              "AGENT_DISABLED",
              `L'agent ${reference.id} est conservé comme brouillon désactivé.`,
              sourcePath,
            );
          }
          continue;
        }
        if (!replicaExists) {
          add(
            "blocked",
            "AGENT_REPLICA_MISSING",
            `La copie de ${reference.id} pour ${adapterReference.id} est absente.`,
            replicaPath,
          );
          continue;
        }

        const expectedContent = renderNativeAgent(
          adapter,
          source.manifest,
          source.instructions,
        );
        const expectedHash = hashText(expectedContent);
        const actualHash = hashText(await readFile(replicaPath, "utf8"));
        if (actualHash !== expectedHash) {
          add(
            "blocked",
            "AGENT_REPLICA_DRIFT",
            `La copie de ${reference.id} pour ${adapterReference.id} diverge de sa source.`,
            replicaPath,
          );
        } else {
          add(
            "ok",
            "AGENT_REPLICA_VALID",
            `${reference.id} est disponible pour ${adapter.adapter.label}.`,
            replicaPath,
          );
        }
      }
    } catch (error) {
      add("blocked", "AGENT_INVALID", messageOf(error), sourcePath);
    }
  }
}

async function checkSkills(
  workspace: string,
  config: ProjectConfig,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const references = Array.isArray(config.skills) ? config.skills : [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (
      !reference ||
      typeof reference.id !== "string" ||
      typeof reference.version !== "number" ||
      typeof reference.source_hash !== "string"
    ) {
      continue;
    }
    if (seen.has(reference.id)) {
      add("blocked", "SKILL_DUPLICATE", `Le skill ${reference.id} est déclaré plusieurs fois.`);
      continue;
    }
    seen.add(reference.id);

    try {
      const loaded = await loadSkill(reference.id);
      if (reference.version !== loaded.manifest.version) {
        add(
          "blocked",
          "SKILL_VERSION",
          `Le projet utilise ${reference.id} v${reference.version}, mais le starter fournit la v${loaded.manifest.version}.`,
        );
        continue;
      }
      if (!loaded.manifest.compatibility.entry_modes.includes(config.project?.entry_mode)) {
        add(
          "blocked",
          "SKILL_ENTRY_MODE",
          `Le skill ${reference.id} ne prend pas en charge le mode ${String(config.project?.entry_mode)}.`,
        );
      }
      if (
        !loaded.manifest.compatibility.profiles.includes("*") &&
        !loaded.manifest.compatibility.profiles.includes(config.profile?.id)
      ) {
        add(
          "blocked",
          "SKILL_PROFILE",
          `Le skill ${reference.id} ne prend pas en charge le profil ${String(config.profile?.id)}.`,
        );
      }

      await assertSkillCompatibility(loaded.manifest, config, workspace);

      const sourcePath = join(workspace, "skills", reference.id);
      const canonicalSource = await canonicalPath(sourcePath);
      if (!isPathInsideOrEqual(canonicalSource, workspace)) {
        add(
          "blocked",
          "SKILL_PATH_ESCAPE",
          `La source du skill ${reference.id} sort du workspace privé.`,
          sourcePath,
        );
        continue;
      }
      await validateSkillDirectory(sourcePath, reference.id);
      const sourceHash = await hashDirectory(sourcePath);
      if (sourceHash !== reference.source_hash) {
        add(
          "warning",
          "SKILL_SOURCE_CHANGED",
          `La source de ${reference.id} a changé depuis sa dernière synchronisation.`,
          sourcePath,
        );
      } else {
        add(
          "ok",
          "SKILL_SOURCE_VALID",
          `La source de ${loaded.manifest.label} v${loaded.manifest.version} est valide.`,
          sourcePath,
        );
      }

      for (const adapterReference of config.adapters ?? []) {
        const adapter = await loadAdapter(adapterReference.id);
        if (adapterReference.version !== adapter.adapter.version) continue;
        const replicaPath = join(
          workspace,
          adapter.skills.destination,
          reference.id,
        );
        const canonicalReplica = await canonicalPath(replicaPath);
        if (!isPathInsideOrEqual(canonicalReplica, workspace)) {
          add(
            "blocked",
            "SKILL_PATH_ESCAPE",
            `La copie de ${reference.id} pour ${adapterReference.id} sort du workspace privé.`,
            replicaPath,
          );
          continue;
        }
        if (!(await pathExists(replicaPath))) {
          add(
            "blocked",
            "SKILL_REPLICA_MISSING",
            `La copie de ${reference.id} pour ${adapterReference.id} est absente.`,
            replicaPath,
          );
          continue;
        }
        await validateSkillDirectory(replicaPath, reference.id);
        const replicaHash = await hashDirectory(replicaPath);
        if (replicaHash !== sourceHash) {
          add(
            "blocked",
            "SKILL_REPLICA_DRIFT",
            `La copie de ${reference.id} pour ${adapterReference.id} diverge de sa source.`,
            replicaPath,
          );
        } else {
          add(
            "ok",
            "SKILL_REPLICA_VALID",
            `${reference.id} est disponible pour ${adapter.adapter.label}.`,
            replicaPath,
          );
        }
      }
    } catch (error) {
      add("blocked", "SKILL_INVALID", messageOf(error));
    }
  }
}

async function checkAdapters(
  workspace: string,
  config: ProjectConfig,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const references = Array.isArray(config.adapters) ? config.adapters : [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (!reference || typeof reference.id !== "string" || typeof reference.version !== "number") {
      continue;
    }
    if (seen.has(reference.id)) {
      add("blocked", "ADAPTER_DUPLICATE", `L'adaptateur ${reference.id} est déclaré plusieurs fois.`);
      continue;
    }
    seen.add(reference.id);

    try {
      const manifest = await loadAdapter(reference.id);
      if (reference.version !== manifest.adapter.version) {
        add(
          "blocked",
          "ADAPTER_VERSION",
          `Le projet utilise ${reference.id} v${reference.version}, mais le starter fournit la v${manifest.adapter.version}.`,
        );
        continue;
      }
      let adapterReady = true;
      if (!manifest.compatibility.project_schema_versions.includes(config.schema_version)) {
        adapterReady = false;
        add(
          "blocked",
          "ADAPTER_PROJECT_SCHEMA",
          `L'adaptateur ${reference.id} ne prend pas en charge le schéma projet v${config.schema_version}.`,
        );
      }
      if (
        !manifest.compatibility.profiles.includes("*") &&
        !manifest.compatibility.profiles.includes(config.profile?.id)
      ) {
        adapterReady = false;
        add(
          "blocked",
          "ADAPTER_PROFILE",
          `L'adaptateur ${reference.id} ne prend pas en charge le profil ${String(config.profile?.id)}.`,
        );
      }

      for (const directory of manifest.directories) {
        const path = join(workspace, directory);
        const canonical = await canonicalPath(path);
        if (!isPathInsideOrEqual(canonical, workspace)) {
          adapterReady = false;
          add(
            "blocked",
            "ADAPTER_PATH_ESCAPE",
            `Le chemin ${directory} sort du workspace privé.`,
            path,
          );
          continue;
        }
        const details = await stat(path).catch(() => null);
        if (!details?.isDirectory()) {
          adapterReady = false;
          add(
            "blocked",
            "ADAPTER_DIRECTORY_MISSING",
            `Dossier requis par ${reference.id} absent : ${directory}.`,
            path,
          );
        }
      }
      for (const output of manifest.outputs) {
        const path = join(workspace, output.path);
        const canonical = await canonicalPath(path);
        if (!isPathInsideOrEqual(canonical, workspace)) {
          adapterReady = false;
          add(
            "blocked",
            "ADAPTER_PATH_ESCAPE",
            `Le chemin ${output.path} sort du workspace privé.`,
            path,
          );
          continue;
        }
        const details = await stat(path).catch(() => null);
        if (!details?.isFile()) {
          adapterReady = false;
          add(
            "blocked",
            "ADAPTER_OUTPUT_MISSING",
            `Fichier requis par ${reference.id} absent : ${output.path}.`,
            path,
          );
        }
      }

      if (adapterReady) {
        add(
          "ok",
          "ADAPTER_VALID",
          `L'adaptateur ${manifest.adapter.label} v${manifest.adapter.version} est disponible.`,
        );
      }
    } catch (error) {
      add("blocked", "ADAPTER_INVALID", messageOf(error));
    }
  }

  if (references.length === 0) {
    if (await pathExists(join(workspace, STATE)) && await pathExists(join(workspace, ".starter/models.json"))) {
      add("ok", "ADAPTER_PHASE_MANAGED", "La configuration native est gérée et contrôlée par le workflow de phases.");
    } else {
      add("warning", "ADAPTER_NONE", "Aucun adaptateur d'assistant n'est encore configuré.");
    }
  }
}

async function checkProfileRequirements(
  codeRoot: string,
  config: ProjectConfig,
  profile: ProfileManifest,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const jsonCache = new Map<
    string,
    { ok: true; value: unknown } | { ok: false; message: string }
  >();
  const reportedJsonErrors = new Set<string>();
  const entryCache = new Map<number, ProfileEntry[]>();

  const readJsonManifest = async (
    candidate: string,
  ): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> => {
    const cached = jsonCache.get(candidate);
    if (cached) return cached;
    try {
      const result = { ok: true as const, value: JSON.parse(await readFile(candidate, "utf8")) };
      jsonCache.set(candidate, result);
      return result;
    } catch (error) {
      const result = { ok: false as const, message: messageOf(error) };
      jsonCache.set(candidate, result);
      return result;
    }
  };

  const entriesAtDepth = async (maxDepth: number): Promise<ProfileEntry[]> => {
    const cached = entryCache.get(maxDepth);
    if (cached) return cached;
    const entries = await collectProfileEntries(codeRoot, maxDepth);
    entryCache.set(maxDepth, entries);
    return entries;
  };

  const requiredCommands = new Set(profile.commands.required);
  for (const requirement of profile.commands.required_by_entry_mode) {
    if (requirement.entry_modes.includes(config.project.entry_mode)) {
      requiredCommands.add(requirement.name);
    }
  }
  const missingCommands = [...requiredCommands].filter(
    (command) => !config.commands?.[command],
  );
  if (missingCommands.length > 0) {
    add(
      "blocked",
      "PROFILE_COMMANDS",
      `Commandes requises par le profil mais absentes : ${missingCommands.join(", ")}.`,
    );
  } else {
    const message = requiredCommands.size === 0
      ? "Le profil n'impose aucune commande technique."
      : "Toutes les commandes requises par le profil sont configurées.";
    add("ok", "PROFILE_COMMANDS", message);
  }

  for (const requirement of profile.validation.required_paths) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }
    const candidate = join(codeRoot, requirement.path);
    try {
      const details = await stat(candidate);
      const matches = requirement.kind === "file"
        ? details.isFile()
        : details.isDirectory();
      if (matches) {
        add("ok", "PROFILE_PATH", `Exigence du profil présente : ${requirement.path}.`, candidate);
      } else {
        add(
          requirement.severity,
          "PROFILE_PATH_KIND",
          `Le chemin ${requirement.path} n'est pas de type ${requirement.kind}.`,
          candidate,
        );
      }
    } catch {
      add(
        requirement.severity,
        "PROFILE_PATH_MISSING",
        `Exigence du profil absente : ${requirement.path}.`,
        candidate,
      );
    }
  }

  for (const requirement of profile.validation.any_of_paths) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }

    let match: { path: string; candidate: string } | undefined;
    for (const alternative of requirement.alternatives) {
      const candidate = join(codeRoot, alternative.path);
      try {
        const details = await stat(candidate);
        const matches = alternative.kind === "file"
          ? details.isFile()
          : details.isDirectory();
        if (matches) {
          match = { path: alternative.path, candidate };
          break;
        }
      } catch {
        // L'absence d'une alternative est normale tant qu'une autre correspond.
      }
    }

    if (match) {
      add(
        "ok",
        "PROFILE_PATH_ALTERNATIVE",
        `${requirement.label} détecté : ${match.path}.`,
        match.candidate,
      );
    } else {
      const expected = requirement.alternatives
        .map((alternative) => alternative.path)
        .join(", ");
      add(
        requirement.severity,
        "PROFILE_PATH_ALTERNATIVE",
        `${requirement.label} absent ; une de ces alternatives est attendue : ${expected}.`,
        codeRoot,
      );
    }
  }

  for (const requirement of profile.validation.any_of_matches) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }
    const entries = await entriesAtDepth(requirement.max_depth);
    let match: ProfileEntry | undefined;
    for (const alternative of requirement.alternatives) {
      match = entries.find((entry) =>
        entry.kind === alternative.kind &&
        matchesProfileGlob(entry.relativePath, alternative.pattern)
      );
      if (match) break;
    }

    if (match) {
      add(
        "ok",
        "PROFILE_MATCH_ALTERNATIVE",
        `${requirement.label} détecté : ${match.relativePath}.`,
        match.absolutePath,
      );
    } else {
      const expected = requirement.alternatives
        .map((alternative) => alternative.pattern)
        .join(", ");
      add(
        requirement.severity,
        "PROFILE_MATCH_ALTERNATIVE",
        `${requirement.label} absent ; un de ces motifs est attendu : ${expected}.`,
        codeRoot,
      );
    }
  }

  for (const requirement of profile.validation.required_text_matches) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }
    const entries = await entriesAtDepth(requirement.max_depth);
    const candidates = entries.filter((entry) =>
      entry.kind === "file" &&
      entry.size <= 2_000_000 &&
      requirement.patterns.some((pattern) =>
        matchesProfileGlob(entry.relativePath, pattern)
      )
    );
    let match: ProfileEntry | undefined;
    for (const candidate of candidates) {
      try {
        const content = await readFile(candidate.absolutePath, "utf8");
        const matches = requirement.match === "all"
          ? requirement.contains.every((needle) => content.includes(needle))
          : requirement.contains.some((needle) => content.includes(needle));
        if (matches) {
          match = candidate;
          break;
        }
      } catch {
        // Un fichier illisible n'est pas une preuve ; les autres candidats restent examinés.
      }
    }

    if (match) {
      add(
        "ok",
        "PROFILE_TEXT_MATCH",
        `${requirement.label} démontré par ${match.relativePath}.`,
        match.absolutePath,
      );
    } else {
      add(
        requirement.severity,
        "PROFILE_TEXT_MATCH",
        `${requirement.label} non démontré dans les fichiers correspondant à ${requirement.patterns.join(", ")}.`,
        codeRoot,
      );
    }
  }

  for (const requirement of profile.validation.required_json_fields) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }
    const candidate = join(codeRoot, requirement.path);
    if (!(await pathExists(candidate))) continue;

    const parsed = await readJsonManifest(candidate);
    if (!parsed.ok) {
      const errorKey = `${candidate}\u0000${requirement.severity}`;
      if (!reportedJsonErrors.has(errorKey)) {
        add(
          requirement.severity,
          "PROFILE_JSON_INVALID",
          `${requirement.path} est illisible ou n'est pas un JSON valide : ${parsed.message}`,
          candidate,
        );
        reportedJsonErrors.add(errorKey);
      }
      continue;
    }

    const missingFields = requirement.fields.filter(
      (field) => !hasMeaningfulJsonField(parsed.value, field),
    );
    if (missingFields.length > 0) {
      add(
        requirement.severity,
        "PROFILE_JSON_FIELDS",
        `Champs requis absents de ${requirement.path} : ${missingFields.join(", ")}.`,
        candidate,
      );
    } else {
      add(
        "ok",
        "PROFILE_JSON_FIELDS",
        `Champs requis présents dans ${requirement.path} : ${requirement.fields.join(", ")}.`,
        candidate,
      );
    }
  }

  for (const requirement of profile.validation.any_of_json_fields) {
    if (
      requirement.entry_modes &&
      !requirement.entry_modes.includes(config.project.entry_mode)
    ) {
      continue;
    }
    const candidate = join(codeRoot, requirement.path);
    if (!(await pathExists(candidate))) continue;

    const parsed = await readJsonManifest(candidate);
    if (!parsed.ok) {
      const errorKey = `${candidate}\u0000${requirement.severity}`;
      if (!reportedJsonErrors.has(errorKey)) {
        add(
          requirement.severity,
          "PROFILE_JSON_INVALID",
          `${requirement.path} est illisible ou n'est pas un JSON valide : ${parsed.message}`,
          candidate,
        );
        reportedJsonErrors.add(errorKey);
      }
      continue;
    }

    const matchingField = requirement.fields.find(
      (field) => hasMeaningfulJsonField(parsed.value, field),
    );
    if (matchingField) {
      add(
        "ok",
        "PROFILE_JSON_ALTERNATIVE",
        `Alternative JSON présente dans ${requirement.path} : ${matchingField}.`,
        candidate,
      );
    } else {
      add(
        requirement.severity,
        "PROFILE_JSON_ALTERNATIVE",
        `Au moins un de ces champs est requis dans ${requirement.path} : ${requirement.fields.join(", ")}.`,
        candidate,
      );
    }
  }
}

interface ProfileEntry {
  absolutePath: string;
  relativePath: string;
  kind: "file" | "directory";
  size: number;
}

const ignoredProfileDirectories = new Set([
  ".git",
  ".build",
  ".next",
  ".cache",
  "DerivedData",
  "Pods",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);

async function collectProfileEntries(
  root: string,
  maxDepth: number,
): Promise<ProfileEntry[]> {
  const entries: ProfileEntry[] = [];

  const visit = async (directory: string, depth: number): Promise<void> => {
    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      const absolutePath = join(directory, child.name);
      const relativePath = relative(root, absolutePath).split(sep).join("/");
      if (child.isFile()) {
        const details = await stat(absolutePath).catch(() => null);
        entries.push({
          absolutePath,
          relativePath,
          kind: "file",
          size: details?.size ?? 0,
        });
        continue;
      }
      if (!child.isDirectory() || ignoredProfileDirectories.has(child.name)) continue;
      entries.push({ absolutePath, relativePath, kind: "directory", size: 0 });
      if (depth < maxDepth) await visit(absolutePath, depth + 1);
    }
  };

  await visit(root, 1);
  return entries;
}

function matchesProfileGlob(path: string, pattern: string): boolean {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? "";
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
      continue;
    }
    if (character === "*") {
      expression += "[^/]*";
      continue;
    }
    if (character === "?") {
      expression += "[^/]";
      continue;
    }
    expression += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${expression}$`, "u").test(path);
}

function hasMeaningfulJsonField(value: unknown, field: string): boolean {
  let cursor: unknown = value;
  for (const segment of field.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor !== null && cursor !== undefined && cursor !== "";
}

export function compactDiagnostic(report: DiagnosticReport) {
  return {
    workspace: report.workspace,
    verdict: report.verdict,
    ok_count: report.items.filter(item => item.severity === "ok").length,
    items: report.items.filter(item => item.severity !== "ok"),
  };
}

export function printDiagnostic(report: DiagnosticReport, jsonOutput: boolean, compact = false): void {
  if (jsonOutput) {
    console.log(JSON.stringify(compact ? compactDiagnostic(report) : report, null, 2));
    return;
  }

  console.log(`\nAI Project Doctor\nWorkspace : ${report.workspace}\n`);
  for (const item of report.items) {
    if (compact && item.severity === "ok") continue;
    const symbol = item.severity === "ok" ? "OK" : item.severity === "warning" ? "WARN" : "BLOCK";
    console.log(`[${symbol}] ${item.message}${item.path ? ` (${item.path})` : ""}`);
  }
  if (compact) console.log(`${compactDiagnostic(report).ok_count} contrôles positifs ; détails avec doctor sans --compact.`);
  console.log(`\nVerdict : ${report.verdict}\n`);
}

export function exitCodeFor(report: DiagnosticReport): number {
  if (report.verdict === "BLOCKED") return 2;
  if (report.verdict === "WARNING") return 1;
  return 0;
}

function reportFor(workspace: string, items: DiagnosticItem[]): DiagnosticReport {
  const verdict = items.some((item) => item.severity === "blocked")
    ? "BLOCKED"
    : items.some((item) => item.severity === "warning")
      ? "WARNING"
      : "READY";
  return { verdict, workspace, items };
}

function resolveFromWorkspace(workspace: string, configuredPath: unknown): string {
  if (typeof configuredPath !== "string" || !configuredPath) return workspace;
  return isAbsolute(configuredPath) ? resolve(configuredPath) : resolve(workspace, configuredPath);
}

async function checkDirectory(
  path: string,
  code: string,
  label: string,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  try {
    const details = await stat(path);
    if (details.isDirectory()) {
      add("ok", `${code}_VALID`, `${label} existe.`, path);
    } else {
      add("blocked", `${code}_NOT_DIRECTORY`, `${label} n'est pas un dossier.`, path);
    }
  } catch {
    add("blocked", `${code}_MISSING`, `${label} est introuvable.`, path);
  }
}

async function checkFrontmatter(
  path: string,
  kind: "brief" | "state",
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  if (!(await pathExists(path))) return;
  try {
    const content = await readFile(path, "utf8");
    const parsed = parseFrontmatter(content);
    const required = kind === "brief"
      ? ["schema_version", "brief_version", "status", "approved_by", "approved_at"]
      : ["schema_version", "state_version", "stage", "status"];
    const missing = required.filter((key) => !(key in parsed.attributes));
    if (missing.length > 0) {
      add("blocked", "FRONTMATTER_FIELDS", `Champs de frontmatter manquants : ${missing.join(", ")}.`, path);
    } else {
      add("ok", "FRONTMATTER_VALID", `Le frontmatter ${kind} est lisible.`, path);
    }

    if (kind === "brief") {
      const status = parsed.attributes.status;
      const briefVersion = parsed.attributes.brief_version;
      const approvedBy = parsed.attributes.approved_by;
      const approvedAt = parsed.attributes.approved_at;
      const containsPlaceholders = /\[à compléter\]|\[À compléter\]|À compléter/.test(content);

      if (!Number.isInteger(briefVersion) || Number(briefVersion) < 1) {
        add(
          "blocked",
          "BRIEF_VERSION",
          "brief_version doit être un entier positif.",
          path,
        );
      }
      if (status !== "draft" && status !== "approved") {
        add(
          "blocked",
          "BRIEF_STATUS",
          "Le statut du brief doit être draft ou approved.",
          path,
        );
      } else if (status === "approved") {
        if (typeof approvedBy !== "string" || !approvedBy.trim()) {
          add(
            "blocked",
            "APPROVAL_IDENTITY",
            "Un brief approuvé doit identifier la personne qui l'a approuvé.",
            path,
          );
        }
        if (!isIsoCalendarDate(approvedAt)) {
          add(
            "blocked",
            "APPROVAL_DATE",
            "Un brief approuvé doit contenir une date approved_at valide au format AAAA-MM-JJ.",
            path,
          );
        }
        if (containsPlaceholders) {
          add(
            "blocked",
            "APPROVED_PLACEHOLDERS",
            "Le brief est approuvé mais contient encore des placeholders.",
            path,
          );
        }
      } else {
        if (approvedBy !== null || approvedAt !== null) {
          add(
            "blocked",
            "DRAFT_APPROVAL_METADATA",
            "Un brief brouillon ne doit conserver ni approbatrice ni date d'approbation.",
            path,
          );
        }
        if (containsPlaceholders) {
          add(
            "warning",
            "DRAFT_PLACEHOLDERS",
            "Le brief contient encore des informations à compléter.",
            path,
          );
        }
      }
    }
  } catch (error) {
    add("blocked", "FRONTMATTER_PARSE", `Frontmatter invalide : ${messageOf(error)}`, path);
  }
}

function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day;
}

interface BacklogSummary {
  backlogVersion: number;
  schemaVersion: number;
  status: string;
  itemIds: Set<string>;
  phaseIds: Set<string>;
  unconvertedLegacyLinks: number;
}

interface StrategySummary {
  strategyVersion: number;
  status: string;
  sourceBacklogVersion: number;
}

const EVIDENCE_PATH_KINDS = new Set(["report", "document", "decision"]);

/** Toute date du backlog doit être une date calendaire réelle, jamais un libellé. */
function checkDateField(
  value: unknown,
  label: string,
  fail: (code: string, message: string) => void,
): void {
  if (value === null || value === undefined) return;
  if (!isIsoCalendarDate(value)) {
    fail(
      "BACKLOG_DATE_INVALID",
      `${label} doit être une date calendaire réelle au format AAAA-MM-JJ : « ${String(value)} ».`,
    );
  }
}

function isNamed(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function checkPlanning(
  workspace: string,
  config: ProjectConfig,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const backlogPath = join(workspace, "taches", "BACKLOG.md");
  const strategyPath = join(workspace, "docs", "agent-strategy.md");

  const backlogFileExists = await pathExists(backlogPath);
  const units = await loadWorkUnits(workspace);
  const backlog = await checkBacklogDocument(workspace, backlogPath, units, add);
  await checkWorkUnitDocuments(workspace, units, backlog, add);
  const strategy = await checkAgentStrategyDocument(
    workspace,
    strategyPath,
    config,
    backlogFileExists,
    backlog,
    add,
  );

  if (backlog && strategy && strategy.sourceBacklogVersion !== backlog.backlogVersion) {
    add(
      "blocked",
      "PLAN_VERSION_MISMATCH",
      `docs/agent-strategy.md référence le backlog v${strategy.sourceBacklogVersion}, mais taches/BACKLOG.md est en v${backlog.backlogVersion}.`,
      strategyPath,
    );
  }

  await checkPlanReadyClaim(workspace, backlog, strategy, add);
}

async function checkBacklogDocument(
  workspace: string,
  path: string,
  units: WorkUnitSummary[],
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<BacklogSummary | null> {
  if (!(await pathExists(path))) return null;

  let parsed;
  try {
    parsed = parseFrontmatter(await readFile(path, "utf8"));
  } catch (error) {
    add("blocked", "BACKLOG_PARSE", `Frontmatter de taches/BACKLOG.md invalide : ${messageOf(error)}`, path);
    return null;
  }

  const schemaVersion = parsed.attributes.schema_version;
  if (schemaVersion === 1) {
    add(
      "warning",
      "BACKLOG_SCHEMA_LEGACY",
      "taches/BACKLOG.md est encore en schema_version 1. Migrer avec « ai-project backlog migrate » " +
        "pour disposer des phases, des tâches et de la roadmap générée.",
      path,
    );
    return await checkLegacyBacklogDocument(workspace, path, parsed.attributes, add);
  }
  if (schemaVersion !== 2) {
    add(
      "blocked",
      "BACKLOG_SCHEMA",
      `schema_version ${String(schemaVersion)} inconnu pour taches/BACKLOG.md (1 ou 2 attendu).`,
      path,
    );
    return null;
  }

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "backlog.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  if (!ajv.validate(schema, parsed.attributes)) {
    for (const error of ajv.errors ?? []) {
      add(
        "blocked",
        "BACKLOG_SCHEMA",
        `${error.instancePath || "/"} ${error.message ?? "est invalide"}`,
        path,
      );
    }
    return null;
  }
  add("ok", "BACKLOG_SCHEMA_VALID", "taches/BACKLOG.md respecte son schéma.", path);

  const backlog = parsed.attributes as unknown as BacklogDocument;

  checkApprovalMetadata(
    "taches/BACKLOG.md",
    backlog.status,
    backlog.approved_by,
    backlog.approved_at,
    path,
    add,
  );
  await checkBacklogSources(workspace, path, backlog.source_setup_report, backlog.source_brief_version, backlog.status, add);

  let coherent = true;
  const fail = (code: string, message: string): void => {
    add("blocked", code, message, path);
    coherent = false;
  };

  // --- Identifiants : jamais recyclés, jamais réattribués -------------------
  const phaseIds = new Set<string>();
  for (const phase of backlog.phases) {
    if (phaseIds.has(phase.id)) {
      fail("BACKLOG_PHASE_ID_DUPLICATE", `La phase ${phase.id} est déclarée plusieurs fois.`);
    }
    phaseIds.add(phase.id);
  }

  const itemIds = new Set<string>();
  const taskIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const tasksById = new Map<string, { task: BacklogTask; item: BacklogItem }>();
  for (const item of backlog.items) {
    if (itemIds.has(item.id)) {
      fail("BACKLOG_ID_DUPLICATE", `Le résultat ${item.id} est déclaré plusieurs fois.`);
    }
    itemIds.add(item.id);
    for (const task of item.tasks) {
      if (taskIds.has(task.id)) {
        fail("BACKLOG_TASK_ID_DUPLICATE", `La tâche ${task.id} est déclarée plusieurs fois.`);
      }
      taskIds.add(task.id);
      tasksById.set(task.id, { task, item });
      for (const entry of task.evidence_log) {
        if (evidenceIds.has(entry.id)) {
          fail("BACKLOG_EVIDENCE_ID_DUPLICATE", `La preuve ${entry.id} est déclarée plusieurs fois.`);
        }
        evidenceIds.add(entry.id);
      }
    }
  }

  const allocation = backlog.id_allocation;
  const numberOf = (id: string): number => Number.parseInt(id.replace(/^[A-Z]+-/, ""), 10);
  const checkAllocation = (
    label: string,
    ids: Iterable<string>,
    next: number,
  ): void => {
    for (const id of ids) {
      if (numberOf(id) >= next) {
        fail(
          "BACKLOG_ID_ALLOCATION_VIOLATION",
          `${id} est supérieur ou égal à id_allocation.${label} (${next}) : le compteur ne protège plus contre le recyclage.`,
        );
      }
    }
  };
  checkAllocation("next_phase", phaseIds, allocation.next_phase);
  checkAllocation("next_item", itemIds, allocation.next_item);
  checkAllocation("next_task", taskIds, allocation.next_task);
  checkAllocation("next_evidence", evidenceIds, allocation.next_evidence);

  for (const item of backlog.items) {
    for (const ancestor of item.derived_from) {
      if (!itemIds.has(ancestor) && numberOf(ancestor) >= allocation.next_item) {
        fail(
          "BACKLOG_DERIVED_FROM_UNKNOWN",
          `${item.id} déclare une filiation avec ${ancestor}, un identifiant jamais alloué.`,
        );
      }
    }
    for (const task of item.tasks) {
      for (const ancestor of task.derived_from) {
        if (!taskIds.has(ancestor) && numberOf(ancestor) >= allocation.next_task) {
          fail(
            "BACKLOG_DERIVED_FROM_UNKNOWN",
            `${task.id} déclare une filiation avec ${ancestor}, un identifiant jamais alloué.`,
          );
        }
      }
    }
  }

  // Le Doctor vérifie la cohérence de l'**état courant**. Il ne compare pas le
  // document à un état antérieur : sans frontière de confiance externe, une
  // édition directe et coordonnée du backlog, de ses compteurs et de ses archives
  // reste indétectable. Cette limite est énoncée dans core/contracts/planning.md.
  await checkBacklogArchives(workspace, path, add);

  // --- Phases ---------------------------------------------------------------
  checkDateField(backlog.last_reviewed_at, "taches/BACKLOG.md.last_reviewed_at", fail);

  for (const phase of backlog.phases) {
    const phaseItems = backlog.items.filter((item) => item.phase === phase.id);
    const activeItems = phaseItems.filter((item) => item.disposition === "active");

    // P2-4 : la préparation d'une phase est une trace humaine, contrôlée comme telle.
    const preparedBy = phase.prepared_by;
    const preparedAt = phase.prepared_at;
    if (preparedBy === null && preparedAt === null) {
      // Phase non préparée : rien à contrôler.
    } else if (!isNamed(preparedBy) || preparedAt === null) {
      fail(
        "BACKLOG_PHASE_PREPARATION_INCOMPLETE",
        `${phase.id} déclare une préparation incomplète : identité et date sont indissociables et l'identité ne peut être vide.`,
      );
    } else {
      checkDateField(preparedAt, `${phase.id}.prepared_at`, (code, message) =>
        fail(code === "BACKLOG_DATE_INVALID" ? "BACKLOG_PHASE_PREPARATION_DATE" : code, message),
      );
      // Préparer une phase, c'est la rendre productible : au moins un résultat
      // obligatoire y est `ready`. Les résultats lointains restent légitimement
      // des `candidate` sans tâche — c'est la planification progressive.
      const producible = activeItems.some(
        (item) => item.required && item.stage === "ready" && item.tasks.some((task) => task.required),
      );
      if (!producible) {
        fail(
          "BACKLOG_PHASE_PREPARATION_INCONSISTENT",
          `${phase.id} est déclarée préparée mais aucun de ses résultats obligatoires actifs n'est ` +
            "`ready` avec au moins une tâche obligatoire : une phase préparée doit pouvoir produire " +
            "une unité de travail. Les autres résultats peuvent rester des candidats sans tâche.",
        );
      }
    }
    if (phaseItems.length === 0) {
      if (backlog.status === "approved") {
        fail("BACKLOG_PHASE_EMPTY", `La phase ${phase.id} ne contient aucun résultat.`);
      } else {
        add(
          "warning",
          "BACKLOG_PHASE_EMPTY",
          `La phase ${phase.id} ne contient aucun résultat : à compléter avant l'approbation.`,
          path,
        );
      }
    }
    const requiredActive = activeItems.filter((item) => item.required);
    if (activeItems.length > 0 && requiredActive.length === 0 && phaseItems.some((item) => item.required)) {
      add(
        "warning",
        "BACKLOG_PHASE_ALL_REQUIRED_DEFERRED",
        `Tous les résultats obligatoires de ${phase.id} sont reportés ou retirés : la phase apparaît « optional », ce qui masque le report.`,
        path,
      );
    }
    const seenOrders = new Set<number>();
    for (const item of phaseItems) {
      if (seenOrders.has(item.order)) {
        fail(
          "BACKLOG_ORDER_DUPLICATE",
          `L'ordre ${item.order} est utilisé par plusieurs résultats de ${phase.id}.`,
        );
      }
      seenOrders.add(item.order);
    }
  }

  const phaseIndex = new Map(backlog.phases.map((phase, index) => [phase.id, index]));
  for (const item of backlog.items) {
    if (!phaseIndex.has(item.phase)) {
      fail(
        "BACKLOG_ITEM_PHASE_MISSING",
        `${item.id} référence la phase ${item.phase}, absente du backlog.`,
      );
    }
  }

  // --- Dépendances : uniquement vers l'amont --------------------------------
  const position = new Map<string, { phase: number; order: number }>();
  for (const item of backlog.items) {
    const phasePosition = phaseIndex.get(item.phase);
    if (phasePosition === undefined) continue;
    position.set(item.id, { phase: phasePosition, order: item.order });
  }
  for (const item of backlog.items) {
    for (const dependency of item.depends_on) {
      if (dependency === item.id) {
        fail("BACKLOG_DEPENDENCY_SELF", `${item.id} dépend de lui-même.`);
        continue;
      }
      if (!itemIds.has(dependency)) {
        fail(
          "BACKLOG_DEPENDENCY_MISSING",
          `${item.id} dépend de ${dependency}, absent du backlog.`,
        );
        continue;
      }
      const self = position.get(item.id);
      const other = position.get(dependency);
      if (!self || !other) continue;
      const isUpstream =
        other.phase < self.phase || (other.phase === self.phase && other.order < self.order);
      if (!isUpstream) {
        fail(
          "BACKLOG_DEPENDENCY_FORWARD",
          `${item.id} dépend de ${dependency}, situé après lui dans l'ordre des phases : l'ordre annoncé serait inexécutable.`,
        );
      }
    }
  }
  const cycle = findDependencyCycle(backlog.items);
  if (cycle) {
    fail("BACKLOG_DEPENDENCY_CYCLE", `Dépendance cyclique détectée : ${cycle.join(" → ")}.`);
  }

  // --- Tâches, preuves, découvertes ----------------------------------------
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  for (const item of backlog.items) {
    const itemState = deriveItemState(item, units);

    if (item.stage === "ready" && !item.tasks.some((task) => task.required)) {
      fail(
        "BACKLOG_READY_WITHOUT_TASK",
        `${item.id} est \`ready\` sans aucune tâche obligatoire : un résultat prêt doit être découpé assez finement pour créer une unité.`,
      );
    }

    checkDateField(item.outcome_accepted_at, `${item.id}.outcome_accepted_at`, fail);
    if (item.outcome_accepted_by !== null && !isNamed(item.outcome_accepted_by)) {
      fail(
        "BACKLOG_ITEM_ACCEPTANCE_UNEXPECTED",
        `${item.id} porte une acceptation de résultat sans identité réelle : une personne doit être nommée.`,
      );
    }

    if (itemHasAcceptance(item)) {
      const progress = itemProgress(item);
      if (progress.requiredTotal === 0 || progress.requiredDone !== progress.requiredTotal) {
        fail(
          "BACKLOG_ITEM_ACCEPTANCE_UNEXPECTED",
          `${item.id} porte une acceptation de résultat alors que ses tâches obligatoires ne sont pas toutes terminées.`,
        );
      }
      const activeUnit = workUnitsForItem(item, units).find((unit) => WORK_ACTIVE.has(unit.status));
      if (activeUnit) {
        fail(
          "BACKLOG_ITEM_DONE_WITH_ACTIVE_WORK",
          `${item.id} porte une acceptation de résultat alors que ${activeUnit.id} est encore \`${activeUnit.status}\`.`,
        );
      }
    } else if (Boolean(item.outcome_accepted_by) !== Boolean(item.outcome_accepted_at)) {
      fail(
        "BACKLOG_ITEM_ACCEPTANCE_UNEXPECTED",
        `${item.id} porte une acceptation de résultat incomplète : identité et date sont indissociables.`,
      );
    }

    for (const task of item.tasks) {
      const state = deriveTaskState(task);
      const valid = validEvidence(task);
      checkDateField(task.added_at, `${task.id}.added_at`, fail);
      checkDateField(task.dropped_at, `${task.id}.dropped_at`, fail);

      if (valid.length > 1) {
        fail(
          "BACKLOG_EVIDENCE_MULTIPLE_VALID",
          `${task.id} porte ${valid.length} preuves valables : une seule preuve courante est possible.`,
        );
      }
      if (task.disposition !== "active" && valid.length > 0) {
        fail(
          "BACKLOG_TASK_DISPOSITION_CONTRADICTS_EVIDENCE",
          `${task.id} porte une preuve valable et une disposition \`${task.disposition}\` : invalider la preuve avant de bloquer ou d'abandonner la tâche.`,
        );
      }
      if (task.disposition === "blocked" && !isNamed(task.blocked_reason)) {
        fail("BACKLOG_TASK_BLOCKED_UNEXPLAINED", `${task.id} est bloquée sans raison de blocage.`);
      }
      if (task.disposition === "dropped") {
        if (!isNamed(task.dropped_by) || !task.dropped_at || !isNamed(task.dropped_reason)) {
          fail(
            "BACKLOG_TASK_DROPPED_UNDECIDED",
            `${task.id} est abandonnée sans décision complète (personne, date et raison).`,
          );
        }
        if (task.required) {
          add(
            "warning",
            "BACKLOG_TASK_DROPPED_STILL_REQUIRED",
            `${task.id} est abandonnée mais reste obligatoire : ${item.id} restera bloqué jusqu'à une décision substantielle.`,
            path,
          );
        }
      }

      for (const entry of task.evidence_log) {
        checkDateField(entry.recorded_at, `${entry.id}.recorded_at`, fail);
        checkDateField(entry.state_at, `${entry.id}.state_at`, fail);
        if (entry.state === "valid") {
          if (entry.state_reason || entry.state_at) {
            fail(
              "BACKLOG_EVIDENCE_STATE_UNEXPLAINED",
              `${entry.id} est valable mais porte un motif ou une date de changement d'état.`,
            );
          }
        } else if (!isNamed(entry.state_reason) || !entry.state_at) {
          fail(
            "BACKLOG_EVIDENCE_STATE_UNEXPLAINED",
            `${entry.id} est \`${entry.state}\` sans motif ni date : une preuve n'est jamais écartée en silence.`,
          );
        }
        if (entry.kind === "observation" && !isNamed(entry.observed_by)) {
          fail(
            "BACKLOG_TASK_EVIDENCE_OBSERVER_MISSING",
            `${entry.id} est une observation sans observateur nommé.`,
          );
        }
        if (entry.kind === "commit" && !/^[0-9a-f]{7,40}$/.test(entry.ref)) {
          fail(
            "BACKLOG_TASK_EVIDENCE_REF_MISSING",
            `${entry.id} déclare un commit dont la référence « ${entry.ref} » n'est pas une empreinte Git.`,
          );
        }
        if (EVIDENCE_PATH_KINDS.has(entry.kind)) {
          const reference = entry.ref.split("#")[0] ?? "";
          if (!reference || isAbsolute(reference)) {
            fail(
              "BACKLOG_TASK_EVIDENCE_REF_MISSING",
              `${entry.id} doit référencer un chemin relatif au workspace : ${entry.ref}.`,
            );
          } else {
            const target = join(workspace, reference);
            const canonicalTarget = await canonicalPath(target);
            if (!isPathInsideOrEqual(canonicalTarget, workspace) || !(await pathExists(target))) {
              fail(
                "BACKLOG_TASK_EVIDENCE_REF_MISSING",
                `${entry.id} référence ${reference}, introuvable dans le workspace.`,
              );
            }
          }
        }
      }

      if (state === "done" && task.category === "human") {
        const current = valid[0];
        if (current && current.kind !== "observation") {
          fail(
            "BACKLOG_TASK_HUMAN_EVIDENCE_INVALID",
            `${task.id} est une vérification humaine : seule une preuve \`observation\` avec observateur nommé peut la valider.`,
          );
        }
      }

      if (task.origin === "discovered") {
        if (!task.source_work || !task.origin_reason || !task.added_at) {
          fail(
            "BACKLOG_TASK_DISCOVERED_INVALID",
            `${task.id} est déclarée découverte sans unité d'origine, motif ou date.`,
          );
          continue;
        }
        const source = unitById.get(task.source_work);
        if (!source || !WORK_APPROVED_OR_LATER.has(source.status)) {
          fail(
            "BACKLOG_TASK_DISCOVERED_INVALID",
            `${task.id} est découverte dans ${task.source_work}, qui n'existe pas ou n'est pas approuvée.`,
          );
          continue;
        }
        const itemTaskIds = new Set(item.tasks.map((entry) => entry.id));
        if (!source.realizes.some((realized) => itemTaskIds.has(realized))) {
          fail(
            "BACKLOG_TASK_DISCOVERED_INVALID",
            `${task.id} est découverte dans ${task.source_work}, qui ne réalise aucune tâche de ${item.id} : une élaboration ne change pas de résultat.`,
          );
        }
        if (itemState === "built" || itemState === "done") {
          fail(
            "BACKLOG_TASK_DISCOVERED_INVALID",
            `${task.id} est ajoutée à ${item.id} déjà \`${itemState}\` : rouvrir un résultat démontré est un changement substantiel.`,
          );
        }
        const reportPath = join(workspace, "reports", "work", `${task.source_work}.md`);
        if (!(await pathExists(reportPath))) {
          fail(
            "BACKLOG_TASK_DISCOVERED_UNREPORTED",
            `${task.id} est découverte dans ${task.source_work} mais reports/work/${task.source_work}.md est absent.`,
          );
        } else {
          const report = await readFile(reportPath, "utf8");
          if (!report.includes(task.id)) {
            fail(
              "BACKLOG_TASK_DISCOVERED_UNREPORTED",
              `${task.id} n'est pas mentionnée dans reports/work/${task.source_work}.md.`,
            );
          }
        }
      } else if (task.source_work || task.origin_reason || task.added_at) {
        fail(
          "BACKLOG_TASK_DISCOVERED_INVALID",
          `${task.id} est déclarée planifiée mais porte des métadonnées de découverte.`,
        );
      }
    }
  }

  // --- Liens historiques ----------------------------------------------------
  let unconvertedLegacyLinks = 0;
  for (const item of backlog.items) {
    const itemTaskIds = new Set(item.tasks.map((task) => task.id));
    for (const workId of item.legacy_work_items) {
      const unit = unitById.get(workId);
      if (!unit) {
        // P2-7 : ne jamais décrire comme « introuvable » un fichier présent mais illisible.
        const exists = await pathExists(join(workspace, "taches", `${workId}.md`));
        fail(
          exists ? "BACKLOG_LEGACY_LINK_UNREADABLE" : "BACKLOG_LEGACY_LINK_MISSING",
          exists
            ? `${item.id} conserve un lien historique vers ${workId}, présent dans taches/ mais illisible : le lien ne peut pas être vérifié tant que le document n'est pas interprétable.`
            : `${item.id} conserve un lien historique vers ${workId}, absent de taches/.`,
        );
        continue;
      }
      if (unit.realizes.some((taskId) => itemTaskIds.has(taskId))) {
        add(
          "warning",
          "BACKLOG_LEGACY_LINK_CONVERTED",
          `${workId} réalise déjà des tâches de ${item.id} : le lien historique peut être retiré de legacy_work_items.`,
          path,
        );
      } else {
        unconvertedLegacyLinks += 1;
      }
    }
  }
  if (unconvertedLegacyLinks > 0) {
    add(
      "warning",
      "BACKLOG_LEGACY_LINK_PENDING",
      `${unconvertedLegacyLinks} lien(s) historique(s) restent à convertir en realizes avant PLAN_READY.`,
      path,
    );
  }

  // --- Vue générée ----------------------------------------------------------
  const markerField = findMarkerInFields(backlog);
  if (markerField) {
    fail(
      "BACKLOG_MARKER_IN_FIELD",
      `${markerField} contient un marqueur de bloc généré : le bloc et le récit deviendraient indissociables.`,
    );
  }

  let markersUsable = true;
  try {
    analyzeMarkers(parsed.body);
  } catch (error) {
    markersUsable = false;
    fail(
      "BACKLOG_VIEW_MARKERS_MALFORMED",
      error instanceof MarkerLayoutError ? error.message : messageOf(error),
    );
  }

  if (markersUsable && !markerField) {
    const rendered = renderRoadmap(backlog, units);
    try {
      assertRenderedMarkersAbsent(rendered);
    } catch (error) {
      fail(
        "BACKLOG_MARKER_IN_FIELD",
        error instanceof MarkerLayoutError ? error.message : messageOf(error),
      );
    }
    if (extractRoadmapBlock(parsed.body) === null) {
      fail(
        "BACKLOG_VIEW_MISSING",
        "Le bloc de roadmap généré est absent de taches/BACKLOG.md. Le régénérer avec « ai-project backlog sync-view ».",
      );
    } else if (!roadmapBlockIsCurrent(parsed.body, rendered)) {
      fail(
        "BACKLOG_VIEW_STALE",
        "La vue générée de taches/BACKLOG.md ne correspond plus aux données structurées. " +
          "La régénérer avec « ai-project backlog sync-view ».",
      );
    }
  }

  // --- Titres du récit ------------------------------------------------------
  const narrative = narrativeOutsideBlock(parsed.body);
  for (const item of backlog.items) {
    const headingPattern = new RegExp(`^#{2,6}\\s+${item.id}\\s+—\\s+(.+)$`, "m");
    const match = narrative.match(headingPattern);
    if (match?.[1] !== undefined && match[1].trim() !== item.title) {
      fail(
        "BACKLOG_HEADING_MISMATCH",
        `La section « ${item.id} — ${match[1].trim()} » ne correspond pas au titre du frontmatter « ${item.title} ».`,
      );
    }
  }

  if (coherent) {
    add(
      "ok",
      "BACKLOG_ITEMS_VALID",
      "Les phases, résultats, tâches et preuves du backlog sont structurellement cohérents.",
      path,
    );
  }

  return {
    backlogVersion: backlog.backlog_version,
    schemaVersion: 2,
    status: backlog.status,
    itemIds,
    phaseIds,
    unconvertedLegacyLinks,
  };
}

function narrativeOutsideBlock(body: string): string {
  const begin = body.indexOf(VIEW_BEGIN);
  if (begin === -1) return body;
  const end = body.indexOf(VIEW_END, begin + VIEW_BEGIN.length);
  if (end === -1) return body.slice(0, begin);
  return body.slice(0, begin) + body.slice(end + VIEW_END.length);
}




/**
 * Les archives sont un historique du workflow officiel, pas une frontière de
 * confiance. Une archive illisible reste signalée : elle n'est jamais ignorée.
 */
async function checkBacklogArchives(
  workspace: string,
  path: string,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const directory = join(workspace, "docs", "internal", "backlog-history");
  if (!(await pathExists(directory))) return;
  for (const entry of (await readdir(directory)).sort()) {
    if (!entry.endsWith(".md")) continue;
    try {
      parseFrontmatter(await readFile(join(directory, entry), "utf8"));
    } catch (error) {
      add(
        "warning",
        "BACKLOG_ARCHIVE_UNREADABLE",
        `L'archive docs/internal/backlog-history/${entry} est illisible : ${messageOf(error)}.`,
        path,
      );
    }
  }
}

async function checkBacklogSources(
  workspace: string,
  path: string,
  sourceSetupReport: string,
  sourceBriefVersion: number,
  status: string,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  if (isAbsolute(sourceSetupReport)) {
    add(
      "blocked",
      "BACKLOG_SETUP_REPORT_PATH",
      `taches/BACKLOG.md.source_setup_report doit être un chemin relatif au workspace : ${sourceSetupReport}.`,
      path,
    );
  } else {
    const setupReportPath = join(workspace, sourceSetupReport);
    const canonicalSetupReportPath = await canonicalPath(setupReportPath);
    if (!isPathInsideOrEqual(canonicalSetupReportPath, workspace)) {
      add(
        "blocked",
        "BACKLOG_SETUP_REPORT_PATH",
        `taches/BACKLOG.md.source_setup_report sort du workspace : ${sourceSetupReport}.`,
        path,
      );
    } else if (!(await pathExists(setupReportPath))) {
      add(
        "blocked",
        "BACKLOG_SETUP_REPORT_MISSING",
        `taches/BACKLOG.md référence un rapport de setup introuvable : ${sourceSetupReport}.`,
        path,
      );
    }
  }

  if (status === "approved" && (await pathExists(join(workspace, "PROJECT_BRIEF.md")))) {
    try {
      const brief = parseFrontmatter(await readFile(join(workspace, "PROJECT_BRIEF.md"), "utf8"));
      const currentBriefVersion = brief.attributes.brief_version;
      if (
        typeof currentBriefVersion === "number" &&
        currentBriefVersion !== sourceBriefVersion
      ) {
        add(
          "blocked",
          "BACKLOG_BRIEF_STALE",
          `Le backlog approuvé référence le brief v${sourceBriefVersion}, mais PROJECT_BRIEF.md est en v${currentBriefVersion}. Le backlog doit être réévalué.`,
          path,
        );
      }
    } catch {
      // Le brief invalide est déjà signalé par checkFrontmatter ; ne pas dupliquer le constat ici.
    }
  }
}

/** Contrôles conservés pour les workspaces encore en schema_version 1. */
async function checkLegacyBacklogDocument(
  workspace: string,
  path: string,
  attributes: Record<string, unknown>,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<BacklogSummary | null> {
  const schema = JSON.parse(
    await readFile(join(schemasRoot, "backlog.v1.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  if (!ajv.validate(schema, attributes)) {
    for (const error of ajv.errors ?? []) {
      add(
        "blocked",
        "BACKLOG_SCHEMA",
        `${error.instancePath || "/"} ${error.message ?? "est invalide"}`,
        path,
      );
    }
    return null;
  }
  add("ok", "BACKLOG_SCHEMA_VALID", "taches/BACKLOG.md respecte le schéma v1 gelé.", path);

  const legacy = attributes as unknown as {
    backlog_version: number;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
    source_brief_version: number;
    source_setup_report: string;
    candidates: Array<{
      id: string;
      status: string;
      rank: number;
      priority: string;
      depends_on: string[];
      work_items: string[];
    }>;
  };

  checkApprovalMetadata(
    "taches/BACKLOG.md",
    legacy.status,
    legacy.approved_by,
    legacy.approved_at,
    path,
    add,
  );
  await checkBacklogSources(
    workspace,
    path,
    legacy.source_setup_report,
    legacy.source_brief_version,
    legacy.status,
    add,
  );

  let coherent = true;
  const fail = (code: string, message: string): void => {
    add("blocked", code, message, path);
    coherent = false;
  };

  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  for (const candidate of legacy.candidates) {
    if (seenIds.has(candidate.id)) {
      fail("BACKLOG_ID_DUPLICATE", `Le candidat ${candidate.id} est déclaré plusieurs fois.`);
    }
    seenIds.add(candidate.id);
    if (seenRanks.has(candidate.rank)) {
      fail("BACKLOG_RANK_DUPLICATE", `Le rang ${candidate.rank} est utilisé par plusieurs candidats.`);
    }
    seenRanks.add(candidate.rank);
  }

  for (const candidate of legacy.candidates) {
    for (const dependency of candidate.depends_on) {
      if (dependency === candidate.id) {
        fail("BACKLOG_DEPENDENCY_SELF", `${candidate.id} dépend de lui-même.`);
      } else if (!seenIds.has(dependency)) {
        fail(
          "BACKLOG_DEPENDENCY_MISSING",
          `${candidate.id} dépend de ${dependency}, absent du backlog.`,
        );
      }
    }
  }
  const cycle = findDependencyCycle(legacy.candidates);
  if (cycle) {
    fail("BACKLOG_DEPENDENCY_CYCLE", `Dépendance cyclique détectée dans le backlog : ${cycle.join(" → ")}.`);
  }

  const activeStates = new Set(["candidate", "ready", "selected", "done", "deferred"]);
  const activeOwners = new Map<string, string[]>();
  for (const candidate of legacy.candidates) {
    for (const workItemId of candidate.work_items) {
      if (!(await pathExists(join(workspace, "taches", `${workItemId}.md`)))) {
        fail(
          "BACKLOG_WORK_ITEM_MISSING",
          `${candidate.id} référence ${workItemId}, introuvable dans taches/.`,
        );
      }
      if (activeStates.has(candidate.status)) {
        const owners = activeOwners.get(workItemId) ?? [];
        owners.push(candidate.id);
        activeOwners.set(workItemId, owners);
      }
    }

    if ((candidate.status === "selected" || candidate.status === "done") && candidate.work_items.length === 0) {
      fail(
        "BACKLOG_WORK_ITEM_REQUIRED",
        `${candidate.id} est ${candidate.status} mais ne référence aucune unité de travail.`,
      );
      continue;
    }

    if (candidate.status === "selected") {
      let approved = false;
      for (const workItemId of candidate.work_items) {
        const status = await readWorkItemStatus(workspace, workItemId);
        if (status && WORK_APPROVED_OR_LATER.has(status)) approved = true;
      }
      if (!approved) {
        fail(
          "BACKLOG_SELECTION_UNAPPROVED",
          `${candidate.id} est selected mais aucune unité liée n'a un statut approved ou postérieur.`,
        );
      }
    }

    if (candidate.status === "done") {
      let accepted = false;
      for (const workItemId of candidate.work_items) {
        if ((await readWorkItemStatus(workspace, workItemId)) === "accepted") accepted = true;
      }
      if (!accepted) {
        fail(
          "BACKLOG_DONE_UNACCEPTED",
          `${candidate.id} est done mais aucune unité liée n'a le statut accepted.`,
        );
      }
    }
  }
  for (const [workItemId, owners] of activeOwners) {
    if (owners.length > 1) {
      fail(
        "BACKLOG_WORK_ITEM_MULTIPLE_ACTIVE",
        `${workItemId} est référencé par plusieurs candidats actifs : ${owners.join(", ")}.`,
      );
    }
  }

  if (coherent) {
    add("ok", "BACKLOG_CANDIDATES_VALID", "Les candidats du backlog sont structurellement cohérents.", path);
  }

  return {
    backlogVersion: legacy.backlog_version,
    schemaVersion: 1,
    status: legacy.status,
    itemIds: seenIds,
    phaseIds: new Set<string>(),
    unconvertedLegacyLinks: 0,
  };
}

/** Contrôles portés par les unités : liens, lot transversal, orphelins. */
async function checkWorkUnitDocuments(
  workspace: string,
  units: WorkUnitSummary[],
  backlog: BacklogSummary | null,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  // P2-7 : signaler d'abord les unités présentes mais illisibles.
  for (const broken of await listUnreadableWorkUnits(workspace)) {
    add(
      "blocked",
      "WORK_ITEM_PARSE",
      `${broken.id} est présent dans taches/ mais son frontmatter est illisible : ${broken.reason}.`,
      broken.path,
    );
  }

  if (units.length === 0) return;

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "work-item.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  let taskOwner = new Map<string, string>();
  if (backlog?.schemaVersion === 2) {
    const loaded = await readBacklogFile(workspace);
    if (loaded?.schemaVersion === 2) {
      const document = loaded.attributes as unknown as BacklogDocument;
      taskOwner = new Map(
        document.items.flatMap((item) => item.tasks.map((task) => [task.id, item.id] as const)),
      );
    }
  }

  for (const unit of units) {
    // `loadWorkUnits` a déjà écarté les documents illisibles, signalés plus haut
    // par `WORK_ITEM_PARSE` : ceux qui parviennent ici sont interprétables.
    const attributes = parseFrontmatter(await readFile(unit.path, "utf8")).attributes;
    if (!ajv.validate(schema, attributes)) {
      for (const error of ajv.errors ?? []) {
        add(
          "blocked",
          "WORK_ITEM_SCHEMA",
          `${unit.id}${error.instancePath || "/"} ${error.message ?? "est invalide"}`,
          unit.path,
        );
      }
      continue;
    }
    if (attributes.id !== unit.id) {
      add(
        "blocked",
        "WORK_ITEM_ID_MISMATCH",
        `${unit.id}.md déclare l'identifiant ${String(attributes.id)} : le nom du fichier et le champ id doivent être identiques.`,
        unit.path,
      );
      continue;
    }

    if (backlog?.schemaVersion !== 2) continue;

    const owners = new Set<string>();
    for (const taskId of unit.realizes) {
      const owner = taskOwner.get(taskId);
      if (!owner) {
        add(
          "blocked",
          "WORK_REALIZES_UNKNOWN_TASK",
          `${unit.id} réalise ${taskId}, absente de taches/BACKLOG.md.`,
          unit.path,
        );
        continue;
      }
      owners.add(owner);
    }

    if (owners.size > 1 && !unit.crossCutting) {
      add(
        "blocked",
        "WORK_CROSSES_ITEMS",
        `${unit.id} réalise des tâches de plusieurs résultats (${[...owners].sort().join(", ")}) sans cross_cutting: true.`,
        unit.path,
      );
    }
    if (unit.crossCutting && !hasSubstantiveJustification(unit.body)) {
      add(
        "blocked",
        "WORK_CROSS_CUTTING_UNJUSTIFIED",
        `${unit.id} est déclarée transversale sans justification réelle : la section ` +
          "« ## Justification du lot transversal » doit contenir une explication rédigée, " +
          "pas seulement son titre ni le texte à remplacer du modèle.",
        unit.path,
      );
    }

    if (
      unit.realizes.length === 0 &&
      backlog.status === "approved" &&
      WORK_APPROVED_OR_LATER.has(unit.status)
    ) {
      // P2-8 : la voie d'urgence repose sur une métadonnée explicite, jamais sur une
      // phrase narrative — « ce n'est pas urgent » ne doit pas valoir autorisation.
      if (attributes.unplanned_urgent !== true) {
        add(
          "warning",
          "WORK_REALIZES_MISSING",
          `${unit.id} est ${unit.status} sans realizes alors que le backlog approuvé est en v2.`,
          unit.path,
        );
      }
    }
  }
}

/**
 * Une justification réelle : du texte rédigé sous le titre, avant la section
 * suivante — ni le titre seul, ni le passage à remplacer livré par le modèle.
 */
function hasSubstantiveJustification(body: string): boolean {
  const match = body.match(/^##\s+Justification du lot transversal\s*$/m);
  if (!match || match.index === undefined) return false;
  const after = body.slice(match.index + match[0].length);
  const nextHeading = after.search(/^#{1,6}\s/m);
  const section = (nextHeading === -1 ? after : after.slice(0, nextHeading))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^\[.*\]$/.test(line))
    .join(" ");
  return section.length >= 40;
}

async function readWorkItemStatus(workspace: string, workItemId: string): Promise<string | null> {
  const path = join(workspace, "taches", `${workItemId}.md`);
  if (!(await pathExists(path))) return null;
  try {
    const parsed = parseFrontmatter(await readFile(path, "utf8"));
    return typeof parsed.attributes.status === "string" ? parsed.attributes.status : null;
  } catch {
    return null;
  }
}

function findDependencyCycle(
  candidates: Array<{ id: string; depends_on: string[] }>,
): string[] | null {
  const graph = new Map(candidates.map((candidate) => [candidate.id, candidate.depends_on]));
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    if (onStack.has(id)) {
      const cycleStart = stack.indexOf(id);
      return [...stack.slice(cycleStart), id];
    }
    if (visited.has(id)) return null;
    visited.add(id);
    onStack.add(id);
    stack.push(id);
    for (const dependency of graph.get(id) ?? []) {
      if (dependency === id || !graph.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    onStack.delete(id);
    return null;
  }

  for (const id of graph.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

async function checkAgentStrategyDocument(
  workspace: string,
  path: string,
  config: ProjectConfig,
  backlogFileExists: boolean,
  backlog: BacklogSummary | null,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<StrategySummary | null> {
  if (!(await pathExists(path))) return null;

  if (!backlogFileExists) {
    add(
      "blocked",
      "AGENT_STRATEGY_BACKLOG_MISSING",
      "docs/agent-strategy.md existe mais taches/BACKLOG.md est absent.",
      path,
    );
  }

  let parsed;
  try {
    parsed = parseFrontmatter(await readFile(path, "utf8"));
  } catch (error) {
    add(
      "blocked",
      "AGENT_STRATEGY_PARSE",
      `Frontmatter de docs/agent-strategy.md invalide : ${messageOf(error)}`,
      path,
    );
    return null;
  }

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "agent-strategy.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  if (!ajv.validate(schema, parsed.attributes)) {
    for (const error of ajv.errors ?? []) {
      add(
        "blocked",
        "AGENT_STRATEGY_SCHEMA",
        `${error.instancePath || "/"} ${error.message ?? "est invalide"}`,
        path,
      );
    }
    return null;
  }
  add("ok", "AGENT_STRATEGY_SCHEMA_VALID", "docs/agent-strategy.md respecte son schéma.", path);

  const attributes = parsed.attributes as {
    strategy_version: number;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
    source_backlog_version: number;
    entries: Array<{
      id: string;
      covers: string[];
      mode: string;
      agent_id: string | null;
    }>;
  };

  checkApprovalMetadata(
    "docs/agent-strategy.md",
    attributes.status,
    attributes.approved_by,
    attributes.approved_at,
    path,
    add,
  );

  const seenIds = new Set<string>();
  let entriesCoherent = true;
  let coreCatalogIds: Set<string> | null = null;

  for (const entry of attributes.entries) {
    if (seenIds.has(entry.id)) {
      add("blocked", "AGENT_STRATEGY_ID_DUPLICATE", `L'entrée ${entry.id} est déclarée plusieurs fois.`, path);
      entriesCoherent = false;
    } else {
      seenIds.add(entry.id);
    }

    if (backlog) {
      for (const coveredId of entry.covers) {
        const known = coveredId.startsWith("PH-")
          ? backlog.phaseIds.has(coveredId)
          : backlog.itemIds.has(coveredId);
        if (!known) {
          add(
            "blocked",
            "AGENT_STRATEGY_CANDIDATE_MISSING",
            `${entry.id} couvre ${coveredId}, absent de taches/BACKLOG.md.`,
            path,
          );
          entriesCoherent = false;
        }
      }
    }

    if (entry.mode === "core_agent") {
      if (!entry.agent_id) {
        add(
          "blocked",
          "AGENT_STRATEGY_AGENT_ID_REQUIRED",
          `${entry.id} recommande un agent du noyau sans identifiant.`,
          path,
        );
        entriesCoherent = false;
      } else {
        coreCatalogIds ??= new Set((await loadAgentCatalog()).agents.map((agent) => agent.id));
        if (!coreCatalogIds.has(entry.agent_id)) {
          add(
            "blocked",
            "AGENT_STRATEGY_UNKNOWN_CORE_AGENT",
            `${entry.id} recommande ${entry.agent_id}, absent du catalogue d'agents du noyau.`,
            path,
          );
          entriesCoherent = false;
        }
      }
    } else if (entry.mode === "custom_agent") {
      // L'existence de agents/<id>/ n'est jamais exigée ici : une recommandation peut précéder la création.
      if (!entry.agent_id) {
        add(
          "blocked",
          "AGENT_STRATEGY_AGENT_ID_REQUIRED",
          `${entry.id} recommande un agent personnalisé sans identifiant proposé.`,
          path,
        );
        entriesCoherent = false;
      }
    } else if (entry.agent_id !== null) {
      add(
        "blocked",
        "AGENT_STRATEGY_UNEXPECTED_AGENT_ID",
        `${entry.id} est en mode ${entry.mode} et ne doit porter aucun identifiant d'agent.`,
        path,
      );
      entriesCoherent = false;
    }

    if (entry.agent_id && (config.agents ?? []).some((agent) => agent.id === entry.agent_id)) {
      add(
        "ok",
        "AGENT_STRATEGY_PROVISIONED",
        `${entry.id} recommande ${entry.agent_id}, déjà installé dans ce workspace.`,
        path,
      );
    }
  }

  if (entriesCoherent) {
    add("ok", "AGENT_STRATEGY_ENTRIES_VALID", "Les entrées de la stratégie d'agents sont cohérentes.", path);
  }

  return {
    strategyVersion: attributes.strategy_version,
    status: attributes.status,
    sourceBacklogVersion: attributes.source_backlog_version,
  };
}

function checkApprovalMetadata(
  label: string,
  status: string,
  approvedBy: unknown,
  approvedAt: unknown,
  path: string,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): void {
  if (status === "approved") {
    if (typeof approvedBy !== "string" || !approvedBy.trim()) {
      add(
        "blocked",
        "PLAN_APPROVAL_IDENTITY",
        `${label} approuvé doit identifier la personne qui l'a approuvé.`,
        path,
      );
    }
    if (!isIsoCalendarDate(approvedAt)) {
      add(
        "blocked",
        "PLAN_APPROVAL_DATE",
        `${label} approuvé doit contenir une date approved_at valide au format AAAA-MM-JJ.`,
        path,
      );
    }
  } else if (approvedBy !== null || approvedAt !== null) {
    add(
      "blocked",
      "PLAN_DRAFT_APPROVAL_METADATA",
      `${label} en brouillon ne doit conserver ni approbatrice ni date d'approbation.`,
      path,
    );
  }
}

async function checkPlanReadyClaim(
  workspace: string,
  backlog: BacklogSummary | null,
  strategy: StrategySummary | null,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const statePath = join(workspace, "PROJECT_STATE.md");
  if (!(await pathExists(statePath))) return;

  let planVersion: unknown;
  try {
    const parsed = parseFrontmatter(await readFile(statePath, "utf8"));
    planVersion = parsed.attributes.plan_version;
  } catch {
    return;
  }
  if (planVersion === undefined || planVersion === null) return;
  if (typeof planVersion !== "number") {
    add(
      "blocked",
      "PLAN_VERSION_INVALID",
      "PROJECT_STATE.md.plan_version doit être un entier ou null.",
      statePath,
    );
    return;
  }

  if (!backlog || backlog.status !== "approved" || backlog.backlogVersion !== planVersion) {
    add(
      "blocked",
      "PLAN_READY_BACKLOG_MISMATCH",
      `PROJECT_STATE.md affirme plan_version ${planVersion}, mais taches/BACKLOG.md est absent, non approuvé, ou d'une autre version.`,
      statePath,
    );
  }
  if (!strategy || strategy.status !== "approved" || strategy.sourceBacklogVersion !== planVersion) {
    add(
      "blocked",
      "PLAN_READY_STRATEGY_MISMATCH",
      `PROJECT_STATE.md affirme plan_version ${planVersion}, mais docs/agent-strategy.md est absent, non approuvé, ou référence une autre version de backlog.`,
      statePath,
    );
  }
  if (backlog && backlog.unconvertedLegacyLinks > 0) {
    add(
      "blocked",
      "PLAN_READY_LEGACY_LINKS_PENDING",
      `PROJECT_STATE.md affirme plan_version ${planVersion}, mais ${backlog.unconvertedLegacyLinks} lien(s) historique(s) du backlog ne sont pas encore convertis en realizes. Utiliser la route legacy-link-conversion de project-work.`,
      statePath,
    );
  }
}

async function checkPrivateLeaks(
  codeRoot: string,
  privatePaths: string[],
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  const fixedPrivatePaths = [
    ...privatePaths,
    "PROJECT_BRIEF.md",
    "PROJECT_STATE.md",
    "ai-workspace/",
    ".codex/",
    "livraisons/",
  ];
  const unique = [...new Set(fixedPrivatePaths)].filter(
    (path) => !path.includes("*") && path.replace(/\/$/, "") !== ".claude",
  );

  let leakFound = await checkClaudeDirectory(codeRoot, add);

  for (const privatePath of unique) {
    const candidate = join(codeRoot, privatePath.replace(/\/$/, ""));
    if (await pathExists(candidate)) {
      leakFound = true;
      add("blocked", "PRIVATE_LEAK", "Un élément privé est présent dans le code root.", candidate);
    }
  }

  if (!leakFound) {
    add("ok", "PRIVATE_CLEAR", "Aucun élément privé connu n'est présent dans le code root.");
  }
}

/**
 * Claude Code recrée systématiquement `.claude/.cc-writes/` (répertoire vide) dans
 * `code_root` dès qu'il y écrit, car `permissions.additionalDirectories` y pointe.
 * Ce marqueur runtime est toléré ; toute autre présence sous `.claude/` reste bloquante.
 */
async function checkClaudeDirectory(
  codeRoot: string,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<boolean> {
  const claudePath = join(codeRoot, ".claude");
  let claudeStat;
  try {
    claudeStat = await lstat(claudePath);
  } catch {
    return false;
  }

  if (claudeStat.isDirectory()) {
    const entries = await readdir(claudePath);
    if (entries.length === 1 && entries[0] === ".cc-writes") {
      const markerPath = join(claudePath, ".cc-writes");
      const markerStat = await lstat(markerPath);
      if (markerStat.isDirectory()) {
        const markerEntries = await readdir(markerPath);
        if (markerEntries.length === 0) {
          add(
            "ok",
            "CLAUDE_CODE_RUNTIME_MARKER",
            "Marqueur runtime Claude Code vide reconnu (.claude/.cc-writes) — aucune fuite privée.",
            markerPath,
          );
          return false;
        }
      }
    }
  }

  add("blocked", "PRIVATE_LEAK", "Un élément privé est présent dans le code root.", claudePath);
  return true;
}

async function checkTrackedSensitiveFiles(
  repositoryRoot: string,
  config: ProjectConfig,
  add: (severity: DiagnosticSeverity, code: string, message: string, path?: string) => void,
): Promise<void> {
  if (!(await pathExists(join(repositoryRoot, ".git")))) return;
  let tracked: string[] = [];
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    tracked = output.split("\0").filter(Boolean);
  } catch {
    add("warning", "GIT_LS_FILES", "Impossible de lire la liste des fichiers suivis par Git.");
    return;
  }

  const sensitive = tracked.filter((path) =>
    isSecretLike(path, config.privacy?.secret_patterns ?? []) ||
    (config.privacy?.private_paths ?? []).some((privatePath) =>
      !privatePath.includes("*") && path.startsWith(privatePath.replace(/\/$/, "")),
    ),
  );

  if (sensitive.length > 0) {
    for (const path of sensitive) {
      add("blocked", "TRACKED_SENSITIVE", "Un fichier sensible est suivi par Git.", join(repositoryRoot, path));
    }
  } else {
    add("ok", "TRACKED_CLEAR", "Aucun fichier sensible connu n'est suivi par Git.");
  }
}

function isSecretLike(path: string, patterns: string[]): boolean {
  const normalized = path.replaceAll("\\", "/");
  const name = basename(normalized);
  if ([".env.example", ".env.sample", ".env.template"].includes(name)) return false;
  if (name === ".env" || name.startsWith(".env.")) return true;
  if (normalized.split("/").includes("secrets")) return true;
  if (name === "credentials" || name.startsWith("credentials.")) return true;

  return patterns.some((pattern) => {
    if (pattern === ".env") return name === ".env";
    if (pattern === ".env.*") return name.startsWith(".env.");
    if (pattern.includes("secrets")) return normalized.split("/").includes("secrets");
    if (pattern.includes("credentials")) return name.startsWith("credentials.");
    return false;
  });
}

function isDangerousRoot(path: string): boolean {
  return path === parse(path).root || path === resolve(homedir());
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
