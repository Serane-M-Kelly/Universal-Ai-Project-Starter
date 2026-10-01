import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const coreRoot = join(packageRoot, "core");
export const templatesRoot = join(coreRoot, "templates");
export const schemasRoot = join(coreRoot, "schemas");
export const skillsRoot = join(coreRoot, "skills");
export const profilesRoot = join(packageRoot, "profiles");
export const adaptersRoot = join(packageRoot, "adapters");
export const agentsRoot = join(coreRoot, "agents");

export function resolveWorkspace(inputPath: string): string {
  const candidate = resolve(inputPath);

  if (existsSync(join(candidate, "project.yaml"))) {
    return candidate;
  }

  if (existsSync(join(candidate, "ai-workspace", "project.yaml"))) {
    return join(candidate, "ai-workspace");
  }

  throw new Error(
    `Aucun workspace trouvé depuis ${candidate}. Le fichier project.yaml est introuvable.`,
  );
}
