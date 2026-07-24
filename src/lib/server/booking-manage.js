export async function resolveManagedBooking(db, tokenHash, select) {
  const { data: original, error } = await db.from("bookings")
    .select("id,rescheduled_to_id")
    .eq("manage_token_hash", tokenHash)
    .maybeSingle();
  if (error || !original) return { booking: null, error };

  const visited = new Set();
  let current = original;
  for (let depth = 0; current?.rescheduled_to_id && depth < 10; depth += 1) {
    if (visited.has(current.id)) return { booking: null, error: new Error("reschedule_cycle") };
    visited.add(current.id);
    const next = await db.from("bookings")
      .select("id,rescheduled_to_id")
      .eq("id", current.rescheduled_to_id)
      .maybeSingle();
    if (next.error || !next.data) return { booking: null, error: next.error || new Error("reschedule_target_missing") };
    current = next.data;
  }
  if (current?.rescheduled_to_id) return { booking: null, error: new Error("reschedule_chain_too_deep") };

  const result = await db.from("bookings").select(select).eq("id", current.id).maybeSingle();
  return { booking: result.data, error: result.error, originalBookingId: original.id };
}
