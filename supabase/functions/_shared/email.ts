export type ResendMessage = {
  from?: string | null;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | null;
};

export type EmailSendResult = {
  sent: boolean;
  reserved: boolean;
  providerMessageId: string | null;
  reason: string | null;
  status: number | null;
};

export type EmailSendOptions = ResendMessage & {
  messageType: string;
  recipient: string;
  idempotencyKey: string;
  apiKey?: string | null;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

type RpcError = { message?: string } | null;
type RpcResponse = { data: unknown; error: RpcError };
type EmailRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
};

const RESEND_URL = "https://api.resend.com/emails";

export async function sendViaResend(
  supabase: EmailRpcClient,
  options: EmailSendOptions,
): Promise<EmailSendResult> {
  if (!options.idempotencyKey.trim()) {
    return { sent: false, reserved: false, providerMessageId: null, reason: "idempotency_key_required", status: null };
  }

  const { data: reservationData, error: reservationError } = await supabase.rpc("reserve_email_send", {
    p_message_type: options.messageType,
    p_recipient: options.recipient,
  });
  const reservation = reservationData as { allowed?: boolean; reason?: string } | null;
  if (reservationError || reservation?.allowed !== true) {
    return {
      sent: false,
      reserved: false,
      providerMessageId: null,
      reason: reservationError?.message || reservation?.reason || "reservation_failed",
      status: null,
    };
  }

  const apiKey = options.apiKey || Deno.env.get("RESEND_API_KEY");
  let providerMessageId: string | null = null;
  let reason: string | null = null;
  let status: number | null = null;
  let sent = false;

  if (!apiKey) {
    reason = "RESEND_API_KEY is not configured";
  } else if (!options.from) {
    reason = "Email sender is not configured";
  } else {
    const message: ResendMessage = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.reply_to,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": options.idempotencyKey,
    };

    try {
      const response = await (options.fetcher || fetch)(RESEND_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...message, to: Array.isArray(message.to) ? message.to : [message.to] }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      providerMessageId = typeof payload.id === "string" ? payload.id : null;
      status = response.status;
      sent = response.ok && Boolean(providerMessageId);
      reason = sent ? null : String(payload.message || payload.error || `Resend returned ${response.status}`).slice(0, 1000);
    } catch (error) {
      reason = String(error).slice(0, 1000);
    }
  }

  const { error: recordError } = await supabase.rpc("record_email_send_result", {
    p_message_type: options.messageType,
    p_sent: sent,
  });
  if (recordError) reason = reason || `record_email_send_result: ${recordError.message || "failed"}`;

  return { sent, reserved: true, providerMessageId, reason, status };
}
