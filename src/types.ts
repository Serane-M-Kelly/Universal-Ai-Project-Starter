export type EntryMode = "idea" | "brief" | "existing" | "maintenance";
export type ApprovalPolicy = "allowed" | "ask" | "forbidden";
export type DisclosurePolicy = "unspecified" | "allowed" | "required" | "forbidden";
export type CommandName = "install" | "dev" | "lint" | "typecheck" | "test" | "build";

export type ProjectCommands = Record<CommandName, string | null>;

export interface ProjectConfig {
  schema_version: 1;
  starter_version: string;
  project: {
    name: string;
    slug: string;
    entry_mode: EntryMode;
    owner: string | null;
  };
  paths: {
    workspace_root: string;
    code_root: string;
    repository_root: string;
  };
  profile: {
    id: string;
    version: number;
  };
  adapters: AdapterReference[];
  skills?: SkillReference[];
  agents?: AgentReference[];
  commands: ProjectCommands;
  governance: {
    brief_approval: ApprovalPolicy;
    external_actions: ApprovalPolicy;
    destructive_actions: ApprovalPolicy;
    commits: ApprovalPolicy;
    deployment: ApprovalPolicy;
    ai_disclosure: DisclosurePolicy;
  };
  privacy: {
    private_paths: string[];
    secret_patterns: string[];
  };
}

export interface AdapterReference {
  id: string;
  version: number;
}

export interface SkillReference {
  id: string;
  version: number;
  source_hash: string;
}

export interface AgentReference {
  id: string;
  version: number;
  origin: "starter" | "user";
  source_hash: string;
  replicas: Record<string, string>;
}

export interface AdapterManifest {
  schema_version: 1;
  adapter: {
    id: string;
    version: number;
    label: string;
    vendor: string;
    description: string;
  };
  compatibility: {
    project_schema_versions: number[];
    profiles: string[];
  };
  launch: {
    working_directory: "workspace" | "code";
    command: string;
    requires_trust: boolean;
  };
  directories: string[];
  skills: {
    destination: string;
    ownership: "starter-managed";
  };
  agents: {
    destination: string;
    format: "codex-toml" | "claude-markdown";
    ownership: "starter-managed";
  };
  outputs: Array<{
    path: string;
    template: string;
    ownership: "user-owned" | "starter-managed";
  }>;
}

export interface SkillCatalog {
  schema_version: 1;
  skills: SkillManifest[];
}

export interface SkillManifest {
  id: string;
  version: number;
  label: string;
  source: string;
  compatibility: {
    workflows: Array<"legacy" | "phases-v3">;
    phase_runtime_min?: string;
    entry_modes: EntryMode[];
    profiles: string[];
  };
}

export interface AgentCatalog {
  schema_version: 1;
  agents: Array<{
    id: string;
    source: string;
  }>;
}

export interface AgentManifest {
  schema_version: 1;
  agent: {
    id: string;
    version: number;
    label: string;
    description: string;
  };
  enabled: boolean;
  compatibility: {
    entry_modes: EntryMode[];
    profiles: string[];
  };
  execution: {
    filesystem: "read-only" | "workspace-write";
    shell: boolean;
    network: boolean;
    delegation: boolean;
  };
  authority: {
    brief_approval: false;
    work_acceptance: false;
    ship_approval: false;
    external_actions: "ask" | "forbidden";
    destructive_actions: "ask" | "forbidden";
    commits: "ask" | "forbidden";
    deployment: "ask" | "forbidden";
  };
}

export interface ProfileManifest {
  schema_version: 5;
  profile: {
    id: string;
    version: number;
    label: string;
    description: string;
  };
  compatibility: {
    entry_modes: EntryMode[];
  };
  commands: {
    strategy: "detect-existing" | "profile-defaults" | "manual";
    defaults: ProjectCommands;
    required: CommandName[];
    required_by_entry_mode: Array<{
      name: CommandName;
      entry_modes: EntryMode[];
    }>;
  };
  guidance: {
    principles: string[];
    setup_outcomes: string[];
  };
  validation: {
    required_paths: Array<{
      path: string;
      kind: "file" | "directory";
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
    any_of_paths: Array<{
      label: string;
      alternatives: Array<{
        path: string;
        kind: "file" | "directory";
      }>;
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
    any_of_matches: Array<{
      label: string;
      alternatives: Array<{
        pattern: string;
        kind: "file" | "directory";
      }>;
      max_depth: number;
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
    required_text_matches: Array<{
      label: string;
      patterns: string[];
      contains: string[];
      match: "any" | "all";
      max_depth: number;
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
    required_json_fields: Array<{
      path: string;
      fields: string[];
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
    any_of_json_fields: Array<{
      path: string;
      fields: string[];
      severity: "warning" | "blocked";
      entry_modes?: EntryMode[];
    }>;
  };
}

export type TaskCategory =
  | "product"
  | "ux"
  | "tech"
  | "architecture"
  | "data"
  | "security"
  | "quality"
  | "docs"
  | "delivery"
  | "human";

export type EvidenceKind =
  | "report"
  | "test"
  | "decision"
  | "document"
  | "commit"
  | "observation";

export interface TaskEvidence {
  id: string;
  kind: EvidenceKind;
  ref: string;
  recorded_at: string;
  observed_by: string | null;
  state: "valid" | "superseded" | "invalidated";
  state_reason: string | null;
  state_at: string | null;
}

/** État effectif d'une tâche : dérivé, jamais stocké. */
export type TaskState = "todo" | "done" | "blocked" | "dropped";

export interface BacklogTask {
  id: string;
  title: string;
  category: TaskCategory;
  required: boolean;
  /** Disposition éditoriale stockée ; l'état effectif se dérive des preuves. */
  disposition: "active" | "blocked" | "dropped";
  derived_from: string[];
  origin: "planned" | "discovered";
  source_work: string | null;
  origin_reason: string | null;
  added_at: string | null;
  blocked_reason: string | null;
  dropped_by: string | null;
  dropped_at: string | null;
  dropped_reason: string | null;
  evidence_log: TaskEvidence[];
}

/** État effectif d'un résultat : dérivé, jamais stocké. */
export type ItemState =
  | "candidate"
  | "ready"
  | "in_progress"
  | "built"
  | "done"
  | "deferred"
  | "retired";

export interface BacklogItem {
  id: string;
  title: string;
  phase: string;
  order: number;
  /** État éditorial stocké : uniquement `candidate` ou `ready`. */
  stage: "candidate" | "ready";
  disposition: "active" | "deferred" | "retired";
  required: boolean;
  priority: "P0" | "P1" | "P2";
  depends_on: string[];
  derived_from: string[];
  legacy_work_items: string[];
  outcome_accepted_by: string | null;
  outcome_accepted_at: string | null;
  tasks: BacklogTask[];
}

/** État effectif d'une phase : entièrement dérivé. */
export type PhaseState =
  | "empty"
  | "optional"
  | "not_started"
  | "in_progress"
  | "complete"
  | "retired";

export interface BacklogPhase {
  id: string;
  title: string;
  goal: string;
  disposition: "active" | "retired";
  prepared_by: string | null;
  prepared_at: string | null;
}

export interface BacklogDocument {
  schema_version: 2;
  backlog_version: number;
  status: "draft" | "approved";
  approved_by: string | null;
  approved_at: string | null;
  source_brief_version: number;
  source_setup_report: string;
  last_reviewed_at: string | null;
  id_allocation: {
    next_phase: number;
    next_item: number;
    next_task: number;
    next_evidence: number;
  };
  phases: BacklogPhase[];
  items: BacklogItem[];
}

export interface WorkUnitSummary {
  id: string;
  path: string;
  title: string;
  status: string;
  realizes: string[];
  crossCutting: boolean;
  body: string;
}

export type DiagnosticSeverity = "ok" | "warning" | "blocked";

export interface DiagnosticItem {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
}

export type DiagnosticVerdict = "READY" | "WARNING" | "BLOCKED";

export interface DiagnosticReport {
  verdict: DiagnosticVerdict;
  workspace: string;
  items: DiagnosticItem[];
}

export type ProductPackageStatus =
  | "draft"
  | "ready_for_review"
  | "ready_for_intake"
  | "superseded";

export type ProductStage =
  | "initial_idea"
  | "discovery"
  | "concept_defined"
  | "prototype_tested"
  | "ready_to_build";

export interface ProductPackageManifest {
  contract: "project-architect-product-package";
  contract_version: 1;
  package_id: string;
  package_version: number;
  package_status: ProductPackageStatus;
  project_name: string;
  project_stage: ProductStage;
  decision_owner: string;
  created_at: string | null;
  updated_at: string | null;
  supersedes: string | null;
  producer: {
    name: string;
    surface: string;
  };
  evidence: {
    public_research: "not_started" | "in_progress" | "available" | "not_required";
    real_user_validation:
      | "none"
      | "planned"
      | "in_progress"
      | "available"
      | "not_required_for_current_decision";
    synthetic_material_present: boolean;
  };
  prototype: {
    status: "not_started" | "in_progress" | "available" | "tested";
    canonical_reference: string | null;
  };
  review: {
    independent_review:
      | "not_started"
      | "changes_requested"
      | "passed_with_limits"
      | "passed";
    reviewed_at: string | null;
  };
  confidentiality: {
    classification: "private" | "restricted" | "shareable";
    contains_personal_data: boolean;
    restricted_paths: string[];
  };
  contents: {
    project_passport: "PROJECT_PASSPORT.md";
    evidence_register: "EVIDENCE_REGISTER.md";
    product_strategy: "PRODUCT_STRATEGY.md";
    ux_flows: "UX_FLOWS.md";
    prototype_brief: "PROTOTYPE_BRIEF.md";
    validation_report: "VALIDATION_REPORT.md";
    decision_log: "DECISION_LOG.md";
    open_questions: "OPEN_QUESTIONS.md";
    review_report: "REVIEW_REPORT.md";
    build_handoff: "BUILD_HANDOFF.md";
  };
}
