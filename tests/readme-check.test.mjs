import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { checkReadme } from "../dist/lib/readme-check.js";
import { hashDirectory } from "../dist/lib/content-hash.js";

const fixtures = resolve("tests/fixtures/readme");
const cli = resolve("dist/index.js");
async function copy(t, name) {
  const base = await mkdtemp(join(tmpdir(), "starter-readme-"));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3 }));
  const root = join(base, name);
  await cp(join(fixtures, name), root, { recursive: true });
  return root;
}
async function edit(root, from, to) {
  const path = join(root, "README.md"), text = await readFile(path, "utf8");
  assert.ok(text.includes(from), `fixture sans « ${from} »`);
  await writeFile(path, text.replace(from, to));
}
const codes = (result, severity) => result.findings.filter(f => !severity || f.severity === severity).map(f => f.code);

test("README guidés : site statique, API configurée et extension WordPress sans erreur ni avertissement", async () => {
  const expectations = {
    "static-site": { local_links: 3, anchors: 1, commands: 5, license_sources: 2 },
    "api-env": { local_links: 3, commands: 5, env_variables: 3, license_sources: 2 },
    "wordpress-plugin": { local_links: 1, commands: 4, license_sources: 3 },
  };
  for (const [name, minimum] of Object.entries(expectations)) {
    const result = await checkReadme(join(fixtures, name));
    assert.deepEqual(codes(result).filter(c => !["EXTERNAL_LINK_UNVERIFIED", "CLAIM_TO_CONFIRM"].includes(c)), [], name);
    for (const [key, value] of Object.entries(minimum)) assert.ok(result.checked[key] >= value, `${name}: ${key}`);
    assert.equal(result.advisory, true);
    assert.match(result.limits, /^L'absence d'avertissement ne prouve pas que le README est exact ou complet\./);
  }
});

test("site statique : liens, ancres, scripts, affirmation recopiée, licence et attribution contrôlés", async (t) => {
  const cases = [
    ["[architecture](docs/architecture.md)", "[architecture](docs/inexistant.md)", "LINK_MISSING"],
    ["[limites](#limites-et-données)", "[limites](#limites-connues)", "ANCHOR_MISSING"],
    ["npm run preview   # servir dist/ localement", "npm run deploy", "SCRIPT_MISSING"],
    ["Aucune adresse publique n'est encore ouverte.", "La page porte une balise `noindex`.", "CLAIM_UNSUPPORTED"],
    ["- **Code** : licence MIT, voir [LICENSE](LICENSE).", "- **Code** : licence Apache 2.0.", "LICENSE_MISMATCH"],
    ["- **Code** : licence MIT, voir [LICENSE](LICENSE).", "- **Code** : aucune licence n'est attribuée ; tous droits réservés.", "LICENSE_MISMATCH"],
    ["- **Police** : Inter, sous SIL Open Font License 1.1 ; texte de licence dans [`public/fonts/OFL-Inter.txt`](public/fonts/OFL-Inter.txt).", "", "ATTRIBUTION_NOT_REFERENCED"],
    ["Détails : [architecture]", "Suivi interne : ai-workspace/BACKLOG.md, preuve e-12. Détails : [architecture]", "INTERNAL_TERM"],
    ["npm ci            # installer les dépendances du verrou", "pnpm install", "PACKAGE_MANAGER_MISMATCH"],
  ];
  for (const [from, to, code] of cases) {
    const root = await copy(t, "static-site");
    await edit(root, from, to);
    const result = await checkReadme(root);
    assert.ok(codes(result).includes(code), `${code} attendu, obtenu ${codes(result)}`);
  }
  // A Calepio claim about storage is contradicted by this product, which uses localStorage.
  const root = await copy(t, "static-site");
  await edit(root, "- Liste de randonnées favorites conservée dans le navigateur.", "- Aucune donnée n'est enregistrée ni envoyée.");
  const claim = (await checkReadme(root)).findings.find(f => f.code === "CLAIM_CONTRADICTED");
  assert.match(claim.message, /src\/main\.js/);
});

test("API : variables d'exemple, secrets, commandes et affirmations confrontées au dépôt", async (t) => {
  let root = await copy(t, "api-env");
  await edit(root, "| `API_TOKEN` | Jeton attendu dans `Authorization: Bearer`. |\n", "");
  await edit(root, "Un seul jeton partagé (`API_TOKEN`)", "Un seul jeton partagé");
  let result = await checkReadme(root);
  assert.ok(result.findings.some(f => f.code === "ENV_UNDOCUMENTED" && f.message.includes("API_TOKEN")));

  root = await copy(t, "api-env");
  await edit(root, "cp .env.example .env\n", "cp .env.example .env\nAPI_TOKEN=sk_live_51HxQ2c9\n");
  assert.ok(codes(await checkReadme(root), "error").includes("POSSIBLE_SECRET"));
  root = await copy(t, "api-env");
  await edit(root, "cp .env.example .env\n", "cp .env.example .env\nAPI_TOKEN=<jeton>\n");
  assert.equal(codes(await checkReadme(root)).includes("POSSIBLE_SECRET"), false, "un exemple n'est pas un secret");

  root = await copy(t, "api-env");
  await edit(root, "| `PORT` |", "| `REDIS_URL` | Cache. |\n| `PORT` |");
  assert.ok((await checkReadme(root)).findings.some(f => f.code === "ENV_UNKNOWN" && f.message.includes("REDIS_URL")));

  root = await copy(t, "api-env");
  await rm(join(root, ".env.example"));
  assert.ok(codes(await checkReadme(root), "error").includes("COMMAND_FILE_MISSING"));
  assert.ok(codes(await checkReadme(root), "error").includes("ENV_EXAMPLE_MISSING"));

  root = await copy(t, "api-env");
  await edit(root, "pnpm dev          # redémarre", "npm run dev      # redémarre");
  result = await checkReadme(root);
  assert.ok(codes(result).includes("PACKAGE_MANAGER_MISMATCH"));
  assert.equal(codes(result).includes("SCRIPT_MISSING"), false, "le script existe : seul le gestionnaire diverge");

  root = await copy(t, "api-env");
  await edit(root, "- Un seul jeton partagé", "- Aucune donnée n'est enregistrée ni transmise, aucun traceur.\n- Un seul jeton partagé");
  await writeFile(join(root, "src/notify.js"), "export const notify = (url, body) => fetch(url, { method: 'POST', body });\n");
  assert.ok(codes(await checkReadme(root), "warning").includes("CLAIM_CONTRADICTED"));
});

test("WordPress : pas de commandes npm sans package.json, licence GPL imposée par l'en-tête", async (t) => {
  let root = await copy(t, "wordpress-plugin");
  await edit(root, "composer install   # dépendances de test", "npm install");
  await edit(root, "composer test      # PHPUnit", "npm test");
  let result = await checkReadme(root);
  assert.equal(codes(result, "error").filter(c => c === "COMMAND_WITHOUT_PACKAGE").length, 2);

  root = await copy(t, "wordpress-plugin");
  await edit(root, "GPL-2.0-or-later, comme WordPress", "Licence MIT");
  result = await checkReadme(root);
  const mismatch = result.findings.find(f => f.code === "LICENSE_MISMATCH");
  assert.match(mismatch.message, /MIT.*GPL/);

  root = await copy(t, "wordpress-plugin");
  await edit(root, "composer test      # PHPUnit", "composer lint");
  assert.ok((await checkReadme(root)).findings.some(f => f.code === "SCRIPT_MISSING" && f.message.includes("lint")));

  root = await copy(t, "wordpress-plugin");
  await rm(join(root, "composer.json"));
  assert.ok(codes(await checkReadme(root), "error").includes("COMMAND_FILE_MISSING"));
});

test("reprise conservatrice : informations utiles retirées signalées, réécriture fidèle acceptée, lecture seule", async (t) => {
  const root = await copy(t, "api-env");
  const git = (args) => { const r = spawnSync("git", args, { cwd: root, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git(["init", "-b", "main"]); git(["config", "user.name", "Fixture"]); git(["config", "user.email", "fixture@local.invalid"]);
  git(["add", "-A"]); git(["commit", "-m", "README existant"]);
  const previous = await readFile(join(root, "README.md"), "utf8");
  // A careless rewrite drops security, configuration and a command.
  await writeFile(join(root, "README.md"), "# Relais de rendez-vous\n\nAPI des créneaux libres.\n\n## Commandes\n\n```bash\npnpm install\npnpm test\n```\n\n## Licence\n\nApache License 2.0, voir [LICENSE](LICENSE).\n");
  const before = await hashDirectory(root);
  const careless = spawnSync(process.execPath, [cli, "workflow", "readme-check", "--code-root", root, "--previous-ref", "HEAD"], { encoding: "utf8" });
  assert.equal(careless.status, 0, careless.stderr);
  assert.equal(await hashDirectory(root), before, "readme-check n'écrit rien");
  const removed = JSON.parse(careless.stdout).findings.filter(f => f.code === "INFO_REMOVED").map(f => f.message).join("\n");
  assert.match(removed, /Rubrique utile retirée sans équivalent : Sécurité/);
  assert.match(removed, /Commande retirée : cp \.env\.example \.env/);
  assert.match(removed, /Commande retirée : pnpm dev/);
  assert.match(removed, /Variable retirée : DATABASE_URL/);
  // A faithful reorganisation that moves the security notice keeps every useful item.
  const faithful = previous.replace("## Sécurité\n\nSignalement confidentiel : voir [SECURITY.md](SECURITY.md).\n\n", "")
    .replace("## Licence", "## Signaler une vulnérabilité\n\nVoir [SECURITY.md](SECURITY.md).\n\n## Licence");
  await writeFile(join(root, "README.md"), faithful);
  const result = await checkReadme(root, { previous });
  assert.deepEqual(codes(result).filter(c => c === "INFO_REMOVED"), []);
  assert.ok(codes(result).includes("HEADING_CHANGED"));
  const viaFile = join(root, "..", "previous.md");
  await writeFile(viaFile, previous);
  const cliFile = spawnSync(process.execPath, [cli, "workflow", "readme-check", "--code-root", root, "--previous", viaFile], { encoding: "utf8" });
  assert.equal(JSON.parse(cliFile.stdout).findings.filter(f => f.code === "INFO_REMOVED").length, 0);
});
