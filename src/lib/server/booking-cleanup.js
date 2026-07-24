export async function recordBookingCleanupFailure(db, {
  bookingId,
  prospectId,
  operation,
  provider,
  resourceId,
  error,
}) {
  const message = String(error?.message || error || "unknown").slice(0, 500);
  const fingerprint = `booking:cleanup:${operation}:${bookingId}:${provider}`;
  await Promise.all([
    db.from("tasks").upsert({
      prospect_id: prospectId || null,
      title: `Booking ${provider} cleanup needs attention`,
      description: `${operation} failed for booking ${bookingId}. ${provider} resource ${resourceId || "unknown"} may still be active. Error: ${message}`,
      priority: "urgent",
      due_at: new Date().toISOString(),
      source: "booking_cleanup_failure",
      fingerprint,
    }, { onConflict: "fingerprint", ignoreDuplicates: true }),
    db.from("agent_log").insert({
      agent_name: "booking-cleanup",
      action: operation,
      outcome: "escalated",
      prospect_id: prospectId || null,
      decision: { booking_id: bookingId, provider, resource_id: resourceId || null },
      error: message,
    }),
  ]);
}

export async function attemptBookingCleanup(db, options, cleanup) {
  try {
    await cleanup();
    return true;
  } catch (error) {
    await recordBookingCleanupFailure(db, { ...options, error });
    return false;
  }
}
