import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, normalize, sep } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { pathExists } from "./fs-safe.js";
import { profilesRoot, schemasRoot } from "./paths.js";
import type { EntryMode, ProfileManifest } from "../types.js";

const profileIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listProfiles(): Promise<ProfileManifest[]> {
  const entries = await readdir(profilesRoot, { withFileTypes: true });
  const profileIds = entries
    .filter((entry) => entry.isDirectory() && profileIdPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(profileIds.map((profileId) => loadProfile(profileId)));
}

export async function loadProfile(profileId: string): Promise<ProfileManifest> {
  if (!profileIdPattern.test(profileId)) {
    throw new Error(`Identifiant de profil invalide : ${profileId}`);
  }

  const manifestPath = join(profilesRoot, profileId, "profile.yaml");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Profil introuvable : ${profileId}`);
  }

  let manifest: unknown;
  try {
    manifest = YAML.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Le profil ${profileId} est illisible : ${messageOf(error)}`);
  }

  const schema = JSON.parse(
    await readFile(join(schemasRoot, "profile.schema.json"), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const valid = ajv.validate(schema, manifest);
  if (!valid) {
    const details = (ajv.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
      .join(" ; ");
    throw new Error(`Le profil ${profileId} ne respecte pas son schéma : ${details}`);
  }

  const typedManifest = manifest as ProfileManifest;
  if (typedManifest.profile.id !== profileId) {
    throw new Error(
      `Le manifeste du profil ${profileId} déclare l'identifiant ${typedManifest.profile.id}.`,
    );
  }

  const occupiedCommands = new Set<string>();
  for (const command of typedManifest.commands.required) {
    for (const mode of typedManifest.compatibility.entry_modes) {
      occupiedCommands.add(`${command}\u0000${mode}`);
    }
  }
  for (const requirement of typedManifest.commands.required_by_entry_mode) {
    validateRequirementModes(typedManifest, requirement.entry_modes);
    for (const mode of requirement.entry_modes) {
      const key = `${requirement.name}\u0000${mode}`;
      if (occupiedCommands.has(key)) {
        throw new Error(
          `Le profil ${profileId} exige plusieurs fois la commande ${requirement.name} en mode ${mode}.`,
        );
      }
      occupiedCommands.add(key);
    }
  }

  const occupiedPaths = new Set<string>();
  for (const requirement of typedManifest.validation.required_paths) {
    if (!isSafeRelativePath(requirement.path)) {
      throw new Error(
        `Le profil ${profileId} contient un chemin de validation dangereux : ${requirement.path}`,
      );
    }
    validateRequirementModes(typedManifest, requirement.entry_modes);
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      const key = `${requirement.path}\u0000${mode}`;
      if (occupiedPaths.has(key)) {
        throw new Error(
          `Le profil ${profileId} déclare plusieurs exigences de chemin pour ${requirement.path} en mode ${mode}.`,
        );
      }
      occupiedPaths.add(key);
    }
  }

  const occupiedPathAlternatives = new Set<string>();
  for (const requirement of typedManifest.validation.any_of_paths) {
    validateRequirementModes(typedManifest, requirement.entry_modes);
    const alternativePaths = new Set<string>();
    for (const alternative of requirement.alternatives) {
      if (!isSafeRelativePath(alternative.path)) {
        throw new Error(
          `Le profil ${profileId} contient un chemin alternatif dangereux : ${alternative.path}`,
        );
      }
      if (alternativePaths.has(alternative.path)) {
        throw new Error(
          `Le profil ${profileId} répète le chemin alternatif ${alternative.path} pour ${requirement.label}.`,
        );
      }
      alternativePaths.add(alternative.path);
    }
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      const key = `${requirement.label}\u0000${mode}`;
      if (occupiedPathAlternatives.has(key)) {
        throw new Error(
          `Le profil ${profileId} déclare plusieurs alternatives de chemin nommées ${requirement.label} en mode ${mode}.`,
        );
      }
      occupiedPathAlternatives.add(key);
    }
  }

  const occupiedMatchAlternatives = new Set<string>();
  for (const requirement of typedManifest.validation.any_of_matches) {
    validateRequirementModes(typedManifest, requirement.entry_modes);
    const patterns = new Set<string>();
    for (const alternative of requirement.alternatives) {
      if (!isSafeRelativeGlob(alternative.pattern)) {
        throw new Error(
          `Le profil ${profileId} contient un motif de validation dangereux : ${alternative.pattern}`,
        );
      }
      if (patterns.has(alternative.pattern)) {
        throw new Error(
          `Le profil ${profileId} répète le motif ${alternative.pattern} pour ${requirement.label}.`,
        );
      }
      patterns.add(alternative.pattern);
    }
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      const key = `${requirement.label}\u0000${mode}`;
      if (occupiedMatchAlternatives.has(key)) {
        throw new Error(
          `Le profil ${profileId} déclare plusieurs recherches nommées ${requirement.label} en mode ${mode}.`,
        );
      }
      occupiedMatchAlternatives.add(key);
    }
  }

  const occupiedTextMatches = new Set<string>();
  for (const requirement of typedManifest.validation.required_text_matches) {
    validateRequirementModes(typedManifest, requirement.entry_modes);
    for (const pattern of requirement.patterns) {
      if (!isSafeRelativeGlob(pattern)) {
        throw new Error(
          `Le profil ${profileId} contient un motif de contenu dangereux : ${pattern}`,
        );
      }
    }
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      const key = `${requirement.label}\u0000${mode}`;
      if (occupiedTextMatches.has(key)) {
        throw new Error(
          `Le profil ${profileId} déclare plusieurs contrôles de contenu nommés ${requirement.label} en mode ${mode}.`,
        );
      }
      occupiedTextMatches.add(key);
    }
  }

  const occupiedJsonFields = new Set<string>();
  for (const requirement of typedManifest.validation.required_json_fields) {
    if (!isSafeRelativePath(requirement.path)) {
      throw new Error(
        `Le profil ${profileId} contient un manifeste JSON dangereux : ${requirement.path}`,
      );
    }
    validateRequirementModes(typedManifest, requirement.entry_modes);
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      for (const field of requirement.fields) {
        const key = `${requirement.path}\u0000${field}\u0000${mode}`;
        if (occupiedJsonFields.has(key)) {
          throw new Error(
            `Le profil ${profileId} déclare plusieurs contrôles pour ${requirement.path}:${field} en mode ${mode}.`,
          );
        }
        occupiedJsonFields.add(key);
      }
    }
  }

  const occupiedJsonAlternatives = new Set<string>();
  for (const requirement of typedManifest.validation.any_of_json_fields) {
    if (!isSafeRelativePath(requirement.path)) {
      throw new Error(
        `Le profil ${profileId} contient un manifeste JSON alternatif dangereux : ${requirement.path}`,
      );
    }
    validateRequirementModes(typedManifest, requirement.entry_modes);
    const fieldSet = [...requirement.fields].sort().join("\u0000");
    for (const mode of requirement.entry_modes ?? typedManifest.compatibility.entry_modes) {
      const key = `${requirement.path}\u0000${fieldSet}\u0000${mode}`;
      if (occupiedJsonAlternatives.has(key)) {
        throw new Error(
          `Le profil ${profileId} répète la même alternative JSON pour ${requirement.path} en mode ${mode}.`,
        );
      }
      occupiedJsonAlternatives.add(key);
    }
  }

  return typedManifest;
}

function validateRequirementModes(
  profile: ProfileManifest,
  modes: EntryMode[] | undefined,
): void {
  for (const mode of modes ?? []) {
    if (!profile.compatibility.entry_modes.includes(mode)) {
      throw new Error(
        `Le profil ${profile.profile.id} applique une exigence au mode incompatible ${mode}.`,
      );
    }
  }
}

export function assertProfileSupportsEntryMode(
  profile: ProfileManifest,
  entryMode: EntryMode,
): void {
  if (!profile.compatibility.entry_modes.includes(entryMode)) {
    throw new Error(
      `Le profil ${profile.profile.id} ne prend pas en charge le mode d'entrée ${entryMode}.`,
    );
  }
}

function isSafeRelativePath(path: string): boolean {
  if (!path || isAbsolute(path)) return false;
  const normalized = normalize(path);
  return normalized !== ".." && !normalized.startsWith(`..${sep}`);
}

function isSafeRelativeGlob(pattern: string): boolean {
  if (!pattern || isAbsolute(pattern) || pattern.includes("\\")) return false;
  return !pattern.split("/").some((segment) => segment === "..");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
