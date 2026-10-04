import { cp, lstat, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { loadAdapter } from "./adapters.js";
import { hashDirectory, hashText } from "./content-hash.js";
import { canonicalPath, pathExists, writeFileAtomic, writeNewFile, } from "./fs-safe.js";
import { agentsRoot, schemasRoot } from "./paths.js";
import { isPathInsideOrEqual } from "./text.js";
const agentIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function loadAgentCatalog() {
    let catalog;
    try {
        catalog = YAML.parse(await readFile(join(agentsRoot, "catalog.yaml"), "utf8"));
    }
    catch (error) {
        throw new Error(`Le catalogue des agents est illisible : ${messageOf(error)}`);
    }
    await validateWithSchema(catalog, "agent-catalog.schema.json", "Le catalogue des agents");
    const typedCatalog = catalog;
    const ids = new Set();
    for (const agent of typedCatalog.agents) {
        if (ids.has(agent.id)) {
            throw new Error(`L'agent ${agent.id} est déclaré plusieurs fois dans le catalogue.`);
        }
        ids.add(agent.id);
    }
    return typedCatalog;
}
export async function loadBuiltinAgent(agentId) {
    assertAgentId(agentId);
    const catalog = await loadAgentCatalog();
    const entry = catalog.agents.find((candidate) => candidate.id === agentId);
    if (!entry) {
        throw new Error(`Agent du starter introuvable : ${agentId}`);
    }
    const root = await canonicalPath(agentsRoot);
    const sourcePath = await canonicalPath(join(agentsRoot, entry.source));
    if (!isPathInsideOrEqual(sourcePath, root)) {
        throw new Error(`La source de l'agent ${agentId} sort du catalogue.`);
    }
    return loadAgentSource(sourcePath, agentId);
}
export async function loadAgentSource(sourcePath, agentId) {
    assertAgentId(agentId);
    const details = await lstat(sourcePath).catch(() => null);
    if (details?.isSymbolicLink()) {
        throw new Error(`Le dossier de l'agent ${agentId} ne peut pas être un lien symbolique.`);
    }
    if (!details?.isDirectory()) {
        throw new Error(`Le dossier de l'agent ${agentId} est introuvable.`);
    }
    let manifest;
    try {
        manifest = YAML.parse(await readFile(join(sourcePath, "agent.yaml"), "utf8"));
    }
    catch (error) {
        throw new Error(`agent.yaml de ${agentId} est illisible : ${messageOf(error)}`);
    }
    await validateWithSchema(manifest, "agent.schema.json", `L'agent ${agentId}`);
    const typedManifest = manifest;
    if (typedManifest.agent.id !== agentId) {
        throw new Error(`La source ${agentId} déclare l'identifiant ${typedManifest.agent.id}.`);
    }
    const instructions = await readFile(join(sourcePath, "instructions.md"), "utf8")
        .catch((error) => {
        throw new Error(`instructions.md de ${agentId} est illisible : ${messageOf(error)}`);
    });
    if (instructions.trim().length < 40) {
        throw new Error(`instructions.md de ${agentId} doit décrire une mission exploitable.`);
    }
    return { manifest: typedManifest, instructions, sourcePath };
}
export async function installAgent(workspacePath, agentId) {
    const workspace = await canonicalPath(workspacePath);
    const configPath = join(workspace, "project.yaml");
    const config = YAML.parse(await readFile(configPath, "utf8"));
    const source = await loadBuiltinAgent(agentId);
    assertAgentCompatibility(source.manifest, config);
    const existing = (config.agents ?? []).find((agent) => agent.id === agentId);
    if (existing) {
        if (existing.origin !== "starter" || existing.version !== source.manifest.agent.version) {
            throw new Error(`L'identifiant ${agentId} appartient déjà à une autre source ou version.`);
        }
        const synchronized = await synchronizeAgents(workspace, false);
        return {
            manifest: source.manifest,
            workspace,
            alreadyInstalled: true,
            replicasUpdated: synchronized.replicasUpdated,
        };
    }
    const projectSource = join(workspace, "agents", agentId);
    await assertInsideWorkspace(workspace, projectSource, agentId);
    if (await pathExists(projectSource)) {
        throw new Error(`Le CLI refuse d'écraser la source existante : ${projectSource}`);
    }
    const nativeAgents = source.manifest.enabled
        ? await nativeAgentsFor(workspace, config, source.manifest, source.instructions)
        : [];
    for (const native of nativeAgents) {
        if (await pathExists(native.destination)) {
            throw new Error(`Le CLI refuse d'écraser l'agent natif existant : ${native.destination}`);
        }
    }
    const created = [];
    try {
        await mkdir(dirname(projectSource), { recursive: true });
        await cp(source.sourcePath, projectSource, {
            recursive: true,
            errorOnExist: true,
            force: false,
        });
        created.push(projectSource);
        const sourceHash = await hashDirectory(projectSource);
        const replicas = {};
        for (const native of nativeAgents) {
            await writeNewFile(native.destination, native.content);
            created.push(native.destination);
            replicas[native.adapterId] = hashText(native.content);
        }
        config.agents = [
            ...(config.agents ?? []),
            {
                id: agentId,
                version: source.manifest.agent.version,
                origin: "starter",
                source_hash: sourceHash,
                replicas,
            },
        ];
        await writeFileAtomic(configPath, YAML.stringify(config));
    }
    catch (error) {
        for (const path of created.reverse()) {
            await rm(path, { recursive: true, force: true });
        }
        throw error;
    }
    return {
        manifest: source.manifest,
        workspace,
        alreadyInstalled: false,
        replicasUpdated: nativeAgents.length,
    };
}
export async function createUserAgent(workspacePath, agentId) {
    assertAgentId(agentId);
    const workspace = await canonicalPath(workspacePath);
    const configPath = join(workspace, "project.yaml");
    const config = YAML.parse(await readFile(configPath, "utf8"));
    if ((config.agents ?? []).some((agent) => agent.id === agentId)) {
        throw new Error(`L'agent ${agentId} est déjà déclaré dans project.yaml.`);
    }
    const sourcePath = join(workspace, "agents", agentId);
    await assertInsideWorkspace(workspace, sourcePath, agentId);
    if (await pathExists(sourcePath)) {
        throw new Error(`Le CLI refuse d'écraser la source existante : ${sourcePath}`);
    }
    const manifest = userAgentTemplate(agentId);
    const instructions = `# Mission\n\nDécrire ici la responsabilité unique de ${agentId}, ses entrées, ses limites, son livrable et son critère de fin.\n`;
    try {
        await writeNewFile(join(sourcePath, "agent.yaml"), YAML.stringify(manifest));
        await writeNewFile(join(sourcePath, "instructions.md"), instructions);
        const sourceHash = await hashDirectory(sourcePath);
        config.agents = [
            ...(config.agents ?? []),
            {
                id: agentId,
                version: 1,
                origin: "user",
                source_hash: sourceHash,
                replicas: {},
            },
        ];
        await writeFileAtomic(configPath, YAML.stringify(config));
    }
    catch (error) {
        await rm(sourcePath, { recursive: true, force: true });
        throw error;
    }
    return { manifest, workspace };
}
export async function synchronizeAgents(workspacePath, force) {
    const workspace = await canonicalPath(workspacePath);
    const configPath = join(workspace, "project.yaml");
    const config = YAML.parse(await readFile(configPath, "utf8"));
    const references = config.agents ?? [];
    const operations = [];
    const nextState = new Map();
    for (const reference of references) {
        const sourcePath = join(workspace, "agents", reference.id);
        await assertInsideWorkspace(workspace, sourcePath, reference.id);
        const source = await loadAgentSource(sourcePath, reference.id);
        if (reference.version !== source.manifest.agent.version) {
            throw new Error(`Le projet utilise ${reference.id} v${reference.version}, mais sa source déclare la v${source.manifest.agent.version}.`);
        }
        if (reference.origin === "starter") {
            const builtin = await loadBuiltinAgent(reference.id);
            if (builtin.manifest.agent.version !== reference.version) {
                throw new Error(`Le starter fournit ${reference.id} v${builtin.manifest.agent.version}, incompatible avec la v${reference.version}.`);
            }
        }
        assertAgentCompatibility(source.manifest, config);
        const sourceHash = await hashDirectory(sourcePath);
        const replicas = {};
        for (const adapterReference of config.adapters ?? []) {
            const adapter = await loadAdapter(adapterReference.id);
            if (adapterReference.version !== adapter.adapter.version) {
                throw new Error(`Le projet utilise ${adapterReference.id} v${adapterReference.version}, mais le starter fournit la v${adapter.adapter.version}.`);
            }
            const destination = await nativeDestination(workspace, adapter, reference.id);
            const destinationExists = await pathExists(destination);
            const previousReplicaHash = reference.replicas[adapterReference.id];
            if (!source.manifest.enabled) {
                if (destinationExists) {
                    const actualHash = hashText(await readFile(destination, "utf8"));
                    if (!force && actualHash !== previousReplicaHash) {
                        throw new Error(`L'agent natif ${destination} a été modifié séparément. Reporter ses changements dans ${sourcePath}, puis utiliser --force si sa suppression est voulue.`);
                    }
                    operations.push({
                        adapterId: adapterReference.id,
                        destination,
                        content: "",
                        action: "remove",
                    });
                }
                continue;
            }
            const content = renderNativeAgent(adapter, source.manifest, source.instructions);
            const expectedHash = hashText(content);
            replicas[adapterReference.id] = expectedHash;
            if (!destinationExists) {
                operations.push({
                    adapterId: adapterReference.id,
                    destination,
                    content,
                    action: "write",
                });
                continue;
            }
            const actualHash = hashText(await readFile(destination, "utf8"));
            if (actualHash === expectedHash)
                continue;
            if (!force && actualHash !== previousReplicaHash) {
                throw new Error(`L'agent natif ${destination} a été modifié séparément. Reporter ses changements dans ${sourcePath}, puis relancer avec --force si son remplacement est voulu.`);
            }
            operations.push({
                adapterId: adapterReference.id,
                destination,
                content,
                action: "write",
            });
        }
        nextState.set(reference.id, { sourceHash, replicas });
    }
    for (const operation of operations) {
        if (operation.action === "remove") {
            await rm(operation.destination, { force: true });
        }
        else {
            await writeFileAtomic(operation.destination, operation.content);
        }
    }
    let configChanged = false;
    for (const reference of references) {
        const state = nextState.get(reference.id);
        if (!state)
            continue;
        if (reference.source_hash !== state.sourceHash ||
            YAML.stringify(reference.replicas) !== YAML.stringify(state.replicas)) {
            reference.source_hash = state.sourceHash;
            reference.replicas = state.replicas;
            configChanged = true;
        }
    }
    if (configChanged) {
        config.agents = references;
        await writeFileAtomic(configPath, YAML.stringify(config));
    }
    return {
        workspace,
        agentsSynchronized: references.length,
        replicasUpdated: operations.length,
    };
}
export function renderNativeAgent(adapter, manifest, instructions) {
    const envelope = authorityEnvelope(manifest);
    const completeInstructions = `${envelope}\n\n${instructions.trim()}\n`;
    if (adapter.agents.format === "codex-toml") {
        const lines = [
            "# Généré par Universal AI Project Starter.",
            `# Modifier agents/${manifest.agent.id}/ puis lancer : ai-project agent sync`,
            `name = ${JSON.stringify(manifest.agent.id)}`,
            `description = ${JSON.stringify(manifest.agent.description)}`,
            `sandbox_mode = ${JSON.stringify(manifest.execution.filesystem)}`,
            `developer_instructions = ${JSON.stringify(completeInstructions)}`,
        ];
        if (manifest.execution.filesystem === "workspace-write") {
            lines.push("", "[sandbox_workspace_write]", `network_access = ${manifest.execution.network ? "true" : "false"}`);
        }
        return `${lines.join("\n")}\n`;
    }
    const tools = ["Read", "Glob", "Grep"];
    if (manifest.execution.filesystem === "workspace-write") {
        tools.push("Write", "Edit");
    }
    if (manifest.execution.shell)
        tools.push("Bash");
    if (manifest.execution.network)
        tools.push("WebFetch", "WebSearch");
    if (manifest.execution.delegation)
        tools.push("Agent");
    const frontmatter = {
        name: manifest.agent.id,
        description: manifest.agent.description,
        tools,
        model: "inherit",
        permissionMode: manifest.execution.filesystem === "read-only" ? "plan" : "default",
    };
    return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n<!-- Généré. Modifier agents/${manifest.agent.id}/ puis lancer ai-project agent sync. -->\n\n${completeInstructions}`;
}
function authorityEnvelope(manifest) {
    const authority = manifest.authority;
    const policy = (label, value) => value === "forbidden"
        ? `- ${label} : interdit ; arrêter et retourner au parent.`
        : `- ${label} : demander l'autorité au parent et ne pas exécuter directement.`;
    return [
        "# Contrat universel non négociable",
        `- Accès fichiers : ${manifest.execution.filesystem}.`,
        `- Shell : ${manifest.execution.shell ? "autorisé dans le périmètre" : "interdit"}.`,
        `- Réseau : ${manifest.execution.network ? "borné par le parent" : "interdit"}.`,
        `- Délégation : ${manifest.execution.delegation ? "bornée par le parent" : "interdite"}.`,
        "- Approbation du brief : interdite.",
        "- Acceptation d'une unité : interdite.",
        "- Autorisation d'une livraison : interdite.",
        policy("Actions externes", authority.external_actions),
        policy("Actions destructives", authority.destructive_actions),
        policy("Commits et tags", authority.commits),
        policy("Déploiement et publication", authority.deployment),
        "- Les politiques du projet et les permissions du parent restent prioritaires.",
    ].join("\n");
}
async function nativeAgentsFor(workspace, config, manifest, instructions) {
    const natives = [];
    for (const reference of config.adapters ?? []) {
        const adapter = await loadAdapter(reference.id);
        if (reference.version !== adapter.adapter.version) {
            throw new Error(`Le projet utilise ${reference.id} v${reference.version}, mais le starter fournit la v${adapter.adapter.version}.`);
        }
        natives.push({
            adapterId: reference.id,
            destination: await nativeDestination(workspace, adapter, manifest.agent.id),
            content: renderNativeAgent(adapter, manifest, instructions),
        });
    }
    return natives;
}
async function nativeDestination(workspace, adapter, agentId) {
    const extension = adapter.agents.format === "codex-toml" ? ".toml" : ".md";
    const destination = join(workspace, adapter.agents.destination, `${agentId}${extension}`);
    await assertInsideWorkspace(workspace, destination, agentId);
    return destination;
}
function assertAgentCompatibility(manifest, config) {
    if (!manifest.compatibility.entry_modes.includes(config.project.entry_mode)) {
        throw new Error(`L'agent ${manifest.agent.id} ne prend pas en charge le mode ${config.project.entry_mode}.`);
    }
    if (!manifest.compatibility.profiles.includes("*") &&
        !manifest.compatibility.profiles.includes(config.profile.id)) {
        throw new Error(`L'agent ${manifest.agent.id} ne prend pas en charge le profil ${config.profile.id}.`);
    }
}
async function assertInsideWorkspace(workspace, destination, agentId) {
    const canonical = await canonicalPath(destination);
    if (!isPathInsideOrEqual(canonical, workspace)) {
        throw new Error(`L'agent ${agentId} refuse un chemin qui sort du workspace : ${destination}`);
    }
}
async function validateWithSchema(value, schemaName, label) {
    const schema = JSON.parse(await readFile(join(schemasRoot, schemaName), "utf8"));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const valid = ajv.validate(schema, value);
    if (!valid) {
        const details = (ajv.errors ?? [])
            .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
            .join(" ; ");
        throw new Error(`${label} ne respecte pas son schéma : ${details}`);
    }
}
function userAgentTemplate(agentId) {
    return {
        schema_version: 1,
        agent: {
            id: agentId,
            version: 1,
            label: `Agent personnalisé ${agentId}`,
            description: "Agent personnalisé désactivé. Décrire précisément sa mission et le moment où il doit être utilisé avant de l'activer.",
        },
        enabled: false,
        compatibility: {
            entry_modes: ["idea", "brief", "existing", "maintenance"],
            profiles: ["*"],
        },
        execution: {
            filesystem: "read-only",
            shell: false,
            network: false,
            delegation: false,
        },
        authority: {
            brief_approval: false,
            work_acceptance: false,
            ship_approval: false,
            external_actions: "forbidden",
            destructive_actions: "forbidden",
            commits: "forbidden",
            deployment: "forbidden",
        },
    };
}
function assertAgentId(agentId) {
    if (!agentIdPattern.test(agentId)) {
        throw new Error(`Identifiant d'agent invalide : ${agentId}`);
    }
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=agents.js.map