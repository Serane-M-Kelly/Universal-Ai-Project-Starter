import { parseArgs } from "node:util";
import { inspectWorkspace, printDiagnostic } from "../lib/doctor.js";
import { resolveWorkspace } from "../lib/paths.js";
import { importProductPackage } from "../lib/product-package.js";
export async function runIntake(args) {
    const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            workspace: { type: "string" },
        },
    });
    const [action, packagePath, positionalWorkspace] = positionals;
    if (action !== "import" || !packagePath) {
        throw new Error("Usage : ai-project intake import <chemin-du-product-package> [chemin-du-workspace]");
    }
    const workspace = resolveWorkspace(values.workspace ?? positionalWorkspace ?? process.cwd());
    const initialReport = await inspectWorkspace(workspace);
    if (initialReport.verdict === "BLOCKED") {
        printDiagnostic(initialReport, false);
        throw new Error("Le workspace doit être débloqué avant d'importer un product-package.");
    }
    const result = await importProductPackage(workspace, packagePath);
    if (result.alreadyImported) {
        console.log(`\nPackage déjà importé à l'identique : ${result.manifest.package_id} v${result.manifest.package_version}`);
    }
    else {
        console.log(`\nProduct-package importé : ${result.manifest.package_id} v${result.manifest.package_version}`);
    }
    console.log(`Archive : ${result.archivePath}`);
    console.log(`Rapport : ${result.reportPath}`);
    if (result.warnings.length > 0) {
        console.log("Limites à conserver :");
        for (const warning of result.warnings) {
            console.log(`- ${warning.message}`);
        }
    }
    console.log("Prochaine action : utiliser project-discover pour auditer le package et préparer le brief brouillon.");
    const report = await inspectWorkspace(workspace);
    printDiagnostic(report, false);
    return report.verdict === "BLOCKED" ? 2 : 0;
}
//# sourceMappingURL=intake.js.map