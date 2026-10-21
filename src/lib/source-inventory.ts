/** Explicit v3 inventory classification. No global .gitignore interpretation. */
export function isPrivateEnvFile(path: string): boolean {
  const name = path.split("/").at(-1) ?? "";
  return /^\.env(?:\..+)?$/.test(name) &&
    !/\.(?:example|sample|template|dist)$/.test(name);
}

/** Only well-known cache folders, never arbitrary user directories or SQL migrations. */
export function isGeneratedCacheDirectory(parent: string, name: string): boolean {
  if (!parent && name === ".npm-cache") return true;
  const segments = parent.split("/").filter(Boolean);
  return segments.at(-1) === "supabase" && name === ".temp";
}

/**
 * Next.js regenerates this declaration file on dev/build/typegen.
 * Suppress ONLY its known boilerplate. Any custom/unknown declaration is tracked.
 */
export function isGeneratedNextEnv(path: string, content: string): boolean {
  if ((path.split("/").at(-1) ?? "") !== "next-env.d.ts") return false;
  const lines = content.replace(/\r\n/g, "\n").trim().split("\n").map(x => x.trim());
  if (!lines.includes('/// <reference types="next" />') ||
      !lines.includes('/// <reference types="next/image-types/global" />')) return false;
  return lines.every(line =>
    !line ||
    /^\/\/\/ <reference types="next(?:\/image-types\/global)?" \/>$/.test(line) ||
    /^\/\/\/ <reference path="\.\/\.next\/types\/routes\.d\.ts" \/>$/.test(line) ||
    /^import ["']\.\/\.next\/types\/routes\.d\.ts["'];?$/.test(line) ||
    line === "// NOTE: This file should not be edited" ||
    /^\/\/ see https:\/\/nextjs\.org\/docs\/\S+(?: for more information\.)?$/.test(line)
  );
}
