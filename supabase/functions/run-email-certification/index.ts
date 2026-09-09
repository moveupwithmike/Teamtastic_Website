import { sendViaResend } from "../_shared/email.ts";
import { authorizeServiceRole, serviceClient } from "../_shared/runtime.ts";

type Dependencies = {
  authorizeServiceRole: typeof authorizeServiceRole;
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  serviceClient: typeof serviceClient;
  sendViaResend: typeof sendViaResend;
};

function address(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value;
}

export function createEmailCertificationHandler(
  overrides: Partial<Dependencies> = {},
) {
  const dependencies: Dependencies = {
    authorizeServiceRole,
    env: (name) => Deno.env.get(name),
    fetch,
    serviceClient,
    sendViaResend,
    ...overrides,
  };

  return async (request: Request) => {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!(await dependencies.authorizeServiceRole(request))) {
      return new Response("Service role required", { status: 403 });
    }

    const { certificationId, executionId } = await request.json();
    if (
      !/^[0-9a-f-]{36}$/i.test(certificationId || "") ||
      !String(executionId || "").trim()
    ) {
      return Response.json({
        sent: false,
        reason: "invalid_certification_request",
      }, { status: 400 });
    }

    const recipient = dependencies.env("INTERNAL_NOTIFICATION_EMAIL")?.trim();
    const from = dependencies.env("RESEND_FROM_EMAIL")?.trim();
    const apiKey = dependencies.env("RESEND_API_KEY");
    if (!recipient || !from || !apiKey) {
      return Response.json({
        sent: false,
        reason: "certification_email_configuration_missing",
      }, { status: 503 });
    }
    const recipientDomain = recipient.split("@")[1]?.toLowerCase();
    if (
      !["tryteamtastic.com", "teamtastic.com", "teamtastic.events"].includes(
        recipientDomain,
      )
    ) {
      return Response.json({
        sent: false,
        reason: "controlled_recipient_required",
      }, { status: 409 });
    }

    const senderDomain = address(from).split("@")[1]?.toLowerCase();
    const domainResponse = await dependencies.fetch(
      "https://api.resend.com/domains",
      {
        headers: { Authorization: ["Bearer", apiKey].join(" ") },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const domainPayload = await domainResponse.json().catch(() => ({}));
    const domain = Array.isArray(domainPayload?.data)
      ? domainPayload.data.find((item: Record<string, unknown>) =>
        item.name === senderDomain
      )
      : null;
    if (!domainResponse.ok || !domain || domain.status !== "verified") {
      return Response.json({
        sent: false,
        reason: "production_sender_domain_unverified",
        senderDomain,
        providerStatus: domain?.status || null,
      }, { status: 409 });
    }

    const supabase = dependencies.serviceClient();
    const { data: certification } = await supabase.from(
      "final_production_certifications",
    )
      .select("id,status").eq("id", certificationId).in("status", [
        "running",
        "ready_for_signoff",
      ]).maybeSingle();
    if (!certification) {
      return Response.json(
        { sent: false, reason: "certification_not_active" },
        { status: 409 },
      );
    }

    const result = await dependencies.sendViaResend(supabase, {
      messageType: "internal_notification",
      recipient,
      to: recipient,
      from,
      subject: `Teamtastic production certification ${
        certificationId.slice(0, 8)
      }`,
      text:
        `Controlled production certification message.\nCertification: ${certificationId}\nExecution: ${executionId}`,
      idempotencyKey: executionId,
    });
    if (!result.sent || !result.providerMessageId) {
      return Response.json({
        ...result,
        senderDomain,
        providerStatus: domain.status,
      }, { status: 502 });
    }

    const { error } = await supabase.rpc("record_email_delivery_evidence", {
      p_provider_message_id: result.providerMessageId,
      p_evidence_stage: "api_accepted",
      p_evidence_source: "resend_api",
      p_source_event_id: executionId,
      p_evidence_reference: `resend://message/${result.providerMessageId}`,
      p_recorded_by: "edge:run-email-certification",
      p_metadata: {
        certification_id: certificationId,
        execution_id: executionId,
        sender_identity: from,
        sender_domain: senderDomain,
        recipient_classification: "teamtastic_owned_test_mailbox",
        provider_acceptance_result: "accepted",
        provider_http_status: result.status,
      },
    });
    if (error) {
      return Response.json(
        { sent: true, reason: "acceptance_evidence_failed" },
        { status: 500 },
      );
    }

    return Response.json({
      sent: true,
      providerMessageId: result.providerMessageId,
      senderDomain,
      providerDomainId: domain.id,
      providerStatus: domain.status,
      providerRegion: domain.region || null,
      executionId,
    });
  };
}

if (import.meta.main) Deno.serve(createEmailCertificationHandler());

