import "server-only";

import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const VOICE_KINDS = [
  "signature", "opener", "phrase", "rule", "avoid", "fact", "needs_evidence",
];

// Loads the enabled, approved voice library grouped by kind. Entries carry
// { id, label, body, examples, source } so both the Office voice page and the
// generators can cite what they used. Fail-open to empty groups: voice is an
// enhancement, never a blocker for the office.
export async function buildVoiceContext(db = getSupabaseAdmin()) {
  const { data, error } = await db.from("social_voice_entries")
    .select("id,kind,label,body,examples,source,sort_order")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  const entries = error ? [] : (data || []);
  const pick = (kind) => entries
    .filter((entry) => entry.kind === kind)
    .map(({ id, label, body, examples, source }) => ({ id, label, body, examples, source }));
  return {
    signatures: pick("signature"),
    openers: pick("opener"),
    phrases: pick("phrase"),
    avoid: pick("avoid"),
    rules: pick("rule"),
    facts: pick("fact"),
    needs_evidence: pick("needs_evidence"),
  };
}