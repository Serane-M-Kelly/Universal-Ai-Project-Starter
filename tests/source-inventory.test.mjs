import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tree, hash } from "../dist/lib/phase-workflow.js";
import { examineChanges } from "../dist/lib/evidence-continuity.js";

import { isGeneratedNextEnv, isPrivateEnvFile, isGeneratedCacheDirectory } from "../dist/lib/source-inventory.js";

const nextGenerated = [
  '/// <reference types="next" />',
  '/// <reference types="next/image-types/global" />',
  '/// <reference path="./.next/types/routes.d.ts" />',
  '',
  '// NOTE: This file should not be edited',
  '// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.',
  '',
].join("\n");

test("inventory: generated files ignored; security-sensitive source remains tracked", async t => {
  const root = await mkdtemp(join(tmpdir(), "starter-inventory-"));
  t.after(() => rm(root, { recursive:true, force:true }));
  await mkdir(join(root,"supabase/migrations"),{recursive:true});
  await mkdir(join(root,"supabase/.temp"),{recursive:true});
  await mkdir(join(root,".npm-cache"),{recursive:true});
  await writeFile(join(root,"next-env.d.ts"),nextGenerated);
  await writeFile(join(root,"supabase/.temp/project-ref"),"local");
  await writeFile(join(root,".npm-cache/log"),"cache");
  await writeFile(join(root,"supabase/migrations/0001.sql"),"create table invoices(id int)");
  await writeFile(join(root,"supabase/config.toml"),"[api]\nenabled = true");
  await writeFile(join(root,".env.example"),"DATABASE_URL=your-value");
  const first = await tree(root);
  assert.equal(first["next-env.d.ts"],undefined);
  assert.equal(first["supabase/.temp/project-ref"],undefined);
  assert.equal(first[".npm-cache/log"],undefined);
  assert.ok(first["supabase/migrations/0001.sql"]);
  assert.ok(first[".env.example"]);
  await writeFile(join(root,"next-env.d.ts"),nextGenerated.replace('/// <reference path="./.next/types/routes.d.ts" />',""));
  assert.deepEqual(await tree(root),first,"Next generated declaration differences must remain ignored");
  await writeFile(join(root,"supabase/migrations/0001.sql"),"drop table invoices");
  assert.notEqual(hash(await tree(root)),hash(first));
  await writeFile(join(root,"next-env.d.ts"),nextGenerated+"declare global { interface Window { hacked: true } }\n");
  assert.ok((await tree(root))["next-env.d.ts"],"custom source must not be discarded");
});

test("inventory: private env is never content-read, but tracked by metadata", async t => {
  const root = await mkdtemp(join(tmpdir(), "starter-private-env-"));
  t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(join(root,".env.local"),"TOKEN=alpha");
  const before = await tree(root);
  assert.ok(before[".env.local"]);
  assert.equal(Object.values(before).some(x=>x.includes("alpha")),false);
  await writeFile(join(root,".env.local"),"TOKEN=beta-extended");
  assert.notEqual((await tree(root))[".env.local"],before[".env.local"]);
  await writeFile(join(root,".env.example"),"TOKEN=example");
  assert.ok((await tree(root))[".env.example"]);
  await symlink(".env.local",join(root,"source-link"));
  await assert.rejects(()=>tree(root),/symbolique/);
});

test("inventory: classifications reject broad implicit excludes",()=>{
  assert.equal(isPrivateEnvFile(".env.local"),true);
  assert.equal(isPrivateEnvFile(".env.example"),false);
  assert.equal(isGeneratedCacheDirectory("supabase",".temp"),true);
  assert.equal(isGeneratedCacheDirectory("other",".temp"),false);
  assert.equal(isGeneratedCacheDirectory("",".npm-cache"),true);
  assert.equal(isGeneratedCacheDirectory("src",".npm-cache"),false);
  assert.equal(isGeneratedNextEnv("src/next-env.d.ts","custom"),false);
});

test("inventory: documentary change never reads private env during continuity", async t => {
  const root = await mkdtemp(join(tmpdir(), "starter-private-continuity-"));
  t.after(() => rm(root,{recursive:true,force:true}));
  await writeFile(join(root,".env.local"),"TOKEN=private-secret");
  await writeFile(join(root,"README.md"),"# Before");
  await writeFile(join(root,"src.js"),"export const ready = true");
  const before = await tree(root);
  await writeFile(join(root,"README.md"),"# After");
  const after = await tree(root);
  const result = await examineChanges(root,before,after);
  assert.deepEqual(result.changes.map(x=>x.path),["README.md"]);
  assert.ok(result.signals);
});
