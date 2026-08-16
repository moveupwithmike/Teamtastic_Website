import { getOfficeDb } from "@/lib/server/office-auth";
import { officeErrorMessage } from "@/lib/server/office-errors";
import { Card, inputClass, buttonClass } from "../../office-ui";
import { updateSystemConfig } from "../../actions";

export default async function OfficeSettings({ searchParams }) {
  const params = await searchParams;
  const db = (await getOfficeDb()).db;
  const { data: config } = await db
    .from("system_config")
    .select("prospecting_from_email,prospecting_enabled,outbound_auto_paused,daily_prospecting_cap,sequence_followups_enabled,proposal_email_enabled,daily_proposal_cap,organic_research_enabled,organic_scoring_enabled,organic_drafting_enabled,organic_attribution_enabled,organic_daily_opportunity_cap,organic_min_draft_score,organic_reddit_commercial_approval_confirmed")
    .eq("id", true)
    .single();

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{params.error ? officeErrorMessage(params.error) : "Saved."}</p>}
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
          <input type="hidden" name="settings_scope" value="prospecting" />
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

      <Card title="Proposal email">
        <form action={updateSystemConfig} className="space-y-4">
          <input type="hidden" name="settings_scope" value="proposal" />
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="proposal_email_enabled" defaultChecked={config?.proposal_email_enabled} className="h-4 w-4" />
            Proposal sending enabled
          </label>
          <label className="block text-sm">
            Daily proposal cap
            <input name="daily_proposal_cap" type="number" min="0" max="50" defaultValue={config?.daily_proposal_cap ?? 10} className={inputClass} />
          </label>
          <p className="text-xs text-slate-500">Proposal emails are human-approved, suppression-checked, and counted separately from cold outreach.</p>
          {!config?.proposal_email_enabled && <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">Proposal drafts can be edited, but sending is currently disabled.</p>}
          <button className={buttonClass}>Save proposal settings</button>
        </form>
      </Card>

      <Card title="Organic intent radar">
        <form action={updateSystemConfig} className="space-y-4">
          <input type="hidden" name="settings_scope" value="organic" />
          <p className="rounded-lg bg-sky-500/10 p-3 text-sm text-sky-200">These switches control research, scoring, drafts, and measurement. Publishing remains manual even when every switch is on.</p>
          <label className="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm"><input type="checkbox" name="organic_reddit_commercial_approval_confirmed" defaultChecked={config?.organic_reddit_commercial_approval_confirmed} className="mt-0.5 h-4 w-4" /><span><strong className="block text-amber-200">Reddit commercial data-use approval confirmed</strong>Enable only after Reddit has granted Teamtastic written permission and the required commercial contract is active.</span></label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="organic_research_enabled" defaultChecked={config?.organic_research_enabled} disabled={!config?.organic_reddit_commercial_approval_confirmed} className="h-4 w-4" />Automated public-source research</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="organic_scoring_enabled" defaultChecked={config?.organic_scoring_enabled} className="h-4 w-4" />Automatic intent scoring</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="organic_drafting_enabled" defaultChecked={config?.organic_drafting_enabled} className="h-4 w-4" />Automatic response drafting</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="organic_attribution_enabled" defaultChecked={config?.organic_attribution_enabled} className="h-4 w-4" />Lead and revenue attribution</label>
          <label className="block text-sm">Daily opportunity cap<input name="organic_daily_opportunity_cap" type="number" min="0" max="250" defaultValue={config?.organic_daily_opportunity_cap ?? 25} className={inputClass}/></label>
          <label className="block text-sm">Minimum score for a draft<input name="organic_min_draft_score" type="number" min="0" max="100" defaultValue={config?.organic_min_draft_score ?? 80} className={inputClass}/></label>
          <button className={buttonClass}>Save radar settings</button>
        </form>
      </Card>
    </div>
  );
}
