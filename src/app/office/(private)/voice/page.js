import { getOfficeDb } from "@/lib/server/office-auth";
import { Card, buttonClass, inputClass, Empty } from "../../office-ui";
import { createVoiceEntry, updateVoiceEntry, deleteVoiceEntry } from "../../actions";

const KIND_NAMES = {
  signature: "Signature", opener: "Opener", phrase: "Phrase", rule: "Rule",
  avoid: "Avoid", fact: "Fact", needs_evidence: "Needs evidence",
};

export default async function VoicePage({ searchParams }) {
  const params = await searchParams;
  const { db } = await getOfficeDb();
  const { data: entries } = await db
    .from("social_voice_entries")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true });

  const rows = entries || [];
  const grouped = Object.keys(KIND_NAMES).map((kind) => ({ kind, entries: rows.filter((e) => e.kind === kind) }));

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && (
        <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
          {params.error ? `The voice entry couldn't be saved (${params.error}).` : (
            params.success === "deleted" ? "Voice entry deleted." : params.success === "updated" ? "Voice entry updated." : "Voice entry created."
          )}
        </p>
      )}

      <div>
        <h2 className="text-3xl font-bold">Voice library</h2>
        <p className="mt-2 max-w-2xl text-slate-400">
          The approved copy Eddie and the morning generator draw from. New or changed copy stays review-only unless you
          toggle it on here; approving voice is not the same as approving a post to publish.
        </p>
      </div>

      <Card title="Add a voice entry">
        <form action={createVoiceEntry} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">Kind
            <select name="kind" className={inputClass} defaultValue="signature">
              {Object.keys(KIND_NAMES).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Label <span className="text-slate-500">(short name shown in the generator)</span>
            <input name="label" className={inputClass} maxLength={120} placeholder="e.g. Direct opener" />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">Body
            <textarea name="body" required rows={3} className={inputClass} placeholder="The exact copy to use." />
          </label>
          <label className="block text-xs text-slate-400">Source <span className="text-slate-500">(where this copy came from)</span>
            <input name="source" className={inputClass} maxLength={200} placeholder="e.g. TEAMTASTIC_OUTREACH_VOICE.md" />
          </label>
          <label className="block text-xs text-slate-400">Sort order
            <input name="sort_order" type="number" className={inputClass} defaultValue={0} />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">Examples <span className="text-slate-500">(one per line)</span>
            <textarea name="examples" rows={2} className={inputClass} placeholder="Where it works / notes" />
          </label>
          <label className="block text-xs text-slate-400">Enable now
            <select name="enabled" className={inputClass} defaultValue="on">
              <option value="on">On</option>
              <option value="off">Off (review only)</option>
            </select>
          </label>
          <div className="sm:col-span-2"><button className={buttonClass}>Add entry</button></div>
        </form>
      </Card>

      {grouped.map(({ kind, entries }) => (
        <Card key={kind} title={`${KIND_NAMES[kind]} (${entries.length})`}>
          {entries.length === 0 && <Empty>{`No ${kind} entries yet.`}</Empty>}
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 ${entry.enabled ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-400"}`}>{entry.enabled ? "enabled" : "review"}</span>
                  {entry.label && <span className="text-slate-300">{entry.label}</span>}
                  {entry.source && <span className="text-slate-500">· {entry.source}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-200">{entry.body}</p>
                {Array.isArray(entry.examples) && entry.examples.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-400">
                    {entry.examples.map((example, index) => <li key={index}>{example}</li>)}
                  </ul>
                )}
                <form action={updateVoiceEntry} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={entry.id} />
                  <label className="block text-xs text-slate-400">Body
                    <input name="body" defaultValue={entry.body} maxLength={2000} className={inputClass + " !w-96"} />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">Enable
                    <select name="enabled" defaultValue={entry.enabled ? "on" : "off"} className={inputClass + " !mt-0 !w-20"}>
                      <option value="on">On</option><option value="off">Off</option>
                    </select>
                  </label>
                  <button className={buttonClass}>Save</button>
                </form>
                <form action={deleteVoiceEntry} className="mt-2">
                  <input type="hidden" name="id" value={entry.id} />
                  <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}