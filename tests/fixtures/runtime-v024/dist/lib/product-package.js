import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import YAML from "yaml";
import { hashDirectory } from "./content-hash.js";
import { canonicalPath, pathExists, writeFileAtomic, writeNewFile } from "./fs-safe.js";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { schemasRoot } from "./paths.js";
import { isPathInsideOrEqual, portableRelative, slugify } from "./text.js";
const registryRelativePath = "intake/product-package/registry.yaml";
const managedStateStart = "<!-- ai-project:product-package:start -->";
const managedStateEnd = "<!-- ai-project:product-package:end -->";
export async function inspectProductPackage(inputPath) {
    const requestedPath = resolve(inputPath);
    const requestedDetails = await lstat(requestedPath).catch(() => null);
    if (requestedDetails?.isSymbolicLink()) {
        throw new Error(`Le product-package ne peut pas être un lien symbolique : ${requestedPath}`);
    }
    if (!requestedDetails?.isDirectory()) {
        throw new Error(`Le dossier product-package est introuvable : ${requestedPath}`);
    }
    const root = await canonicalPath(requestedPath);
    await validateManagedTree(root);
    const manifestPath = join(root, "manifest.yaml");
    let candidate;
    try {
        candidate = YAML.parse(await readFile(manifestPath, "utf8"));
    }
    catch (error) {
        throw new Error(`manifest.yaml est illisible : ${messageOf(error)}`);
    }
    const schema = JSON.parse(await readFile(join(schemasRoot, "product-package.schema.json"), "utf8"));
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    const valid = ajv.validate(schema, candidate);
    if (!valid) {
        const details = (ajv.errors ?? [])
            .map((error) => `${error.instancePath || "/"} ${error.message ?? "est invalide"}`)
            .join(" ; ");
        throw new Error(`manifest.yaml ne respecte pas le contrat v1 : ${details}`);
    }
    const manifest = candidate;
    validateManifestSemantics(manifest);
    for (const file of Object.values(manifest.contents)) {
        const path = join(root, file);
        const details = await lstat(path).catch(() => null);
        if (!details?.isFile() || details.isSymbolicLink()) {
            throw new Error(`Le fichier canonique ${file} est absent ou invalide.`);
        }
    }
    for (const restrictedPath of manifest.confidentiality.restricted_paths) {
        const path = resolve(root, restrictedPath);
        if (!isPathInsideOrEqual(path, root) || !(await pathExists(path))) {
            throw new Error(`Le chemin confidentiel déclaré est absent ou sort du package : ${restrictedPath}`);
        }
    }
    const warnings = warningsForManifest(manifest);
    if (await canonicalFilesContainPlaceholders(root, manifest)) {
        warnings.push({
            code: "PRODUCT_PACKAGE_PLACEHOLDERS",
            message: "Des placeholders de modèle restent présents dans les documents canoniques.",
        });
    }
    return {
        root,
        manifest,
        sourceHash: await hashDirectory(root),
        warnings,
    };
}
export async function importProductPackage(workspacePath, packagePath) {
    const workspace = await canonicalPath(resolve(workspacePath));
    const inspected = await inspectProductPackage(packagePath);
    const { manifest } = inspected;
    if (manifest.package_status !== "ready_for_intake") {
        throw new Error(`Le package doit porter package_status: ready_for_intake avant son import ; statut actuel : ${manifest.package_status}.`);
    }
    if (manifest.review.independent_review === "changes_requested") {
        throw new Error("Le Reviewer demande encore des corrections ; l'import est refusé.");
    }
    const config = YAML.parse(await readFile(join(workspace, "project.yaml"), "utf8"));
    if (config.project.entry_mode !== "idea" && config.project.entry_mode !== "brief") {
        throw new Error(`L'import product-package est réservé aux workspaces idea ou brief ; mode actuel : ${config.project.entry_mode}.`);
    }
    if (slugify(manifest.project_name) !== config.project.slug) {
        throw new Error(`Le package concerne « ${manifest.project_name} » mais le workspace concerne « ${config.project.name} ».`);
    }
    const briefPath = join(workspace, "PROJECT_BRIEF.md");
    const brief = parseFrontmatter(await readFile(briefPath, "utf8"));
    if (brief.attributes.status === "approved") {
        throw new Error("Le brief est déjà approuvé. Repasser explicitement par une nouvelle version brouillon avant d'importer un cadrage susceptible de le modifier.");
    }
    const archiveRoot = join(workspace, "intake", "product-package");
    if (isPathInsideOrEqual(inspected.root, archiveRoot)) {
        throw new Error("Le package source se trouve déjà dans l'archive gérée du workspace.");
    }
    const archiveRelative = `intake/product-package/${manifest.package_id}/v${manifest.package_version}`;
    const archivePath = join(workspace, ...archiveRelative.split("/"));
    const registryPath = join(workspace, ...registryRelativePath.split("/"));
    const registryOriginal = await readOptionalFile(registryPath);
    const registry = parseRegistry(registryOriginal);
    const existingEntry = registry.imports.find((entry) => entry.package_id === manifest.package_id &&
        entry.package_version === manifest.package_version);
    if (existingEntry) {
        if (existingEntry.source_hash === inspected.sourceHash &&
            await pathExists(archivePath) &&
            await hashDirectory(archivePath) === inspected.sourceHash) {
            return {
                workspace,
                manifest,
                archivePath,
                reportPath: join(workspace, ...existingEntry.references.report.split("/")),
                alreadyImported: true,
                warnings: inspected.warnings,
            };
        }
        throw new Error(`Le package ${manifest.package_id} v${manifest.package_version} est déjà enregistré avec un contenu différent. Incrémenter package_version.`);
    }
    if (await pathExists(archivePath)) {
        throw new Error(`Une archive non enregistrée occupe déjà ${archiveRelative}.`);
    }
    const identity = `${manifest.package_id}-v${manifest.package_version}`;
    const researchRelative = `intake/research/product-package/${identity}.md`;
    const prototypeRelative = `prototype/product-package/${identity}.md`;
    const decisionsRelative = `docs/internal/product-package/${identity}.md`;
    const reportRelative = `reports/intake/${identity}.md`;
    const references = {
        research: researchRelative,
        prototype: prototypeRelative,
        decisions: decisionsRelative,
        report: reportRelative,
    };
    const createdFiles = Object.values(references).map((path) => join(workspace, ...path.split("/")));
    for (const path of createdFiles) {
        if (await pathExists(path)) {
            throw new Error(`Le CLI refuse d'écraser une projection d'import existante : ${path}`);
        }
    }
    const statePath = join(workspace, "PROJECT_STATE.md");
    const stateOriginal = await readFile(statePath, "utf8");
    const importedAt = new Date().toISOString();
    const temporaryArchive = join(dirname(archivePath), `.${basename(archivePath)}.${process.pid}.${randomUUID()}.tmp`);
    let archiveCreated = false;
    let registryWritten = false;
    let stateWritten = false;
    try {
        await mkdir(dirname(temporaryArchive), { recursive: true });
        await cp(inspected.root, temporaryArchive, {
            recursive: true,
            errorOnExist: true,
            force: false,
            dereference: false,
        });
        if (await hashDirectory(temporaryArchive) !== inspected.sourceHash) {
            throw new Error("La copie temporaire du package ne correspond pas à sa source.");
        }
        await rename(temporaryArchive, archivePath);
        archiveCreated = true;
        await writeNewFile(join(workspace, ...researchRelative.split("/")), projectionContent("Recherche importée", workspace, researchRelative, archiveRelative, manifest.contents.evidence_register, identity));
        await writeNewFile(join(workspace, ...prototypeRelative.split("/")), projectionContent("Prototype importé", workspace, prototypeRelative, archiveRelative, manifest.contents.prototype_brief, identity));
        await writeNewFile(join(workspace, ...decisionsRelative.split("/")), projectionContent("Décisions proposées dans le package", workspace, decisionsRelative, archiveRelative, manifest.contents.decision_log, identity));
        await writeNewFile(join(workspace, ...reportRelative.split("/")), importReport(manifest, archiveRelative, inspected.sourceHash, importedAt, inspected.warnings));
        registry.imports.push({
            package_id: manifest.package_id,
            package_version: manifest.package_version,
            package_status: "ready_for_intake",
            source_hash: inspected.sourceHash,
            imported_at: importedAt,
            archived_path: archiveRelative,
            producer: `${manifest.producer.name}:${manifest.producer.surface}`,
            project_stage: manifest.project_stage,
            review: manifest.review.independent_review,
            warning_codes: inspected.warnings.map((warning) => warning.code),
            references,
        });
        registry.imports.sort((left, right) => left.package_id.localeCompare(right.package_id) ||
            left.package_version - right.package_version);
        await writeFileAtomic(registryPath, YAML.stringify(registry));
        registryWritten = true;
        await writeFileAtomic(statePath, updateStateAfterImport(stateOriginal, manifest, archiveRelative, reportRelative, importedAt, Number(brief.attributes.brief_version)));
        stateWritten = true;
    }
    catch (error) {
        await rm(temporaryArchive, { recursive: true, force: true });
        if (archiveCreated)
            await rm(archivePath, { recursive: true, force: true });
        for (const path of createdFiles)
            await rm(path, { force: true });
        if (registryWritten) {
            if (registryOriginal === null)
                await rm(registryPath, { force: true });
            else
                await writeFileAtomic(registryPath, registryOriginal);
        }
        if (stateWritten)
            await writeFileAtomic(statePath, stateOriginal);
        throw error;
    }
    return {
        workspace,
        manifest,
        archivePath,
        reportPath: join(workspace, ...reportRelative.split("/")),
        alreadyImported: false,
        warnings: inspected.warnings,
    };
}
export async function diagnoseImportedProductPackages(workspace) {
    const items = [];
    const registryPath = join(workspace, ...registryRelativePath.split("/"));
    const archiveRoot = dirname(registryPath);
    const registryContent = await readOptionalFile(registryPath);
    if (registryContent === null) {
        if (await pathExists(archiveRoot)) {
            const entries = (await readdir(archiveRoot)).filter((name) => name !== "registry.yaml");
            if (entries.length > 0) {
                items.push({
                    severity: "blocked",
                    code: "PRODUCT_PACKAGE_REGISTRY_MISSING",
                    message: "Des archives product-package existent sans registre d'import.",
                    path: archiveRoot,
                });
            }
        }
        return items;
    }
    let registry;
    try {
        registry = parseRegistry(registryContent);
    }
    catch (error) {
        items.push({
            severity: "blocked",
            code: "PRODUCT_PACKAGE_REGISTRY_INVALID",
            message: messageOf(error),
            path: registryPath,
        });
        return items;
    }
    const seen = new Set();
    for (const entry of registry.imports) {
        const key = `${entry.package_id}@${entry.package_version}`;
        if (seen.has(key)) {
            items.push({
                severity: "blocked",
                code: "PRODUCT_PACKAGE_DUPLICATE",
                message: `Le registre déclare ${key} plusieurs fois.`,
                path: registryPath,
            });
            continue;
        }
        seen.add(key);
        const archivePath = resolve(workspace, entry.archived_path);
        if (!isPathInsideOrEqual(archivePath, archiveRoot)) {
            items.push({
                severity: "blocked",
                code: "PRODUCT_PACKAGE_PATH_ESCAPE",
                message: `Le chemin archivé de ${key} sort de l'espace product-package.`,
                path: archivePath,
            });
            continue;
        }
        try {
            const inspected = await inspectProductPackage(archivePath);
            if (inspected.manifest.package_id !== entry.package_id ||
                inspected.manifest.package_version !== entry.package_version ||
                inspected.manifest.package_status !== entry.package_status) {
                throw new Error(`L'identité ou le statut archivé de ${key} ne correspond pas au registre.`);
            }
            if (inspected.sourceHash !== entry.source_hash) {
                throw new Error(`L'archive ${key} a été modifiée après son import.`);
            }
            for (const reference of Object.values(entry.references)) {
                const path = resolve(workspace, reference);
                if (!isPathInsideOrEqual(path, workspace) || !(await pathExists(path))) {
                    throw new Error(`La référence d'import ${reference} est absente ou invalide.`);
                }
            }
            items.push({
                severity: "ok",
                code: "PRODUCT_PACKAGE_VALID",
                message: `${key} est archivé, versionné et intact.`,
                path: archivePath,
            });
            for (const warning of inspected.warnings) {
                items.push({
                    severity: "warning",
                    code: warning.code,
                    message: `${key} : ${warning.message}`,
                    path: archivePath,
                });
            }
        }
        catch (error) {
            items.push({
                severity: "blocked",
                code: "PRODUCT_PACKAGE_INVALID",
                message: `${key} : ${messageOf(error)}`,
                path: archivePath,
            });
        }
    }
    return items;
}
function validateManifestSemantics(manifest) {
    for (const [label, value] of [
        ["created_at", manifest.created_at],
        ["updated_at", manifest.updated_at],
        ["reviewed_at", manifest.review.reviewed_at],
    ]) {
        if (value !== null && !isIsoDateTime(value)) {
            throw new Error(`${label} doit être une date ISO 8601 valide ou null.`);
        }
    }
    if (manifest.package_status === "ready_for_intake" &&
        (manifest.created_at === null || manifest.updated_at === null)) {
        throw new Error("Un package ready_for_intake doit renseigner created_at et updated_at.");
    }
    if ((manifest.review.independent_review === "passed" ||
        manifest.review.independent_review === "passed_with_limits") &&
        manifest.review.reviewed_at === null) {
        throw new Error("Une revue terminée doit renseigner reviewed_at.");
    }
    if ((manifest.prototype.status === "available" || manifest.prototype.status === "tested") &&
        !manifest.prototype.canonical_reference) {
        throw new Error("Un prototype disponible ou testé doit avoir une référence canonique.");
    }
    if (manifest.project_stage === "prototype_tested" &&
        manifest.prototype.status !== "tested") {
        throw new Error("Le stade prototype_tested exige prototype.status: tested.");
    }
    if (/\[|\]/.test(manifest.project_name) || /\[|\]/.test(manifest.decision_owner)) {
        throw new Error("Le nom du projet et l'autorité de décision ne peuvent pas être des placeholders.");
    }
}
function warningsForManifest(manifest) {
    const warnings = [];
    if (manifest.review.independent_review === "not_started") {
        warnings.push({
            code: "PRODUCT_PACKAGE_REVIEW_MISSING",
            message: "La revue indépendante n'a pas été réalisée ; cette limite doit rester visible.",
        });
    }
    else if (manifest.review.independent_review === "passed_with_limits") {
        warnings.push({
            code: "PRODUCT_PACKAGE_REVIEW_LIMITS",
            message: "La revue indépendante a accepté le package avec des limites résiduelles.",
        });
    }
    if (manifest.evidence.synthetic_material_present) {
        warnings.push({
            code: "PRODUCT_PACKAGE_SYNTHETIC",
            message: "Le package contient du matériel synthétique qui ne vaut pas preuve utilisateur.",
        });
    }
    if (manifest.evidence.real_user_validation === "none" ||
        manifest.evidence.real_user_validation === "planned" ||
        manifest.evidence.real_user_validation === "in_progress") {
        warnings.push({
            code: "PRODUCT_PACKAGE_USER_EVIDENCE_LIMITED",
            message: "La validation avec de vraies personnes est absente ou encore incomplète.",
        });
    }
    if (manifest.confidentiality.contains_personal_data) {
        warnings.push({
            code: "PRODUCT_PACKAGE_PERSONAL_DATA",
            message: "Le package déclare des données personnelles ; vérifier minimisation et autorisations avant tout partage.",
        });
    }
    return warnings;
}
async function validateManagedTree(root) {
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            const details = await lstat(path);
            const portablePath = relative(root, path).replaceAll("\\", "/");
            if (details.isSymbolicLink()) {
                throw new Error(`Un lien symbolique est interdit dans le package : ${portablePath}`);
            }
            if (isSecretLike(portablePath)) {
                throw new Error(`Un secret potentiel est interdit dans le package : ${portablePath}`);
            }
            if (details.isDirectory())
                await visit(path);
            else if (!details.isFile()) {
                throw new Error(`Type de fichier non pris en charge dans le package : ${portablePath}`);
            }
        }
    }
    await visit(root);
}
function isSecretLike(path) {
    const normalized = path.replaceAll("\\", "/");
    const name = basename(normalized).toLowerCase();
    if ([".env.example", ".env.sample", ".env.template"].includes(name))
        return false;
    if (name === ".env" || name.startsWith(".env."))
        return true;
    if (normalized.toLowerCase().split("/").includes("secrets"))
        return true;
    return name === "credentials" || name.startsWith("credentials.");
}
async function canonicalFilesContainPlaceholders(root, manifest) {
    const pattern = /\[(?:à compléter|nom du projet|project-slug|nom)\]/i;
    for (const file of Object.values(manifest.contents)) {
        if (pattern.test(await readFile(join(root, file), "utf8")))
            return true;
    }
    return false;
}
function projectionContent(title, workspace, projectionRelative, archiveRelative, sourceFile, identity) {
    const projectionPath = join(workspace, ...projectionRelative.split("/"));
    const sourcePath = join(workspace, ...archiveRelative.split("/"), sourceFile);
    const reference = portableRelative(dirname(projectionPath), sourcePath);
    return `# ${title} — ${identity}\n\n` +
        `- **Source canonique :** [${sourceFile}](${reference})\n` +
        `- **Archive :** \`${archiveRelative}\`\n\n` +
        "Ce fichier est une référence générée. Ne pas y recopier ni modifier le contenu source.\n";
}
function importReport(manifest, archiveRelative, sourceHash, importedAt, warnings) {
    const warningText = warnings.length === 0
        ? "- Aucune limite mécanique supplémentaire détectée."
        : warnings.map((warning) => `- **${warning.code} :** ${warning.message}`).join("\n");
    return `# Rapport d'import — ${manifest.package_id} v${manifest.package_version}\n\n` +
        `- **Importé le :** ${importedAt}\n` +
        `- **Archive canonique :** \`${archiveRelative}\`\n` +
        `- **Empreinte SHA-256 :** \`${sourceHash}\`\n` +
        `- **Stade déclaré :** ${manifest.project_stage}\n` +
        `- **Reviewer :** ${manifest.review.independent_review}\n\n` +
        "## Limites visibles\n\n" +
        `${warningText}\n\n` +
        "## Prochaine action\n\n" +
        "Utiliser `project-discover` pour auditer le package, combler seulement les lacunes décisionnelles et préparer `PROJECT_BRIEF.md` en statut `draft`. L'import n'approuve pas le brief et n'autorise pas la réalisation.\n";
}
function updateStateAfterImport(stateContent, manifest, archiveRelative, reportRelative, importedAt, briefVersion) {
    const state = parseFrontmatter(stateContent);
    const currentVersion = Number(state.attributes.state_version);
    state.attributes.state_version = Number.isInteger(currentVersion) && currentVersion > 0
        ? currentVersion + 1
        : 1;
    state.attributes.stage = manifest.project_stage === "initial_idea" ||
        manifest.project_stage === "discovery"
        ? "discovery"
        : "definition";
    state.attributes.status = "active";
    state.attributes.current_phase = "product-package-intake";
    state.attributes.current_task = null;
    state.attributes.brief_version = Number.isInteger(briefVersion) && briefVersion > 0
        ? briefVersion
        : null;
    state.attributes.updated_at = importedAt;
    const block = `${managedStateStart}\n## Dernier product-package importé\n\n` +
        `- **Package :** ${manifest.package_id} v${manifest.package_version}\n` +
        `- **Stade déclaré :** ${manifest.project_stage}\n` +
        `- **Archive :** \`${archiveRelative}\`\n` +
        `- **Rapport :** \`${reportRelative}\`\n` +
        "- **Prochaine action :** auditer le package avec `project-discover`, puis préparer le brief brouillon.\n" +
        "- **Autorité :** l'import ne vaut ni approbation du brief, ni autorisation de construire.\n" +
        `${managedStateEnd}`;
    const body = upsertManagedSection(state.body, block);
    return stringifyFrontmatter(state.attributes, body);
}
function upsertManagedSection(body, block) {
    const start = body.indexOf(managedStateStart);
    const end = body.indexOf(managedStateEnd);
    if (start >= 0 && end >= start) {
        return `${body.slice(0, start)}${block}${body.slice(end + managedStateEnd.length)}`;
    }
    return `${body.trimEnd()}\n\n${block}\n`;
}
function parseRegistry(content) {
    if (content === null)
        return { schema_version: 1, imports: [] };
    let candidate;
    try {
        candidate = YAML.parse(content);
    }
    catch (error) {
        throw new Error(`Le registre product-package est illisible : ${messageOf(error)}`);
    }
    if (!isRecord(candidate) || candidate.schema_version !== 1 || !Array.isArray(candidate.imports)) {
        throw new Error("Le registre product-package ne respecte pas son format v1.");
    }
    for (const entry of candidate.imports) {
        if (!isRegistryEntry(entry)) {
            throw new Error("Une entrée du registre product-package est invalide.");
        }
    }
    return candidate;
}
function isRegistryEntry(value) {
    if (!isRecord(value) || !isRecord(value.references))
        return false;
    const references = value.references;
    return typeof value.package_id === "string" &&
        Number.isInteger(value.package_version) &&
        value.package_status === "ready_for_intake" &&
        typeof value.source_hash === "string" && /^[a-f0-9]{64}$/.test(value.source_hash) &&
        typeof value.imported_at === "string" &&
        typeof value.archived_path === "string" && !isAbsolute(value.archived_path) &&
        typeof value.producer === "string" &&
        typeof value.project_stage === "string" &&
        typeof value.review === "string" &&
        Array.isArray(value.warning_codes) && value.warning_codes.every((code) => typeof code === "string") &&
        ["research", "prototype", "decisions", "report"].every((key) => typeof references[key] === "string" &&
            !isAbsolute(references[key]));
}
async function readOptionalFile(path) {
    if (!(await pathExists(path)))
        return null;
    return readFile(path, "utf8");
}
function isIsoDateTime(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        return false;
    }
    return !Number.isNaN(Date.parse(value));
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=product-package.js.map