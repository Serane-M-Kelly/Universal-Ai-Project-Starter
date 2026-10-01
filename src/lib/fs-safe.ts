import { access, mkdir, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function canonicalPath(path: string): Promise<string> {
  let cursor = resolve(path);
  const missingSegments: string[] = [];

  while (!(await pathExists(cursor))) {
    const parent = dirname(cursor);
    if (parent === cursor) {
      return resolve(path);
    }
    missingSegments.unshift(basename(cursor));
    cursor = parent;
  }

  return join(await realpath(cursor), ...missingSegments);
}

export async function assertDestinationAvailable(path: string): Promise<void> {
  if (!(await pathExists(path))) {
    return;
  }

  const entries = await readdir(path);
  if (entries.length > 0) {
    throw new Error(`Le dossier cible existe déjà et n'est pas vide : ${path}`);
  }
}

export async function writeNewFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: "utf8", flag: "wx" });
}

export async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}
