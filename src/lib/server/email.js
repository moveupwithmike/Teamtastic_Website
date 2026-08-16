import { HTTP_TIMEOUT_MS } from "@/lib/server/http";

// Shared "reserve -> send via Resend -> record result" primitive. This is the
// piece that was previously copy-pasted at every call site (and had already
// drifted — only one of ~13 copies sent an Idempotency-Key header). Callers
// still own their own message body, `messages`/`agent_log` logging, and
// error handling, since those legitimately differ by context.
/**
 * @param {{
 *   messageType: string,
 *   recipient: string | string[],
 *   from?: string,
 *   subject: string,
 *   text: string,
 *   html?: string,
 *   idempotencyKey: string,
 *   timeoutMs?: number,
 * }} options
 */
export async function sendViaResend(supabase, options) {
  const { messageType, recipient, from, subject, text, html, idempotencyKey, timeoutMs = HTTP_TIMEOUT_MS.default } = options;
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    return {
      sent: false,
      reserved: false,
      providerMessageId: null,
      reason: "idempotency_key_required",
    };
  }
  const { data: reservation, error: reserveError } = await supabase.rpc("reserve_email_send", {
    p_message_type: messageType,
    p_recipient: Array.isArray(recipient) ? recipient[0] : recipient,
  });
  if (reserveError || !reservation?.allowed) {
    return {
      sent: false,
      reserved: false,
      providerMessageId: null,
      reason: reserveError?.message || reservation?.reason || "reservation_failed",
    };
  }

  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };

  let sent = false;
  let providerMessageId = null;
  let reason = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: from || process.env.RESEND_FROM_EMAIL,
        to: recipient,
        subject,
        text,
        ...(html ? { html } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await response.json().catch(() => ({}));
    sent = response.ok && Boolean(data.id);
    providerMessageId = data.id || null;
    if (!sent) reason = data.message || `Resend returned ${response.status}`;
  } catch (error) {
    reason = error?.message || String(error);
  }

  await supabase.rpc("record_email_send_result", { p_message_type: messageType, p_sent: sent });
  return { sent, reserved: true, providerMessageId, reason };
}
