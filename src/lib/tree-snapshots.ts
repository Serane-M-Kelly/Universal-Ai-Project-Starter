/** Detailed source-tree inventories, content-addressed by the engine's code hash. Never edited by agents. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, writeFileAtomic } from "./fs-safe.js";

export const TREES = "reports/trees";

const sha256 = (raw: string): string => createHash("sha256").update(raw, "utf8").digest("hex");
const location = (w: string, code: string): string => {
  if (!/^[a-f0-9]{64}$/.test(code)) throw new Error("Empreinte de révision invalide.");
  return join(w, TREES, `${code}.json`);
};

/** The serialized inventory is exactly the input of sourceHash: its SHA-256 must equal `code`. */
export async function storeTree(w: string, tree: Record<string, string>, code: string): Promise<string> {
  const raw = JSON.stringify(tree);
  if (sha256(raw) !== code) throw new Error("Inventaire incohérent avec l'empreinte calculée.");
  const path = location(w, code);
  if (!(await pathExists(path)) || sha256(await readFile(path, "utf8")) !== code) await writeFileAtomic(path, raw);
  return `${TREES}/${code}.json`;
}

/** Returns null when no inventory was recorded (proofs from runtimes before 0.25.0). */
export async function loadTree(w: string, code: string): Promise<Record<string, string> | null> {
  const path = location(w, code);
  if (!(await pathExists(path))) return null;
  const raw = await readFile(path, "utf8");
  if (sha256(raw) !== code) throw new Error(`Inventaire de révision modifié : ${TREES}/${code}.json. Ne pas le corriger à la main.`);
  return JSON.parse(raw) as Record<string, string>;
}
