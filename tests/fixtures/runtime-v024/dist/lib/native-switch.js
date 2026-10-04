/** Adds (or repairs) an assistant surface on an existing phase workspace without overwriting edits. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { STATE, ensure } from "./phase-workflow.js";
import { pathExists, writeFileAtomic } from "./fs-safe.js";
import { hashDirectory } from "./content-hash.js";
import { synchronizeSkills, validateSkillDirectory } from "./skills.js";
import { planNativeFiles, synchronizeModels } from "./workflow-models.js";
import { legacyAdapterRenderings } from "./adapters.js";
import { inspectWorkspace } from "./doctor.js";
import { CLAUDE_ROLE_DEFAULTS, NATIVE_ADAPTERS, guidanceFor, isNativeAdapter, nativeAdapters, readModels, } from "./native-adapters.js";
export async function addNativeAdapter(w, id, dryRun) {
    ensure(isNativeAdapter(id), `Adaptateur inconnu : ${id}. Valeurs : codex, claude-code.`);
    ensure(await pathExists(join(w, STATE)), "Workspace sans suivi par phases : utiliser ai-project adapter add pour un workspace historique.");
    ensure(!(await pathExists(join(w, ".starter/write.lock"))), "Écriture en cours ou verrou résiduel : fermer l'assistant et examiner le verrou avant d'ajouter un adaptateur.");
    const models = await readModels(w);
    const current = nativeAdapters(models);
    const already = current.includes(id);
    const candidate = structuredClone(models);
    candidate.adapters = already ? current : [...current, id];
    // Recommended Claude values only fill absent keys, the first time Claude is added.
    const filled = [];
    if (id === "claude-code" && !already)
        for (const [role, defaults] of Object.entries(CLAUDE_ROLE_DEFAULTS)) {
            const r = candidate.roles?.[role];
            if (!r || "claude_model" in r || "claude_effort" in r)
                continue;
            r.claude_model = defaults.claude_model;
            if (defaults.claude_effort)
                r.claude_effort = defaults.claude_effort;
            filled.push(role);
        }
    // Preflight: nothing is written while a conflict remains.
    const plan = await planNativeFiles(w, candidate);
    const conflicts = plan.conflicts.map((ref) => `${ref} (personnalisé, non géré par models.json)`);
    const config = YAML.parse(await readFile(join(w, "project.yaml"), "utf8"));
    const toCopy = [];
    const toRefresh = [];
    for (const reference of config.skills ?? []) {
        const source = join(w, "skills", reference.id);
        await validateSkillDirectory(source, reference.id);
        const sourceHash = await hashDirectory(source);
        for (const adapter of plan.adapters) {
            const copy = join(w, NATIVE_ADAPTERS[adapter].skills, reference.id);
            const relative = `${NATIVE_ADAPTERS[adapter].skills}/${reference.id}`;
            if (!(await pathExists(copy))) {
                toCopy.push(relative);
                continue;
            }
            const copyHash = await hashDirectory(copy);
            if (copyHash === sourceHash)
                continue;
            if (copyHash === reference.source_hash)
                toRefresh.push(relative);
            else
                conflicts.push(`${relative} (copie modifiée séparément ; reporter dans skills/${reference.id})`);
        }
    }
    ensure(conflicts.length === 0, `Ajout refusé, aucun fichier modifié. Conflits : ${conflicts.join(" ; ")}.`);
    const instructionsPath = NATIVE_ADAPTERS[id].instructions;
    let instructions = { path: instructionsPath, action: "create" };
    if (await pathExists(join(w, instructionsPath))) {
        const text = await readFile(join(w, instructionsPath), "utf8");
        if ((await legacyAdapterRenderings(w, instructionsPath)).includes(text))
            instructions = { path: instructionsPath, action: "replace-unmodified-legacy" };
        else
            instructions = {
                path: instructionsPath,
                action: "keep",
                ...(!text.includes(".starter/WORKFLOW.md")
                    ? {
                        warning: `${instructionsPath} est conservé mais ne renvoie pas à .starter/WORKFLOW.md : y reporter le pilotage par phases (modèle dans le README de l'adaptateur).`,
                    }
                    : {}),
            };
    }
    const result = {
        adapter: id,
        adapters: plan.adapters,
        dry_run: dryRun,
        already_installed: already,
        claude_defaults_added: filled,
        native_files: Object.keys(plan.files),
        replaced_unmodified_legacy_outputs: plan.adoptions,
        skills_to_copy: toCopy,
        skills_to_refresh: toRefresh,
        instructions,
        next: `Fermer l'assistant en cours, puis ouvrir ce workspace avec « ${NATIVE_ADAPTERS[id].command} » et appeler project-start.`,
    };
    if (dryRun)
        return result;
    const modelsPath = join(w, ".starter/models.json");
    const previousModels = await readFile(modelsPath, "utf8");
    const stamp = Date.now();
    const nextModels = JSON.stringify(candidate, null, 2);
    // A repair of an installed assistant leaves models.json and its history untouched.
    if (JSON.stringify(JSON.parse(previousModels), null, 2) !== nextModels) {
        await writeFileAtomic(join(w, ".starter/history", `models-${stamp}.json`), previousModels);
        await writeFileAtomic(modelsPath, nextModels);
    }
    try {
        await synchronizeModels(w);
        await synchronizeSkills(w, false);
    }
    catch (error) {
        // Native files already written stay recorded in the ledger; models.json returns to its state.
        await writeFileAtomic(modelsPath, previousModels);
        throw error;
    }
    if (instructions.action !== "keep") {
        if (instructions.action === "replace-unmodified-legacy")
            await writeFileAtomic(join(w, ".starter/history", `native-${stamp}-${instructionsPath}`), await readFile(join(w, instructionsPath), "utf8"));
        await writeFileAtomic(join(w, instructionsPath), guidanceFor(id));
    }
    const report = await inspectWorkspace(w);
    result.verdict = report.verdict;
    const blocked = report.items.filter((item) => item.severity === "blocked").map((item) => item.message);
    if (blocked.length)
        result.blocked = blocked;
    return result;
}
//# sourceMappingURL=native-switch.js.map