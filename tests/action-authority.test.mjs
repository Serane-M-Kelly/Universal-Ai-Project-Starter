import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { declaration } from "../dist/lib/phase-workflow.js";

const load = (path) => readFile(resolve(path), "utf8");

test("authorité v3 : contrat unique, frontières explicites et déclarations honnêtes", async () => {
  const policy = await load("core/contracts/action-authority.md");
  for (const condition of [
    "Review", "Accept", "Prepare-commit", "Nouvelle phase",
    "ne constituent jamais une autorisation", "pas une", "--independent",
  ]) assert.ok(policy.includes(condition), `Clause absente : ${condition}`);
  assert.match(policy, /ne sait\s+pas vérifier la sémantique/);
});

test("authorité v3 : les skills de transition reprennent le contrat sans enchaînement implicite", async () => {
  const roles = ["project-start", "project-setup", "project-plan", "project-next", "project-phase", "project-review", "project-ship"];
  for (const role of roles) {
    const skill = await load(`core/skills/${role}/SKILL.md`);
    assert.match(skill, /action-authority\.md/, `Le rôle ${role} doit lire le contrat commun`);
  }
  const phase = await load("core/skills/project-phase/SKILL.md");
  assert.match(phase, /sans la lancer/);
  assert.match(phase, /ne\s+consigner `workflow review` que si/);
  const review = await load("core/skills/project-review/SKILL.md");
  assert.match(review, /revue seule n'est pas une acceptation/);
  const next = await load("core/skills/project-next/SKILL.md");
  assert.match(next, /sans l'invoquer/);
  const common = await load("core/contracts/phase-workflow.md");
  assert.match(common, /action-authority\.md/);
});

test("authorité v3 : la CLI atteste uniquement la présence des déclarations", async () => {
  assert.throws(() => declaration("", "Autorisation de test"), /personne/);
  assert.throws(() => declaration("Kelly", ""), /personne/);
  assert.doesNotThrow(() => declaration("Identité déclarée", "Demande déclarée"));
  const cli = await load("core/contracts/workflow-cli.md");
  assert.match(cli, /ne\s+prouvent ni l'identité humaine/);
  assert.match(cli, /--independent.*déclare une revue/);
});
