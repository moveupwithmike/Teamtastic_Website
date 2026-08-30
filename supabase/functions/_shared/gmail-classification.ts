// Pure inbound-reply classification logic, extracted from ingest-gmail-replies/index.ts
// so it can be unit-tested without triggering that function's top-level Deno.serve()
// (importing index.ts directly would attempt to bind a real HTTP listener at
// module-load time). This mirrors the existing _shared/nurture.ts pattern.

export type Classification = { classification: string; confidence: number; reason: string; method: "regex" | "llm" };

export const FUZZY_CLASSIFICATIONS = ["interested", "not_interested", "referral", "question", "pricing_request", "booking_request", "objection", "not_now", "unknown"] as const;

// These four are compliance/reputation-sensitive (opt-out law, abuse complaints) and are
// simple enough that the regex is already near-certain. They are never routed to the LLM,
// regardless of the gmail_llm_classification_enabled flag.
export function classifyHardStop(text: string): Classification | null {
  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/\b(unsubscribe|remove me|stop emailing|do not (?:email|contact)|opt[ -]?out)\b/)) {
    return { classification: "unsubscribe", confidence: 0.99, reason: "explicit opt-out language", method: "regex" };
  }
  if (has(/\b(attorney|legal counsel|cease and desist|lawsuit|litigation|legal action)\b/)) {
    return { classification: "legal", confidence: 0.97, reason: "legal escalation language", method: "regex" };
  }
  if (has(/\b(spam|reported you|harassment|complaint|never contact)\b/)) {
    return { classification: "complaint", confidence: 0.95, reason: "complaint or spam language", method: "regex" };
  }
  if (has(/\b(out of (?:the )?office|automatic reply|auto(?:matic)? response|away from (?:my )?email|on (?:vacation|leave))\b/)) {
    return { classification: "out_of_office", confidence: 0.96, reason: "automatic absence language", method: "regex" };
  }
  return null;
}

// Fallback used when the LLM is disabled, fails, or returns something outside the
// expected shape. Also the only path when gmail_llm_classification_enabled is false.
export function classifyFuzzyRegex(text: string, body: string): Classification {
  const has = (pattern: RegExp) => pattern.test(text);

  // Order matters: deferred timing beats the generic negative/positive rules below.
  if (has(/\b(next (?:month|quarter|year)|check back(?: with me)?(?: in)?|later (?:this )?year|not (?:right )?now|(?:jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\w*\s+20\d\d)\b/)) {
    return { classification: "not_now", confidence: 0.85, reason: "deferred timing language", method: "regex" };
  }
  if (has(/\b(pricing|quote|rates?|cost)\b.*\?/) || has(/\b(send|share|provide|email|forward)[^.]{0,30}\b(pricing|rates?|quote|cost(?:s)?)\b/) || has(/\b(how much|what'?s (?:the|it|your) (?:cost|price|rate))\b/)) {
    return { classification: "pricing_request", confidence: 0.82, reason: "pricing request language", method: "regex" };
  }
  if (has(/\b(book(?: a| the| our)? (?:call|demo|meeting|event|time)|schedule(?: a| our)? (?:call|demo|meeting|event|time)|availability(?: for| on| in)?|reserve(?: a| the)? date|hold(?: a| the)? date|what dates are (?:you )?available)\b/)) {
    return { classification: "booking_request", confidence: 0.87, reason: "booking or availability request", method: "regex" };
  }
  if (has(/\b(too expensive|over (?:our )?budget|out of (?:our )?budget|don'?t have the budget|no budget|hesitat(?:e|ing)|concerned? about|seems (?:risky|pricey|expensive))\b/)) {
    return { classification: "objection", confidence: 0.84, reason: "objection or hesitation language", method: "regex" };
  }
  if (has(/\b(not interested|no thank(?:s| you)|not a fit|please pass|we(?:'re| are) all set|do not need)\b/)) {
    return { classification: "not_interested", confidence: 0.94, reason: "explicit negative response", method: "regex" };
  }
  if (has(/\b(reach out to|contact|speak with|forwarded (?:this|your email) to|looping in|better person)\b.{0,80}\b(colleague|manager|team|hr|people|events?|them|her|him)\b/)) {
    return { classification: "referral", confidence: 0.86, reason: "referral language", method: "regex" };
  }
  if (has(/\b(interested|sounds (?:good|great)|let(?:'s| us) (?:talk|chat|meet)|available (?:to|for)|tell me more|want(?: to| more)|\byes[,. ]?please)\b/)) {
    return { classification: "interested", confidence: 0.90, reason: "positive buying language", method: "regex" };
  }
  if (body.includes("?") || has(/\b(question(?:s)?|wondering|how|what|when|where|who|can you|could you|would you|programs?|services?|more information)\b/)) {
    return { classification: "question", confidence: 0.82, reason: "question language", method: "regex" };
  }
  return { classification: "unknown", confidence: 0.35, reason: "no high-confidence rule matched", method: "regex" };
}

// The system prompt is a fixed template with no interpolation — inbound email
// content is never concatenated into it. Content only ever appears in the
// `user` message the caller builds separately, and the model's answer is
// forced through LLM_TOOL_SCHEMA's closed enum, so nothing the email body
// says can expand what the model is structurally permitted to return.
export const LLM_SYSTEM_PROMPT = `You classify inbound email replies to cold B2B sales outreach for Teamtastic, a
corporate team-building/event-experiences company. You only ever see messages that already failed
to match unsubscribe/legal/complaint/out-of-office detection, so classify among exactly these nine:

- interested: wants to move forward, hear more, book a call/demo, or get details.
- pricing_request: asks for pricing, quotes, rates, or cost estimates.
- booking_request: asks to book, schedule, or asks about date/time availability.
- objection: raises a concern, hesitation, or budget objection without declining outright.
- not_now: interested later; explicit deferred timing (next quarter, next year, "check back in January").
- not_interested: a soft or implicit decline that isn't a hard opt-out (e.g. "not the right time", "we're set for this year").
- referral: redirects you to a colleague, department (HR/People/Events), or other point of contact.
- question: asks something (logistics, program details) without a clear buy/no-buy signal yet.
- unknown: doesn't clearly fit any of the above, or you're genuinely unsure.

Call the classify_reply tool exactly once with your answer. Be conservative: prefer "unknown" with a
low confidence over guessing when the message is ambiguous, sarcastic, or mostly quoted prior thread text.
When the sender explicitly defers to a later time ("next quarter", "next January"), prefer not_now over
not_interested. When they ask for pricing AND to book, prefer booking_request only if a date/booking is
explicit, otherwise pricing_request.`;

export const LLM_TOOL_SCHEMA = {
  name: "classify_reply",
  description: "Classify an inbound sales-reply email into one fuzzy category.",
  input_schema: {
    type: "object",
    properties: {
      classification: { type: "string", enum: FUZZY_CLASSIFICATIONS as unknown as string[] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string", description: "One short sentence on why." },
    },
    required: ["classification", "confidence", "reason"],
  },
};
