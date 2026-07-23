import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { Card, inputClass, buttonClass } from "../../office-ui";
import { updateSystemConfig } from "../../actions";

export default async function OfficeSettings({ searchParams }) {
  const params = await searchParams;
  const db = getSupabaseAdmin();
  const { data: config } = await db
    .from("system_config")
    .select("prospecting_from_email,prospecting_enabled,outbound_auto_paused,daily_prospecting_cap,sequence_followups_enabled")
    .eq("id", true)
    .single();

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{params.error ? `Could not save: ${params.error}` : "Saved."}</p>}
      <div>
        <h2 className="text-3xl font-bold">Outbound settings</h2>
        <p className="mt-2 text-slate-400">Controls for cold outreach sending. Nothing here affects proposals, nurture, or booking emails.</p>
      </div>

      {config?.outbound_auto_paused && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
          Outbound sending was automatically paused after a bounce or complaint rate breach. Investigate before resuming — see the deliverability numbers in the weekly report.
        </div>
      )}

      <Card title="Prospecting">
        <form action={updateSystemConfig} className="space-y-4">
          <label className="block text-sm">
            From address
            <input name="prospecting_from_email" defaultValue={config?.prospecting_from_email || ""} placeholder="Michael at Teamtastic <hello@outreach.tryteamtastic.com>" className={inputClass} />
          </label>
          <p className="text-xs text-slate-500">Use an identity distinct from transactional email (booking confirmations, magic links) with SPF/DKIM/DMARC verified in Resend before enabling prospecting.</p>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="prospecting_enabled" defaultChecked={config?.prospecting_enabled} className="h-4 w-4" />
            Prospecting sending enabled
          </label>

          <label className="block text-sm">
            Daily cap
            <input name="daily_prospecting_cap" type="number" min="0" max="500" defaultValue={config?.daily_prospecting_cap ?? 5} className={inputClass} />
          </label>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="sequence_followups_enabled" defaultChecked={config?.sequence_followups_enabled} className="h-4 w-4" />
            Follow-up sequence enabled (2 automatic follow-ups if no reply)
          </label>

          {config?.outbound_auto_paused && (
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="resume_sending" className="h-4 w-4" />
              Resume sending (clears the automatic pause)
            </label>
          )}

          <button className={buttonClass}>Save settings</button>
        </form>
      </Card>
    </div>
  );
}
