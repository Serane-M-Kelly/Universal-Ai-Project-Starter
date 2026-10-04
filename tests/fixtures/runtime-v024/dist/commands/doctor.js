import { parseArgs } from "node:util";
import { inspectWorkspace, exitCodeFor, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
export async function runDoctor(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            json: { type: "boolean", default: false },
            compact: { type: "boolean", default: false },
        },
    });
    const workspace = resolveWorkspace(positionals[0] ?? process.cwd());
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, values.json, values.compact);
    return exitCodeFor(report);
}
//# sourceMappingURL=doctor.js.map