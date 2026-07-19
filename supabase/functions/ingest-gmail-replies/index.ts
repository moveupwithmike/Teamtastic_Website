import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

const MAILBOX = (Deno.env.get("GMAIL_MAILBOX") || "michael@tryteamtastic.com").toLowerCase();

function decodeBase64Url(value = "") {
  if (!value) return "";
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function messageBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  const plainChild = part.parts?.find((child) => child.mimeType === "text/plain");
  if (plainChild) return messageBody(plainChild);
  for (const child of part.parts || []) {
    const nested = messageBody(child);
    if (nested) return nested;
  }
  if (part.mimeType === "text/html" && part.body?.data) return stripHtml(decodeBase64Url(part.body.data));
  return "";
}

function headerMap(headers: GmailHeader[] = []) {
  return Object.fromEntries(headers.map((header) => [String(header.name || "").toLowerCase(), String(header.value || "")]));
}

function emailAddress(value = "") {
  const angleMatch = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  const plainMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (angleMatch?.[1] || plainMatch?.[0] || "").toLowerCase();
}

function displayName(value = "") {
  const beforeAngle = value.split("<")[0].replaceAll('"', "").trim();
  return beforeAngle || emailAddress(value).split("@")[0] || "Unknown sender";
}

function addressList(value = "") {
  return value.split(",").map(emailAddress).filter(Boolean);
}

function isAutomatedSystemMessage(sender: string, subject: string, headers: Record<string, string>) {
  const localPart = sender.split("@")[0] || "";
  const normalizedSubject = subject.toLowerCase();
  const autoSubmitted = (headers["auto-submitted"] || "").toLowerCase();
  const precedence = (headers.precedence || "").toLowerCase();

  return (
    /(?:^|[._-])(?:no-?reply|do-?not-?reply|mailer-daemon|postmaster)(?:$|[._-])/.test(localPart) ||
    /^(?:notifications?|alerts?|security-alerts?)$/.test(localPart) ||
    (autoSubmitted !== "" && autoSubmitted !== "no") ||
    /^(?:bulk|junk|list)$/.test(precedence) ||
    Boolean(headers["list-id"]) ||
    Boolean(headers["list-unsubscribe"]) ||
    /^(?:security alert|delivery status notification|undeliverable|mail delivery failed)\b/.test(normalizedSubject)
  );
}

function classifyReply(subject: string, body: string) {
  const text = `${subject}\n${body}`.toLowerCase().slice(0, 30_000);
  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/\b(unsubscribe|remove me|stop emailing|do not (?:email|contact)|opt[ -]?out)\b/)) {
    return { classification: "unsubscribe", confidence: 0.99, reason: "explicit opt-out language" };
  }
  if (has(/\b(attorney|legal counsel|cease and desist|lawsuit|litigation|legal action)\b/)) {
    return { classification: "legal", confidence: 0.97, reason: "legal escalation language" };
  }
  if (has(/\b(spam|reported you|harassment|complaint|never contact)\b/)) {
    return { classification: "complaint", confidence: 0.95, reason: "complaint or spam language" };
  }
  if (has(/\b(out of (?:the )?office|automatic reply|auto(?:matic)? response|away from (?:my )?email|on (?:vacation|leave))\b/)) {
    return { classification: "out_of_office", confidence: 0.96, reason: "automatic absence language" };
  }
  if (has(/\b(not interested|no thank(?:s| you)|not a fit|please pass|we(?:'re| are) all set|do not need)\b/)) {
    return { classification: "not_interested", confidence: 0.94, reason: "explicit negative response" };
  }
  if (has(/\b(reach out to|contact|speak with|forwarded (?:this|your email) to|looping in|better person)\b.{0,80}\b(colleague|manager|team|hr|people|events?|them|her|him)\b/)) {
    return { classification: "referral", confidence: 0.86, reason: "referral language" };
  }
  if (has(/\b(interested|sounds (?:good|great)|let(?:'s| us) (?:talk|chat|meet)|book (?:a )?(?:call|demo)|available (?:to|for)|tell me more|send (?:me )?(?:details|pricing))\b/)) {
    return { classification: "interested", confidence: 0.90, reason: "positive buying language" };
  }
  if (body.includes("?") || has(/\b(question(?:s)?|wondering|how|what|when|where|who|can you|could you|would you|pricing|cost|programs?|services?|more information)\b/)) {
    return { classification: "question", confidence: 0.82, reason: "question language" };
  }
  return { classification: "unknown", confidence: 0.35, reason: "no high-confidence rule matched" };
}

async function gmailFetch(path: string, accessToken: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Gmail ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("GMAIL_INGESTION_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,gmail_ingestion_enabled")
    .eq("id", true)
    .single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });
  if (!config.master_enabled || !config.gmail_ingestion_enabled) {
    return Response.json({ processed: 0, inserted: 0, skipped: true, reason: "gmail_ingestion_disabled" });
  }

  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    await supabase.from("mailbox_sync_state").update({
      status: "not_configured",
      last_error: "Gmail OAuth secrets are incomplete",
    }).eq("mailbox", MAILBOX);
    return new Response("Gmail OAuth is not configured", { status: 503 });
  }

  await supabase.from("mailbox_sync_state").update({ status: "syncing", last_error: null }).eq("mailbox", MAILBOX);

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(`Google OAuth ${tokenResponse.status}: ${JSON.stringify(tokenData).slice(0, 500)}`);
    }

    const query = encodeURIComponent(`in:inbox newer_than:14d -from:${MAILBOX}`);
    const listing = await gmailFetch(`messages?maxResults=50&q=${query}`, tokenData.access_token);
    const summaries: Array<{ id: string }> = listing.messages || [];
    const fullMessages: GmailMessage[] = [];
    for (const summary of summaries) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("provider", "gmail")
        .eq("provider_message_id", summary.id)
        .maybeSingle();
      if (!existing) fullMessages.push(await gmailFetch(`messages/${summary.id}?format=full`, tokenData.access_token));
    }
    fullMessages.sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0));

    let inserted = 0;
    let skippedAutomated = 0;
    let newestInternalDate = 0;
    for (const message of fullMessages) {
      const headers = headerMap(message.payload?.headers);
      const sender = emailAddress(headers.from);
      if (!sender || sender === MAILBOX) continue;
      const body = messageBody(message.payload).slice(0, 50_000);
      const subject = headers.subject || "(no subject)";
      if (isAutomatedSystemMessage(sender, subject, headers)) {
        skippedAutomated++;
        continue;
      }
      const classification = classifyReply(subject, body);

      let { data: prospect } = await supabase
        .from("prospects")
        .select("id")
        .eq("email_normalized", sender)
        .maybeSingle();
      if (!prospect) {
        const created = await supabase.from("prospects").insert({
          full_name: displayName(headers.from),
          email: sender,
          source: "gmail_reply",
          status: "replied",
          last_inbound_at: new Date(Number(message.internalDate || Date.now())).toISOString(),
        }).select("id").single();
        prospect = created.data;
        if (!prospect && created.error?.code === "23505") {
          const raced = await supabase.from("prospects").select("id").eq("email_normalized", sender).single();
          prospect = raced.data;
        }
      }
      if (!prospect) throw new Error(`Could not resolve prospect for ${sender}`);

      const receivedAt = new Date(Number(message.internalDate || Date.now())).toISOString();
      const { error: insertError } = await supabase.from("messages").insert({
        prospect_id: prospect.id,
        direction: "inbound",
        message_type: "inbound_reply",
        provider: "gmail",
        provider_message_id: message.id,
        provider_thread_id: message.threadId || null,
        header_message_id: headers["message-id"] || null,
        in_reply_to: headers["in-reply-to"] || null,
        reference_headers: headers.references?.split(/\s+/).filter(Boolean) || [],
        from_address: sender,
        to_addresses: addressList(headers.to),
        cc_addresses: addressList(headers.cc),
        subject,
        body_text: body,
        snippet: message.snippet || body.slice(0, 300),
        raw_headers: {
          from: headers.from || null,
          to: headers.to || null,
          cc: headers.cc || null,
          date: headers.date || null,
          auto_submitted: headers["auto-submitted"] || null,
          precedence: headers.precedence || null,
        },
        status: "received",
        classification: classification.classification,
        classification_confidence: classification.confidence,
        decision_reason: classification.reason,
        received_at: receivedAt,
      });
      if (insertError && insertError.code !== "23505") throw insertError;
      if (!insertError) inserted++;
      newestInternalDate = Math.max(newestInternalDate, Number(message.internalDate || 0));
    }

    await supabase.from("mailbox_sync_state").update({
      status: "healthy",
      last_synced_at: new Date().toISOString(),
      last_message_internal_date: newestInternalDate || null,
      last_error: null,
      metadata: { scanned: summaries.length, inserted, skipped_automated: skippedAutomated },
    }).eq("mailbox", MAILBOX);
    await supabase.from("agent_log").insert({
      agent_name: "gmail-reply-ingestion",
      action: "poll_inbox",
      outcome: "completed",
      decision: { mailbox: MAILBOX, scanned: summaries.length, inserted, skipped_automated: skippedAutomated },
    });
    return Response.json({ processed: summaries.length, inserted, skipped_automated: skippedAutomated });
  } catch (error) {
    await supabase.from("mailbox_sync_state").update({
      status: "error",
      last_error: String(error).slice(0, 1000),
    }).eq("mailbox", MAILBOX);
    await supabase.from("agent_log").insert({
      agent_name: "gmail-reply-ingestion",
      action: "poll_inbox",
      outcome: "failed",
      error: String(error).slice(0, 1000),
      decision: { mailbox: MAILBOX },
    });
    return new Response("Gmail ingestion failed", { status: 500 });
  }
});
