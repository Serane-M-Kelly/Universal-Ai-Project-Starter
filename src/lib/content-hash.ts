import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { canonicalPath } from "./fs-safe.js";

export function hashText(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function hashDirectory(directoryPath: string): Promise<string> {
  const hash = createHash("sha256");
  const root = await canonicalPath(directoryPath);

  async function visit(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const candidate = join(path, entry.name);
      const details = await lstat(candidate);
      const portablePath = relative(root, candidate).replaceAll("\\", "/");
      if (details.isSymbolicLink()) {
        throw new Error(`Un lien symbolique est interdit dans un contenu géré : ${candidate}`);
      }
      if (details.isDirectory()) {
        hash.update(`directory\0${portablePath}\0`);
        await visit(candidate);
      } else if (details.isFile()) {
        hash.update(`file\0${portablePath}\0`);
        hash.update(await readFile(candidate));
        hash.update("\0");
      } else {
        throw new Error(`Type de fichier non pris en charge : ${candidate}`);
      }
    }
  }

  await visit(root);
  return hash.digest("hex");
}
