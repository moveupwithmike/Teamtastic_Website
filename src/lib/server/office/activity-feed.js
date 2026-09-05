// @vitest-environment node

// Pure shaping/presentation logic for the /office/activity feed. No Supabase
// or auth calls live here — the page component owns the queries and passes
// rows in, so this module stays trivially unit-testable (mirrors hot-lead.js).

export function toneForOutcome(outcome) {
  switch (outcome) {
    case "failed":
    case "blocked":
      return "border-red-400/40 bg-red-500/10";
    case "escalated":
      return "border-orange-400/30 bg-orange-500/10";
    case "skipped":
      return "border-amber-400/20 bg-amber-500/10";
    case "completed":
      return "border-emerald-400/20 bg-emerald-500/10";
    default:
      return "border-white/10 bg-white/5";
  }
}

export function toneForRunStatus(status) {
  switch (status) {
    case "failed":
      return "border-red-400/40 bg-red-500/10";
    case "partial":
      return "border-orange-400/30 bg-orange-500/10";
    case "started":
      return "border-amber-400/20 bg-amber-500/10";
    case "completed":
      return "border-emerald-400/20 bg-emerald-500/10";
    default:
      return "border-white/10 bg-white/5";
  }
}

export function describeAgentLogEntry(row) {
  const agent = row.agent_name || "unknown agent";
  const action = (row.action || "unknown action").replaceAll("_", " ");
  const outcome = row.outcome || "unknown outcome";
  return `${agent}: ${action} — ${outcome}`;
}

export function describeSourceRun(row) {
  const provider = row.provider ? ` (${row.provider})` : "";
  const scanned = Number(row.records_scanned || 0);
  const created = Number(row.records_created || 0);
  const updated = Number(row.records_updated || 0);
  const runType = (row.run_type || "run").replaceAll("_", " ");
  return `${runType}${provider}: scanned ${scanned}, created ${created}, updated ${updated} — ${row.status}`;
}

export function describeScoreEvent(row) {
  const version = row.scoring_version ? ` (${row.scoring_version})` : "";
  return `Prospect re-scored to ${row.score}${version}`;
}

// Merges agent_log, source_runs, and prospect_score_history rows into one
// timestamp-sorted timeline. Each row already exists for other purposes
// (audit trail, pipeline logging, score history) — this only reshapes them
// for a single read-only view, it doesn't introduce new data.
export function mergeActivityTimeline(agentLogRows = [], sourceRunRows = [], scoreRows = []) {
  const entries = [
    ...agentLogRows.map((row) => ({
      id: `agent_log:${row.id}`,
      kind: "agent_log",
      timestamp: row.created_at,
      tone: toneForOutcome(row.outcome),
      summary: describeAgentLogEntry(row),
      prospectId: row.prospect_id || null,
      detail: row.error || (row.decision && Object.keys(row.decision).length ? JSON.stringify(row.decision) : null),
    })),
    ...sourceRunRows.map((row) => ({
      id: `source_run:${row.id}`,
      kind: "source_run",
      timestamp: row.completed_at || row.started_at,
      tone: toneForRunStatus(row.status),
      summary: describeSourceRun(row),
      prospectId: null,
      detail: row.error || (row.decision && Object.keys(row.decision).length ? JSON.stringify(row.decision) : null),
    })),
    ...scoreRows.map((row) => ({
      id: `score:${row.prospect_id}:${row.created_at}`,
      kind: "score",
      timestamp: row.created_at,
      tone: "border-purple-400/20 bg-purple-500/10",
      summary: describeScoreEvent(row),
      prospectId: row.prospect_id || null,
      detail: Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join(", ") : null,
    })),
  ];
  return entries
    .filter((entry) => Boolean(entry.timestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
