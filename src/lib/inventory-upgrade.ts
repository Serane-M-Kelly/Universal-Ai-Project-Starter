/** Strict, conservative comparison for an explicitly acknowledged inventory hash transition.
 * No historic proof is rewritten. Never considers a downgrade to be a new approval.
 */
type PhaseState = { id: string; number: number; title: string; state: string; done: string[]; review: boolean; carried?: string[] };
type Snapshot = { status: any; contexts: any[] };
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const without = (value: any, keys: string[]): any => Object.fromEntries(
  Object.entries(value ?? {}).filter(([key]) => !keys.includes(key))
);
const subset = (xs: string[], ys: string[]): boolean => xs.every(x => ys.includes(x));

export function conservativeInventoryTransition(before: Snapshot, after: Snapshot, expectedCode: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedCode)) return false;
  if (before.contexts.length !== after.contexts.length) return false;
  if (!equal(without(before.status, ["phases", "backlog_refresh_needed"]), without(after.status, ["phases", "backlog_refresh_needed"]))) return false;
  if (before.status.backlog_refresh_needed && !after.status.backlog_refresh_needed) return false;
  const oldPhases = before.status.phases as PhaseState[], newPhases = after.status.phases as PhaseState[];
  if (!Array.isArray(oldPhases) || !Array.isArray(newPhases) || oldPhases.length !== newPhases.length) return false;
  for (let i = 0; i < oldPhases.length; i++) {
    const a = oldPhases[i]!, b = newPhases[i]!;
    if (!equal(without(a, ["state", "done", "review", "carried"]), without(b, ["state", "done", "review", "carried"]))) return false;
    if (!Array.isArray(a.done) || !Array.isArray(b.done) || !subset(b.done, a.done)) return false;
    if ((!a.review && b.review) || !subset(b.carried ?? [], a.carried ?? [])) return false;
    if (a.state !== b.state) {
      if (a.state === "accepted" || a.state === "blocked") return false;
      if (!["not_started", "in_progress", "ready_for_review"].includes(a.state) ||
          !["not_started", "in_progress"].includes(b.state)) return false;
      if (a.state === "not_started" && b.state !== "not_started") return false;
    }
    const oc = before.contexts[i]!, nc = after.contexts[i]!;
    if (nc.code_hash !== expectedCode || !equal(without(oc, ["code_hash", "status"]), without(nc, ["code_hash", "status"]))) return false;
    if (!equal(oc.status, a) || !equal(nc.status, b)) return false;
  }
  return true;
}
