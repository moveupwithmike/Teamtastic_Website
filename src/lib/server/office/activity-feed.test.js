// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  describeAgentLogEntry,
  describeScoreEvent,
  describeSourceRun,
  mergeActivityTimeline,
  toneForOutcome,
  toneForRunStatus,
} from "./activity-feed";

describe("toneForOutcome / toneForRunStatus", () => {
  it("flags failed and blocked outcomes as the most severe tone", () => {
    expect(toneForOutcome("failed")).toBe(toneForOutcome("blocked"));
    expect(toneForOutcome("failed")).toContain("red");
  });

  it("falls back to a neutral tone for unrecognized outcomes/statuses", () => {
    expect(toneForOutcome("started")).toContain("white");
    expect(toneForRunStatus("weird")).toContain("white");
  });

  it("distinguishes failed/partial/started/completed run statuses", () => {
    expect(toneForRunStatus("failed")).toContain("red");
    expect(toneForRunStatus("partial")).toContain("orange");
    expect(toneForRunStatus("started")).toContain("amber");
    expect(toneForRunStatus("completed")).toContain("emerald");
  });
});

describe("describe* summary builders", () => {
  it("builds a readable agent_log summary with underscores humanized", () => {
    const summary = describeAgentLogEntry({ agent_name: "phase3-drafter", action: "draft_outreach", outcome: "completed" });
    expect(summary).toBe("phase3-drafter: draft outreach — completed");
  });

  it("falls back to safe labels when agent_log fields are missing", () => {
    expect(describeAgentLogEntry({})).toBe("unknown agent: unknown action — unknown outcome");
  });

  it("builds a readable source_run summary including counts and provider", () => {
    const summary = describeSourceRun({
      run_type: "apollo_enrichment", provider: "apollo", status: "completed",
      records_scanned: 10, records_created: 2, records_updated: 3,
    });
    expect(summary).toBe("apollo enrichment (apollo): scanned 10, created 2, updated 3 — completed");
  });

  it("omits the provider parenthetical when provider is missing", () => {
    expect(describeSourceRun({ run_type: "prospect_scoring", status: "completed" })).toBe(
      "prospect scoring: scanned 0, created 0, updated 0 — completed",
    );
  });

  it("includes the scoring version in the score summary when present", () => {
    expect(describeScoreEvent({ score: 82.5, scoring_version: "phase3-v1" })).toBe("Prospect re-scored to 82.5 (phase3-v1)");
    expect(describeScoreEvent({ score: 40 })).toBe("Prospect re-scored to 40");
  });
});

describe("mergeActivityTimeline", () => {
  it("merges all three sources and sorts by timestamp descending", () => {
    const timeline = mergeActivityTimeline(
      [{ id: 1, agent_name: "a", action: "x", outcome: "completed", created_at: "2026-09-04T10:00:00Z" }],
      [{ id: "r1", run_type: "apollo_enrichment", provider: "apollo", status: "completed", completed_at: "2026-09-04T12:00:00Z" }],
      [{ prospect_id: "p1", score: 90, created_at: "2026-09-04T08:00:00Z" }],
    );
    expect(timeline.map((entry) => entry.kind)).toEqual(["source_run", "agent_log", "score"]);
  });

  it("drops rows with no usable timestamp instead of throwing", () => {
    const timeline = mergeActivityTimeline(
      [{ id: 1, agent_name: "a", action: "x", outcome: "completed" }],
      [{ id: "r1", run_type: "apollo_enrichment", status: "started" }],
      [],
    );
    expect(timeline).toEqual([]);
  });

  it("prefers source_run completed_at over started_at when both are present", () => {
    const timeline = mergeActivityTimeline([], [{
      id: "r1", run_type: "apollo_enrichment", status: "completed",
      started_at: "2026-09-04T01:00:00Z", completed_at: "2026-09-04T02:00:00Z",
    }], []);
    expect(timeline[0].timestamp).toBe("2026-09-04T02:00:00Z");
  });

  it("carries the prospect id through for agent_log and score rows, but not source_run rows", () => {
    const timeline = mergeActivityTimeline(
      [{ id: 1, agent_name: "a", action: "x", outcome: "completed", created_at: "2026-09-04T10:00:00Z", prospect_id: "p1" }],
      [{ id: "r1", run_type: "apollo_enrichment", status: "completed", completed_at: "2026-09-04T09:00:00Z" }],
      [{ prospect_id: "p2", score: 90, created_at: "2026-09-04T08:00:00Z" }],
    );
    expect(timeline[0].prospectId).toBe("p1");
    expect(timeline[1].prospectId).toBeNull();
    expect(timeline[2].prospectId).toBe("p2");
  });

  it("surfaces the error string as detail when present, ahead of the decision payload", () => {
    const timeline = mergeActivityTimeline(
      [{ id: 1, agent_name: "a", action: "x", outcome: "failed", created_at: "2026-09-04T10:00:00Z", error: "boom", decision: { reason: "ignored" } }],
      [],
      [],
    );
    expect(timeline[0].detail).toBe("boom");
  });

  it("omits detail entirely when there is no error and decision is empty", () => {
    const timeline = mergeActivityTimeline(
      [{ id: 1, agent_name: "a", action: "x", outcome: "completed", created_at: "2026-09-04T10:00:00Z", decision: {} }],
      [],
      [],
    );
    expect(timeline[0].detail).toBeNull();
  });
});
