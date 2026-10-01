import { parseArgs } from "node:util";
import { listProfiles, loadProfile } from "../lib/profiles.js";

export async function runProfile(args: string[]): Promise<number> {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
  });
  const [action, profileId] = positionals;

  if (action === "list" && !profileId) {
    const profiles = await listProfiles();
    console.log("\nProfils disponibles :\n");
    for (const profile of profiles) {
      console.log(
        `- ${profile.profile.id} v${profile.profile.version} — ${profile.profile.label}`,
      );
      console.log(`  ${profile.profile.description}`);
    }
    console.log();
    return 0;
  }

  if (action === "show" && profileId && positionals.length === 2) {
    const profile = await loadProfile(profileId);
    console.log(`\n${profile.profile.label} (${profile.profile.id} v${profile.profile.version})`);
    console.log(profile.profile.description);
    console.log(`Modes : ${profile.compatibility.entry_modes.join(", ")}`);
    console.log(`Stratégie : ${profile.commands.strategy}`);
    console.log(
      `Commandes obligatoires : ${profile.commands.required.length > 0 ? profile.commands.required.join(", ") : "aucune"}`,
    );
    console.log("Commandes obligatoires selon le mode :");
    if (profile.commands.required_by_entry_mode.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.commands.required_by_entry_mode) {
        console.log(`- ${requirement.name} (${requirement.entry_modes.join(", ")})`);
      }
    }
    console.log("Principes :");
    printItems(profile.guidance.principles);
    console.log("Résultats attendus du setup :");
    printItems(profile.guidance.setup_outcomes);
    console.log("Exigences de structure :");
    if (profile.validation.required_paths.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.validation.required_paths) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        console.log(
          `- ${requirement.path} (${requirement.kind}, ${requirement.severity}${modes})`,
        );
      }
    }
    console.log("Alternatives de structure :");
    if (profile.validation.any_of_paths.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.validation.any_of_paths) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        const alternatives = requirement.alternatives
          .map((alternative) => `${alternative.path} (${alternative.kind})`)
          .join(" | ");
        console.log(
          `- ${requirement.label}: ${alternatives} (${requirement.severity}${modes})`,
        );
      }
    }
    console.log("Structures à nom variable :");
    if (profile.validation.any_of_matches.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.validation.any_of_matches) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        const alternatives = requirement.alternatives
          .map((alternative) => `${alternative.pattern} (${alternative.kind})`)
          .join(" | ");
        console.log(
          `- ${requirement.label}: ${alternatives} (profondeur ${requirement.max_depth}, ${requirement.severity}${modes})`,
        );
      }
    }
    console.log("Preuves de contenu :");
    if (profile.validation.required_text_matches.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.validation.required_text_matches) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        console.log(
          `- ${requirement.label}: ${requirement.patterns.join(" | ")} contient ${requirement.contains.join(` ${requirement.match} `)} (${requirement.severity}${modes})`,
        );
      }
    }
    console.log("Champs JSON requis :");
    if (profile.validation.required_json_fields.length === 0) {
      console.log("- aucun");
    } else {
      for (const requirement of profile.validation.required_json_fields) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        console.log(
          `- ${requirement.path}: ${requirement.fields.join(", ")} (${requirement.severity}${modes})`,
        );
      }
    }
    console.log("Alternatives de champs JSON :");
    if (profile.validation.any_of_json_fields.length === 0) {
      console.log("- aucune");
    } else {
      for (const requirement of profile.validation.any_of_json_fields) {
        const modes = requirement.entry_modes
          ? ` · ${requirement.entry_modes.join(", ")}`
          : "";
        console.log(
          `- ${requirement.path}: ${requirement.fields.join(" | ")} (${requirement.severity}${modes})`,
        );
      }
    }
    console.log();
    return 0;
  }

  throw new Error("Usage : ai-project profile list | ai-project profile show <id>");
}

function printItems(items: string[]): void {
  if (items.length === 0) {
    console.log("- aucun");
    return;
  }
  for (const item of items) console.log(`- ${item}`);
}
