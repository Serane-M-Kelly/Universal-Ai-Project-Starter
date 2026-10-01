import { isAbsolute, relative, resolve, sep } from "node:path";

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Impossible de produire un slug valide à partir du nom fourni.");
  }

  return slug;
}

export function portableRelative(from: string, to: string): string {
  const result = relative(from, to).split(sep).join("/");
  return result || ".";
}

export function isPathInsideOrEqual(candidate: string, parent: string): boolean {
  const result = relative(resolve(parent), resolve(candidate));
  return result === "" || (
    result !== ".." &&
    !result.startsWith(`..${sep}`) &&
    !isAbsolute(result)
  );
}

export function replaceProjectName(template: string, projectName: string): string {
  return template.replaceAll("[Nom du projet]", projectName);
}
