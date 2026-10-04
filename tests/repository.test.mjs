import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";

const starterRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemasRoot = join(starterRoot, "core", "schemas");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertRegularFile(path) {
  const details = await lstat(path);
  assert.equal(details.isFile(), true, `Fichier régulier attendu : ${path}`);
  assert.equal(details.isSymbolicLink(), false, `Lien symbolique interdit : ${path}`);
}

function validate(schema, value, label) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validator = ajv.compile(schema);
  assert.equal(
    validator(value),
    true,
    `${label} invalide : ${JSON.stringify(validator.errors)}`,
  );
}

test("les versions du paquet, du verrou et du modèle projet restent alignées", async () => {
  const packageJson = await readJson(join(starterRoot, "package.json"));
  const packageLock = await readJson(join(starterRoot, "package-lock.json"));
  const projectTemplate = YAML.parse(
    await readFile(join(starterRoot, "core", "templates", "project.yaml"), "utf8"),
  );

  assert.equal(packageJson.version, packageLock.version);
  assert.equal(packageJson.version, packageLock.packages[""].version);
  assert.equal(packageJson.version, projectTemplate.starter_version);
  assert.equal(packageJson.engines.node, ">=22");
  assert.equal(packageLock.packages[""].engines.node, ">=22");
});

test("tous les schémas JSON sont syntaxiquement valides et compilables", async () => {
  const schemaNames = (await readdir(schemasRoot))
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
  assert.deepEqual(schemaNames, [
    "adapter.schema.json",
    "agent-catalog.schema.json",
    "agent-strategy.schema.json",
    "agent.schema.json",
    "backlog.schema.json",
    "backlog.v1.schema.json",
    "product-package.schema.json",
    "profile.schema.json",
    "project.schema.json",
    "skill-catalog.schema.json",
    "work-item.schema.json",
    "workflow.schema.json",
  ]);

  for (const schemaName of schemaNames) {
    const schema = await readJson(join(schemasRoot, schemaName));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    assert.doesNotThrow(() => ajv.compile(schema), `${schemaName} ne compile pas.`);
  }
});

test("la fixture product-package respecte le contrat d'échange v1", async () => {
  const manifest = YAML.parse(
    await readFile(
      join(starterRoot, "tests", "fixtures", "product-package-ready", "manifest.yaml"),
      "utf8",
    ),
  );
  validate(
    await readJson(join(schemasRoot, "product-package.schema.json")),
    manifest,
    "Product-package prêt",
  );
  for (const file of Object.values(manifest.contents)) {
    await assertRegularFile(
      join(starterRoot, "tests", "fixtures", "product-package-ready", file),
    );
  }
});

test("les catalogues référencent uniquement des sources complètes et valides", async () => {
  const skillCatalog = YAML.parse(
    await readFile(join(starterRoot, "core", "skills", "catalog.yaml"), "utf8"),
  );
  validate(
    await readJson(join(schemasRoot, "skill-catalog.schema.json")),
    skillCatalog,
    "Catalogue de skills",
  );
  for (const skill of skillCatalog.skills) {
    const source = join(starterRoot, "core", "skills", skill.source);
    await assertRegularFile(join(source, "SKILL.md"));
    await assertRegularFile(join(source, "agents", "openai.yaml"));
  }

  const agentCatalog = YAML.parse(
    await readFile(join(starterRoot, "core", "agents", "catalog.yaml"), "utf8"),
  );
  validate(
    await readJson(join(schemasRoot, "agent-catalog.schema.json")),
    agentCatalog,
    "Catalogue d'agents",
  );
  const agentSchema = await readJson(join(schemasRoot, "agent.schema.json"));
  for (const entry of agentCatalog.agents) {
    const source = join(starterRoot, "core", "agents", entry.source);
    const manifest = YAML.parse(await readFile(join(source, "agent.yaml"), "utf8"));
    validate(agentSchema, manifest, `Agent ${entry.id}`);
    assert.equal(manifest.agent.id, entry.id);
    const instructions = await readFile(join(source, "instructions.md"), "utf8");
    assert.ok(instructions.trim().length >= 40);
  }
});

test("les profils et adaptateurs livrés respectent leur contrat et possèdent leurs modèles", async () => {
  const profileSchema = await readJson(join(schemasRoot, "profile.schema.json"));
  for (const profileId of ["generic", "nextjs", "node-api", "swiftui", "wordpress"]) {
    const profile = YAML.parse(
      await readFile(join(starterRoot, "profiles", profileId, "profile.yaml"), "utf8"),
    );
    validate(profileSchema, profile, `Profil ${profileId}`);
    assert.equal(profile.profile.id, profileId);
  }

  const adapterSchema = await readJson(join(schemasRoot, "adapter.schema.json"));
  for (const adapterId of ["codex", "claude-code"]) {
    const root = join(starterRoot, "adapters", adapterId);
    const manifest = YAML.parse(await readFile(join(root, "adapter.yaml"), "utf8"));
    validate(adapterSchema, manifest, `Adaptateur ${adapterId}`);
    assert.equal(manifest.adapter.id, adapterId);
    assert.ok(manifest.directories.includes(manifest.skills.destination));
    assert.ok(manifest.directories.includes(manifest.agents.destination));
    for (const output of manifest.outputs) {
      await assertRegularFile(join(root, output.template));
    }

    const historicalRoot = join(root, "versions", "v3");
    const historical = YAML.parse(
      await readFile(join(historicalRoot, "adapter.yaml"), "utf8"),
    );
    validate(adapterSchema, historical, `Adaptateur historique ${adapterId} v3`);
    assert.equal(historical.adapter.id, adapterId);
    assert.equal(historical.adapter.version, 3);
    for (const output of historical.outputs) {
      await assertRegularFile(join(historicalRoot, output.template));
    }
  }
});

test("les fixtures restent des entrées ordinaires sans lien symbolique", async () => {
  const fixturesRoot = join(starterRoot, "tests", "fixtures");
  const pending = [fixturesRoot];
  let fileCount = 0;
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const details = await lstat(path);
      assert.equal(details.isSymbolicLink(), false, `Fixture symbolique interdite : ${path}`);
      if (details.isDirectory()) pending.push(path);
      if (details.isFile()) fileCount += 1;
    }
  }
  assert.ok(fileCount >= 9, "Les fixtures attendues sont incomplètes.");
});

test("la fixture Node/API respecte réellement son contrat TypeScript strict", () => {
  execFileSync(
    process.execPath,
    [
      join(starterRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(starterRoot, "tests", "fixtures", "existing-node-api", "tsconfig.json"),
      "--noEmit",
    ],
    { cwd: starterRoot, stdio: "pipe" },
  );
});

test("les fins de ligne ne sont jamais converties : fixtures et références identiques partout", async () => {
  const attributes = await readFile(join(starterRoot, ".gitattributes"), "utf8");
  assert.ok(attributes.split(/\n/).some((line) => line.trim() === "* -text"));
});

test("la validation continue reste en lecture seule, multi-version et épinglée", async () => {
  const workflow = YAML.parse(
    await readFile(join(starterRoot, ".github", "workflows", "quality.yml"), "utf8"),
  );
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.deepEqual(workflow.jobs["node-compatibility"].strategy.matrix.node, [22, 24, 26]);
  assert.deepEqual(
    workflow.jobs["operating-systems"].strategy.matrix.os,
    ["macos-latest"],
  );
  // macOS et Linux sont pris en charge et bloquants ; aucun job n'est autorisé à échouer.
  for (const job of Object.values(workflow.jobs)) assert.equal(job["continue-on-error"], undefined);

  for (const job of Object.values(workflow.jobs)) {
    assert.equal(job["timeout-minutes"], 30);
    assert.ok(job.steps.some((step) => step.run === "npm run validate"));
    for (const step of job.steps.filter((candidate) => candidate.uses)) {
      assert.match(
        step.uses,
        /^[a-z0-9-]+\/[a-z0-9-]+@[a-f0-9]{40}$/,
        `Action non épinglée : ${step.uses}`,
      );
    }
  }

  const dependabot = YAML.parse(
    await readFile(join(starterRoot, ".github", "dependabot.yml"), "utf8"),
  );
  assert.equal(dependabot.version, 2);
  assert.deepEqual(
    dependabot.updates.map((update) => update["package-ecosystem"]),
    ["npm", "github-actions"],
  );
});
