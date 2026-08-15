import { describe, expect, it, vi } from "vitest";
import { resolveManagedBooking } from "./booking-manage";

// Each `.from("bookings")` call in resolveManagedBooking is a fresh chain that
// terminates in exactly one `.maybeSingle()`. Since call order is deterministic
// (token lookup, then one hop per reschedule link, then the final full select),
// a simple FIFO queue of responses is enough to drive it.
function makeDb(responses) {
  let cursor = 0;
  const from = vi.fn(() => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve(responses[cursor++])),
    };
    return builder;
  });
  return { from };
}

describe("resolveManagedBooking", () => {
  it("returns null when the token doesn't match any booking", async () => {
    const db = makeDb([{ data: null, error: null }]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toBeNull();
    expect(result.error).toBeNull();
  });

  it("propagates a lookup error without masking it", async () => {
    const dbError = { code: "connection_reset" };
    const db = makeDb([{ data: null, error: dbError }]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toBeNull();
    expect(result.error).toBe(dbError);
  });

  it("resolves directly to the booking when it was never rescheduled", async () => {
    const db = makeDb([
      { data: { id: "b1", rescheduled_to_id: null }, error: null },
      { data: { id: "b1", status: "confirmed", starts_at: "2099-01-01T00:00:00Z" }, error: null },
    ]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status,starts_at");
    expect(result.booking).toEqual({ id: "b1", status: "confirmed", starts_at: "2099-01-01T00:00:00Z" });
    expect(result.originalBookingId).toBe("b1");
    expect(result.error).toBeNull();
  });

  it("follows a single reschedule hop to the live booking", async () => {
    const db = makeDb([
      { data: { id: "b1", rescheduled_to_id: "b2" }, error: null }, // token lookup
      { data: { id: "b2", rescheduled_to_id: null }, error: null }, // hop
      { data: { id: "b2", status: "confirmed" }, error: null }, // final select
    ]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toEqual({ id: "b2", status: "confirmed" });
    expect(result.originalBookingId).toBe("b1"); // the token the visitor actually holds
  });

  it("follows a multi-hop reschedule chain (b1 -> b2 -> b3) to the current booking", async () => {
    const db = makeDb([
      { data: { id: "b1", rescheduled_to_id: "b2" }, error: null },
      { data: { id: "b2", rescheduled_to_id: "b3" }, error: null },
      { data: { id: "b3", rescheduled_to_id: null }, error: null },
      { data: { id: "b3", status: "confirmed" }, error: null },
    ]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toEqual({ id: "b3", status: "confirmed" });
    expect(result.originalBookingId).toBe("b1");
  });

  it("detects a reschedule cycle instead of looping forever", async () => {
    const db = makeDb([
      { data: { id: "b1", rescheduled_to_id: "b2" }, error: null }, // token lookup
      { data: { id: "b2", rescheduled_to_id: "b1" }, error: null }, // hop: b2 points back to b1
      { data: { id: "b1", rescheduled_to_id: "b2" }, error: null }, // hop: b1 refetched -> cycle detected here
    ]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("reschedule_cycle");
  });

  it("fails closed when a hop's target booking is missing", async () => {
    const db = makeDb([
      { data: { id: "b1", rescheduled_to_id: "b2" }, error: null },
      { data: null, error: null }, // b2 no longer exists
    ]);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("reschedule_target_missing");
  });

  it("bails out past 10 hops instead of walking an unbounded chain", async () => {
    // 11 links (b1 -> b2 -> ... -> b12) exceeds the 10-hop cap.
    const hops = Array.from({ length: 11 }, (_, i) => ({
      data: { id: `b${i + 1}`, rescheduled_to_id: `b${i + 2}` },
      error: null,
    }));
    const db = makeDb(hops);
    const result = await resolveManagedBooking(db, "hash_1", "id,status");
    expect(result.booking).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe("reschedule_chain_too_deep");
  });
});
