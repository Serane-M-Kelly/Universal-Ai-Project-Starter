/** Deterministic reading views only. Never executes commands or records evidence. */
import { readFile, lstat } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { canonicalPath } from "./fs-safe.js";
import { STATE, hash, ensure, loadWorkflow, sourceHash, contract, status } from "./phase-workflow.js";
import { fingerprintSource, inspectPhaseSources } from "./phase-sources.js";
import { NATIVE_ADAPTERS, installedNativeAdapters } from "./native-adapters.js";
export const serialize = (value) => JSON.stringify(value, null, 2);
export const bytes = (value) => Buffer.byteLength(serialize(value), "utf8");
export function measure(original, delivered) {
    const before = bytes(original), after = bytes(delivered);
    return { original_bytes: before, delivered_bytes: after, saved_bytes: before - after,
        reduction_percent: before ? Math.round((1 - after / before) * 10000) / 100 : 0,
        unit: "UTF-8 bytes of JSON payload; excludes metrics envelope and CLI newline",
        model_tokens: null, billed_savings: null };
}
async function localFile(w, ref) {
    ensure(ref && !isAbsolute(ref) && !ref.split(/[\\/]/).some(x => x === ".." || x === ""), "Référence interne requise.");
    let path = await canonicalPath(w);
    // Canonicalize the root (macOS /var alias), then refuse links inside it.
    for (const part of ref.split(/[\\/]/)) {
        path = join(path, part);
        ensure(!(await lstat(path)).isSymbolicLink(), "Lien symbolique dans une référence de contexte.");
    }
    ensure((await lstat(path)).isFile(), "Référence de contexte non fichier.");
    return path;
}
async function readProof(w, proof) {
    const text = await readFile(await localFile(w, proof.ref), "utf8");
    ensure(hash(text) === proof.report_hash, `Rapport modifié : ${proof.id}. Relire les faits et produire une nouvelle preuve.`);
    return text;
}
/** Only runs of recognized successful spec test lines are collapsed. Unknown output is retained. */
export function compactLog(text) {
    const lines = text.split("\n"), out = [];
    let run = [], collapsed = 0;
    function flush() {
        if (run.length >= 3) {
            out.push(`[${run.length} lignes de tests réussis regroupées ; noms dans le rapport original]`);
            collapsed += run.length;
        }
        else
            out.push(...run);
        run = [];
    }
    for (const line of lines) {
        // No ANSI rewriting: unknown formats must remain readable verbatim.
        if (/^\s*[✔✓]\s+.+\s+\(\d+(?:\.\d+)?\s*ms\)\s*$/.test(line) &&
            !/warn|error|fail|skip|todo|avert|erreur|échec|danger|security|sécurité/i.test(line))
            run.push(line);
        else {
            flush();
            out.push(line);
        }
    }
    flush();
    return { text: out.join("\n"), collapsed_success_lines: collapsed };
}
export async function reportView(w, id, options = {}) {
    const stateBefore = await readFile(join(w, STATE));
    const state = await loadWorkflow(w);
    const proof = state.proofs.find(p => p.id === id);
    ensure(proof, "Preuve inconnue : utiliser l’identifiant retourné par workflow check ou context.");
    const original = await readProof(w, proof);
    const phase = state.phases.find(p => p.id === proof.phase);
    const code = await sourceHash(w);
    const metadata = { proof, report_integrity: "verified", matches_current_code: proof.code === code,
        matches_current_contract: Boolean(phase && proof.contract === contract(phase)),
        ...(phase?.sources?.length ? { matches_current_sources: (await inspectPhaseSources(w, phase.sources)).every(source => source.current) } : {}),
        authority: "historical evidence; consult workflow context for current task state" };
    const parsed = JSON.parse(original);
    const full = { ...metadata, format: "original", content: original };
    let delivered = full;
    if (options.stream) {
        ensure(["stdout", "stderr", "original"].includes(options.stream), "Flux attendu : stdout, stderr ou original.");
        const object = parsed;
        const text = options.stream === "original" ? original : object?.[options.stream];
        ensure(typeof text === "string", "Flux absent dans ce rapport.");
        const offset = options.offset ?? 0, limit = options.limit ?? 12000;
        ensure(Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length && Number.isSafeInteger(limit) && limit > 0 && limit <= 1000000, "offset entier dans le flux et limit entre 1 et 1000000 requis.");
        const end = Math.min(text.length, offset + limit);
        delivered = { ...metadata, format: "slice", stream: options.stream, offset, next_offset: end < text.length ? end : null,
            total_length: text.length, offset_unit: "UTF-16 code units", content: text.slice(offset, end),
            omitted_code_units: text.length - (end - offset) };
    }
    else if (!options.raw && proof.kind === "check" && proof.passed && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const body = parsed;
        if (typeof body.stdout === "string" && typeof body.stderr === "string" && body.exit_code === 0 && body.error === null && body.source_unchanged === true) {
            const compact = compactLog(body.stdout);
            if (compact.collapsed_success_lines) {
                const candidate = { ...metadata, format: "compact", content: { ...body, stdout: compact.text },
                    collapsed_success_lines: compact.collapsed_success_lines,
                    full_read: `workflow report ${id} --raw` };
                if (bytes(candidate) < bytes(full))
                    delivered = candidate;
            }
        }
    }
    ensure(hash(stateBefore) === hash(await readFile(join(w, STATE))), "Suivi modifié pendant la lecture : relancer.");
    return { output: delivered, metrics: measure(full, delivered) };
}
export async function contextView(w, id) {
    const before = await readFile(join(w, STATE));
    const original = await status(w, id);
    let candidate = original;
    if (id) {
        const value = original;
        const relevant = [], historical = [];
        for (const proof of value.proofs) {
            const current = proof.code === value.code_hash && proof.contract === value.contract_hash;
            if (current) {
                let integrity = "verified";
                try {
                    await readProof(w, proof);
                }
                catch {
                    integrity = "unreadable_or_modified";
                }
                const { code: _code, contract: _contract, ...details } = proof;
                relevant.push({ ...details, report_integrity: integrity });
            }
            else
                historical.push(proof);
        }
        // Always retain the latest review, even stale: its existence can revoke an earlier review.
        const latestReview = value.proofs.filter(p => p.kind === "review").at(-1);
        candidate = { ...value, proofs: relevant, proof_hashes: "All listed proofs match code_hash and contract_hash; passed and integrity remain separate",
            historical_proofs_omitted: historical.length,
            latest_review_if_historical: latestReview && historical.includes(latestReview) ? latestReview : null,
            full_read: `workflow context ${value.phase.id}` };
    }
    else {
        const value = original;
        candidate = { ...value, phases: value.phases.map(({ done, ...phase }) => ({ ...phase, completed_task_count: done.length })),
            detail_read: "workflow context NUMBER --compact" };
    }
    // Small contexts do not need a bigger summary. Contract, baseline and human tasks are never shortened.
    const output = bytes(candidate) < bytes(original) ? candidate : original;
    ensure(hash(before) === hash(await readFile(join(w, STATE))), "Suivi modifié pendant la lecture : relancer.");
    return { output, metrics: measure(original, output) };
}
/** Fingerprints allow agents to reuse already-read rules only when still in their context. */
export async function contextSources(w, paths = []) {
    const state = await loadWorkflow(w);
    // Instruction files are required only for the assistants installed in this workspace.
    let required = null;
    try {
        required = new Set(["PROJECT_BRIEF.md", ".starter/WORKFLOW.md",
            ...(await installedNativeAdapters(w)).map(id => NATIVE_ADAPTERS[id].instructions)]);
    }
    catch { /* Without models.json the historical output is kept. */ }
    const sources = [];
    for (const path of ["PROJECT_BRIEF.md", ".starter/WORKFLOW.md", "AGENTS.md", "CLAUDE.md"]) {
        const flag = required ? { required: required.has(path) } : {};
        try {
            const content = await readFile(await localFile(w, path));
            sources.push({ path, sha256: hash(content), bytes: content.length, state: "present", ...flag });
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            sources.push({ path, sha256: null, bytes: null, state: "missing", ...flag });
        }
    }
    const active = state.phases.find(p => p.id === state.active);
    const references = await inspectPhaseSources(w, active?.sources);
    const requested = await Promise.all([...new Set(paths)].map(path => fingerprintSource(w, path)));
    return { sources, ...(references.length ? { phase_references: references } : {}), ...(requested.length ? { requested } : {}), rule: "Read present rules and brief in full on a new session. Reuse only if the same hash was already read and remains in context. Missing required rules must be resolved. These hashes do not grant approval." };
}
//# sourceMappingURL=context-output.js.map