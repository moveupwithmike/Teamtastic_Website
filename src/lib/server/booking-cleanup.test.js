import { describe, expect, it, vi } from "vitest";
import { attemptBookingCleanup, recordBookingCleanupFailure } from "./booking-cleanup";

function makeDb() {
  const tasksUpsert = vi.fn((..._args) => Promise.resolve({ data: null, error: null }));
  const agentLogInsert = vi.fn((..._args) => Promise.resolve({ data: null, error: null }));
  const from = vi.fn((table) => {
    if (table === "tasks") return { upsert: tasksUpsert };
    if (table === "agent_log") return { insert: agentLogInsert };
    throw new Error(`unexpected table ${table}`);
  });
  return { db: { from }, tasksUpsert, agentLogInsert };
}

describe("attemptBookingCleanup", () => {
  it("returns true and never touches the database when cleanup succeeds", async () => {
    const { db, tasksUpsert, agentLogInsert } = makeDb();
    const cleanup = vi.fn(() => Promise.resolve());

    const result = await attemptBookingCleanup(db, {
      bookingId: "b1",
      prospectId: undefined,
      operation: "cancel_zoom",
      provider: undefined,
      resourceId: undefined,
    }, cleanup);

    expect(result).toBe(true);
    expect(cleanup).toHaveBeenCalled();
    expect(tasksUpsert).not.toHaveBeenCalled();
    expect(agentLogInsert).not.toHaveBeenCalled();
  });

  it("returns false and escalates via a task + agent_log entry when cleanup throws", async () => {
    const { db, tasksUpsert, agentLogInsert } = makeDb();
    const cleanup = vi.fn(() => Promise.reject(new Error("zoom api down")));

    const result = await attemptBookingCleanup(db, {
      bookingId: "b1",
      prospectId: "p1",
      operation: "cancel_zoom",
      provider: "zoom",
      resourceId: "zoom_123",
    }, cleanup);

    expect(result).toBe(false);
    expect(tasksUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        prospect_id: "p1",
        priority: "urgent",
        source: "booking_cleanup_failure",
        fingerprint: "booking:cleanup:cancel_zoom:b1:zoom",
        description: expect.stringContaining("zoom api down"),
      }),
      { onConflict: "fingerprint", ignoreDuplicates: true },
    );
    expect(agentLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_name: "booking-cleanup",
        action: "cancel_zoom",
        outcome: "escalated",
        prospect_id: "p1",
        decision: { booking_id: "b1", provider: "zoom", resource_id: "zoom_123" },
        error: "zoom api down",
      }),
    );
  });
});

describe("recordBookingCleanupFailure", () => {
  it("defaults prospect_id to null and resource_id to 'unknown' when not provided", async () => {
    const { db, tasksUpsert, agentLogInsert } = makeDb();

    await recordBookingCleanupFailure(db, {
      bookingId: "b1",
      prospectId: undefined,
      operation: "delete_calendar_event",
      provider: "google_calendar",
      resourceId: undefined,
      error: new Error("calendar api down"),
    });

    expect(tasksUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ prospect_id: null, description: expect.stringContaining("resource unknown") }),
      expect.anything(),
    );
    expect(agentLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({ prospect_id: null, decision: expect.objectContaining({ resource_id: null }) }),
    );
  });

  it("truncates an overlong error message to 500 characters", async () => {
    const { db, tasksUpsert } = makeDb();
    const longMessage = "x".repeat(1000);

    await recordBookingCleanupFailure(db, {
      bookingId: "b1",
      prospectId: undefined,
      operation: "cancel_zoom",
      provider: "zoom",
      resourceId: undefined,
      error: new Error(longMessage),
    });

    const [taskPayload] = tasksUpsert.mock.calls[0];
    const embeddedError = taskPayload.description.split("Error: ")[1];
    expect(embeddedError.length).toBe(500);
  });

  it("falls back to the raw value when the error has no .message", async () => {
    const { db, agentLogInsert } = makeDb();

    await recordBookingCleanupFailure(db, {
      bookingId: "b1",
      prospectId: undefined,
      operation: "cancel_zoom",
      provider: "zoom",
      resourceId: undefined,
      error: "plain string failure",
    });

    expect(agentLogInsert).toHaveBeenCalledWith(expect.objectContaining({ error: "plain string failure" }));
  });

  it("falls back to 'unknown' when no error is provided at all", async () => {
    const { db, agentLogInsert } = makeDb();

    await recordBookingCleanupFailure(db, {
      bookingId: "b1",
      prospectId: undefined,
      operation: "cancel_zoom",
      provider: "zoom",
      resourceId: undefined,
      error: undefined,
    });

    expect(agentLogInsert).toHaveBeenCalledWith(expect.objectContaining({ error: "unknown" }));
  });
});
