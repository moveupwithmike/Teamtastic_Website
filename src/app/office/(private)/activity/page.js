import { getOfficeDb } from "@/lib/server/office-auth";
import { Card, Empty, ProspectLink, formatDate } from "../../office-ui";
import { mergeActivityTimeline } from "@/lib/server/office/activity-feed";

export default async function ActivityFeedPage() {
  const db = (await getOfficeDb()).db;
  // This force-dynamic server page measures activity age at request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [agentLogResult, sourceRunsResult, scoreHistoryResult] = await Promise.all([
    db.from("agent_log").select("id,agent_name,action,outcome,decision,error,created_at,prospect_id,run_id")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    db.from("source_runs").select("id,run_type,provider,status,records_scanned,records_created,records_updated,decision,error,started_at,completed_at,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    db.from("prospect_score_history").select("prospect_id,score,reasons,scoring_version,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(100),
  ]);
  const timeline = mergeActivityTimeline(
    agentLogResult.data || [],
    sourceRunsResult.data || [],
    scoreHistoryResult.data || [],
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Overnight activity</h2>
        <p className="mt-2 text-slate-400">
          Everything the research → scoring → drafting pipeline actually did in the last 24 hours, read-only —
          the raw trail behind the readiness signal.
        </p>
      </div>
      <Card title="Timeline" count={timeline.length} tone={timeline.length ? "purple" : "green"}>
        <div className="space-y-3">
          {timeline.map((entry) => (
            <div key={entry.id} className={`rounded-2xl border p-4 ${entry.tone}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm">{entry.summary}</p>
                <span className="whitespace-nowrap text-xs text-slate-400">{formatDate(entry.timestamp)}</span>
              </div>
              {entry.prospectId && (
                <div className="mt-2">
                  <ProspectLink id={entry.prospectId} />
                </div>
              )}
              {entry.detail && <p className="mt-2 text-xs text-slate-500">{entry.detail}</p>}
            </div>
          ))}
          {!timeline.length && <Empty>No agent or pipeline activity in the last 24 hours.</Empty>}
        </div>
      </Card>
    </div>
  );
}
