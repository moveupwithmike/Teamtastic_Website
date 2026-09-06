// Extracted from generate-daily-voice-brief/index.ts (pure move, no behavior
// change) so tests can exercise the AI Gateway summary call -- including its
// failure modes -- with a mocked fetch, without triggering Deno.serve() at
// module load. Mirrors the same extraction already done for
// _shared/gmail-classification.ts.

// Haiku-class model via Vercel AI Gateway -- cost/latency fit for a short
// daily summary, mirrors the existing gmail-reply classifier's model choice.
// Re-fetch https://ai-gateway.vercel.sh/v1/models before ever changing this;
// don't assume this id stays current.
export const SUMMARY_MODEL = "anthropic/claude-haiku-4.5";

export const SUMMARY_SYSTEM_PROMPT = `You are Eddie, narrating a 60-90 second spoken morning brief for a small business owner, built entirely from their sales report data below. Open with exactly "Good morning, this is Eddie." as your first sentence, then continue in plain, warm, direct English, second person ("you have..."), as continuous spoken sentences -- no markdown, no headers, no bullet points. State only what is in the data. If a section is empty, missing, or the data looks stale, say so plainly (e.g. "no incidents today") rather than inventing anything. Always include one concise family-demand sentence. The separate Family demand block is authoritative for family metrics because it excludes verified test submissions; ignore older family or total-lead counts in the report summary or HTML if they conflict with it. Mention the 30-day inquiry, requested-date and confirmed-booking counts; mention the strongest occasion or page and near-term requested dates when present. If there are no real family inquiries, say that plainly. If marketing platform data is provided, briefly mention anything notable (e.g. a campaign spending without results); if no marketing platforms are connected yet, say so plainly rather than skipping the topic silently. End with one clear recommended first action if the data suggests one.`;

export function reportDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function generateSummary(
  gatewayKey: string,
  summary: unknown,
  marketingSnapshots: unknown[],
  familyDemand: unknown,
): Promise<string> {
  const marketingSection = marketingSnapshots.length
    ? `Marketing platform snapshots (most recent per platform; only present when connected):\n${JSON.stringify(marketingSnapshots).slice(0, 3000)}`
    : "No marketing platform data is connected yet.";
  const response = await fetch("https://ai-gateway.vercel.sh/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${gatewayKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: 400,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Report summary (structured; fresh 24-hour lead counts replace older counts and exclude tests):\n${JSON.stringify(summary ?? {}).slice(0, 4000)}\n\nFamily demand (real private-party inquiries only; test leads excluded):\n${JSON.stringify(familyDemand).slice(0, 3000)}\n\n${marketingSection}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`AI Gateway summary ${response.status}: ${(await response.text()).slice(0, 500)}`);

  const data = await response.json();
  const textBlock = (data.content || []).find((block: { type?: string }) => block.type === "text");
  const text = textBlock?.text?.trim();
  if (!text) throw new Error("AI Gateway summary returned no text content");
  return text;
}
