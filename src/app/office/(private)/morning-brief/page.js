import { getOfficeDb } from "@/lib/server/office-auth";
import { Card, Empty, formatDate } from "../../office-ui";

const AUDIO_BUCKET = "daily-report-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function MorningBriefPage() {
  const db = (await getOfficeDb()).db;
  const { data: reports } = await db
    .from("daily_reports")
    .select("report_date,transcript,audio_url,voice_brief_status,voice_brief_error,body_html")
    .order("report_date", { ascending: false })
    .limit(14);

  const rows = reports || [];
  const withSignedUrls = await Promise.all(rows.map(async (row) => {
    if (row.voice_brief_status !== "ready" || !row.audio_url) return { ...row, signedUrl: null };
    const { data } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(row.audio_url, SIGNED_URL_TTL_SECONDS);
    return { ...row, signedUrl: data?.signedUrl || null };
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">Morning brief</h2>
        <p className="mt-2 text-slate-400">
          A spoken, 60-90 second version of the daily sales report, generated after it sends. Optional and
          off by default — see <code>daily_report_voice_brief_enabled</code> in Settings.
        </p>
      </div>
      <Card title="Recent briefs" count={withSignedUrls.length} tone={withSignedUrls.length ? "purple" : "green"}>
        <div className="space-y-4">
          {withSignedUrls.map((row) => (
            <div key={row.report_date} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{formatDate(row.report_date)}</p>
              {row.voice_brief_status === "ready" && row.signedUrl && (
                <>
                  <audio className="mt-3 w-full" controls preload="none" src={row.signedUrl}>
                    Your browser does not support inline audio playback.
                  </audio>
                  {row.transcript && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{row.transcript}</p>}
                </>
              )}
              {row.voice_brief_status === "unavailable" && (
                <p className="mt-3 text-sm text-amber-300">
                  Brief unavailable for this date{row.voice_brief_error ? ` — ${row.voice_brief_error}` : ""}. The full
                  written report still sent normally.
                </p>
              )}
              {(!row.voice_brief_status || row.voice_brief_status === "pending") && (
                <p className="mt-3 text-sm text-slate-500">No voice brief generated for this date.</p>
              )}
            </div>
          ))}
          {!withSignedUrls.length && <Empty>No daily reports on file yet.</Empty>}
        </div>
      </Card>
    </div>
  );
}
