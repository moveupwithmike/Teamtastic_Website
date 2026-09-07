import "server-only";

import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function buildVoiceContext(db = getSupabaseAdmin()) {
  const { data, error } = await db.from("social_voice_entries")
    .select("kind,label,body,examples,source")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) return { signatures: [], phrases: [], avoid: [], rules: [], facts: [], needs_evidence: [] };
  const pick = (kind) => data.filter((entry) => entry.kind === kind).map(({ label, body, examples, source }) => ({ label, body, examples, source }));
  return {
    signatures: pick("signature"),
    phrases: pick("phrase"),
    avoid: pick("avoid"),
    rules: pick("rule"),
    facts: pick("fact"),
    needs_evidence: pick("needs_evidence"),
  };
}