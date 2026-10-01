import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalPath } from "./fs-safe.js";

export type PhaseSource = { path: string; sha256: string };

/** Local reference snapshots only. Reading a reference never approves its content. */
export async function fingerprintSource(workspace: string, ref: string) {
  if (typeof ref !== "string" || !ref || isAbsolute(ref) || /^[A-Za-z]:/.test(ref) ||
      ref.includes("\\") || ref.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Référence : chemin relatif au workspace requis, sans traversée ni lien symbolique.");
  }
  let file = await canonicalPath(workspace);
  for (const segment of ref.split("/")) {
    file = join(file, segment);
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`Référence liée symboliquement : ${ref}`);
  }
  if (!(await lstat(file)).isFile()) throw new Error(`Référence non fichier : ${ref}`);
  const content = await readFile(file);
  return { path: ref, sha256: createHash("sha256").update(content).digest("hex"), bytes: content.length };
}

export async function inspectPhaseSources(workspace: string, sources: PhaseSource[] = []) {
  return Promise.all(sources.map(async source => {
    try {
      const actual = await fingerprintSource(workspace, source.path);
      return { ...source, actual_sha256: actual.sha256, current: actual.sha256 === source.sha256, error: null };
    } catch (error) {
      return { ...source, actual_sha256: null, current: false, error: error instanceof Error ? error.message : String(error) };
    }
  }));
}

export async function requireCurrentSources(workspace: string, sources: PhaseSource[] = []) {
  const stale = (await inspectPhaseSources(workspace, sources)).filter(s => !s.current);
  if (stale.length) throw new Error(`Références modifiées ou absentes : ${stale.map(s => s.path).join(", ")}. Examiner les écarts puis réviser le plan dans le mandat applicable ; ne pas remplacer les empreintes sans examen.`);
}
