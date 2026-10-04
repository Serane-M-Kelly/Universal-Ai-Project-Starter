import { isAbsolute, relative, resolve, sep } from "node:path";
export function slugify(value) {
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
export function portableRelative(from, to) {
    const result = relative(from, to).split(sep).join("/");
    return result || ".";
}
export function isPathInsideOrEqual(candidate, parent) {
    const result = relative(resolve(parent), resolve(candidate));
    return result === "" || (result !== ".." &&
        !result.startsWith(`..${sep}`) &&
        !isAbsolute(result));
}
export function replaceProjectName(template, projectName) {
    return template.replaceAll("[Nom du projet]", projectName);
}
//# sourceMappingURL=text.js.map