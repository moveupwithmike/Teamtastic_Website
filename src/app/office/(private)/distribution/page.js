import { getOfficeDb } from "@/lib/server/office-auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { Card, buttonClass, inputClass, formatDate } from "../../office-ui";
import { platformStatus } from "@/lib/server/office/social-publishers";
import { SOCIAL_FORMATS, SOCIAL_OBJECTIVES, SOCIAL_PLATFORMS } from "@/lib/server/office/social-shared";
import { buildVoiceContext } from "@/lib/server/office/social-voice";
import {
  createSocialItem, reviseSocialItem, approveSocialItem, rejectSocialItem,
  scheduleSocialItem, rescheduleSocialItem, pauseScheduledSocialItem,
  publishSocialItem, retrySocialPublish, runMorningGenerator,
  refreshSocialMeasurement, queueSocialVideoRender,
} from "../../actions";
import SocialMediaField from "./social-media-field";

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400";
const STATUS_TONE = { draft: "text-slate-300", approved: "text-sky-300", scheduled: "text-amber-300", paused: "text-amber-300", publish_failed: "text-red-300", published: "text-emerald-300", rejected: "text-slate-400" };

async function signedMedia(item) {
  if (!Array.isArray(item.media) || !item.media.length) return [];
  const storage = getSupabaseAdmin().storage.from("distribution-media");
  const urls = [];
  for (const m of item.media.slice(0, 4)) {
    try {
      const { data, error } = await storage.createSignedUrl(m.path, 3600);
      if (!error && data?.signedUrl) urls.push({ ...m, url: data.signedUrl });
    } catch { /* storage not available; fall back to showing path only */ }
  }
  return urls;
}

function StatusBadge({ item }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide ${STATUS_TONE[item.status] || "text-slate-300"}`}>{item.status}</span>;
}

function isPastDue(value) {
  return Boolean(value) && new Date(value).getTime() <= Date.now();
}

export default async function DistributionPage({ searchParams }) {
  const params = await searchParams;
  const { db } = await getOfficeDb();

  const [itemsResult, accountsResult, eventsResult, configResult, voiceResult, rendersResult] = await Promise.all([
    db.from("distribution_items").select("*").neq("status", "archived").order("created_at", { ascending: false }).limit(100),
    db.from("social_accounts").select("*").order("platform", { ascending: true }),
    db.from("distribution_item_events").select("distribution_item_id,action,status_before,status_after,actor,created_at").order("created_at", { ascending: false }).limit(30),
    db.from("system_config").select("social_master_enabled,linkedin_write_enabled,instagram_write_enabled,facebook_write_enabled,x_write_enabled").eq("id", true).maybeSingle(),
    buildVoiceContext(db),
    db.from("social_video_renders").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const items = itemsResult.data || [];
  const accounts = accountsResult.data || [];
  const config = configResult.data || {};
  const events = eventsResult.data || [];
  const renders = rendersResult.data || [];
  const eventsByItem = {};
  for (const event of events) (eventsByItem[event.distribution_item_id] ||= []).push(event);
  const latestRenderByItem = {};
  for (const render of renders) {
    if (!latestRenderByItem[render.item_id]) latestRenderByItem[render.item_id] = render;
  }
  const signatures = voiceResult.signatures;

  const measured = items.filter((item) => item.utm_content);
  const totals = measured.reduce((acc, item) => ({
    visitors: acc.visitors + (item.visitors || 0),
    engaged: acc.engaged + (item.engaged || 0),
    leads: acc.leads + (item.leads || 0),
  }), { visitors: 0, engaged: 0, leads: 0 });

  const itemsWithMedia = await Promise.all(items.map(async (item) => ({ item, media: await signedMedia(item) })));
  const statusCounts = {};
  for (const { item } of itemsWithMedia) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

  const effectiveControls = (channel) => {
    const account = accounts.find((a) => a.platform === channel && a.status === "connected");
    return platformStatus({ platform: channel, account, config });
  };

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && (
        <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
          {params.error ? `The action couldn't be completed (${params.error}). The item stayed where it was — review it before trying again.` : (
            typeof params.success === "string" && params.success.startsWith("proposed:")
              ? `Morning generator proposed ${params.success.split(":")[1]} review-only draft${params.success.split(":")[1] === "1" ? "" : "s"}. Nothing is approved or published until you review them.`
              : typeof params.success === "string" && params.success.startsWith("already-generated:")
                ? `Eddie already prepared today's ${params.success.split(":")[1]} review-only social draft${params.success.split(":")[1] === "1" ? "" : "s"}. The retry created nothing extra.`
              : params.success === "measured"
                ? "Measurement refreshed — clicks, engagement, and leads rolled up from today's first-party funnel events."
              : params.success === "rendered:queued"
                ? "Render queued. The post is unchanged — the produced video attaches as media once the renderer finishes."
              : "Social desk updated."
          )}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Social desk</h2>
          <p className="mt-2 text-slate-400">Owned and approved social content with tracked links. Nothing publishes until you approve the exact content, and automation stays off until you turn it on.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runMorningGenerator}><button className={`${buttonClass} bg-white/10 hover:bg-white/15`}>Propose today&apos;s post drafts</button></form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card title="Drafts" tone="purple"><p className="text-3xl font-bold text-purple-300">{statusCounts.draft || 0}</p></Card>
        <Card title="Approved / scheduled" tone="green"><p className="text-3xl font-bold text-sky-300">{(statusCounts.approved || 0) + (statusCounts.scheduled || 0) + (statusCounts.paused || 0)}</p></Card>
        <Card title="Published" tone="green"><p className="text-3xl font-bold text-emerald-300">{statusCounts.published || 0}</p></Card>
        <Card title="Failed publishes" tone="red"><p className="text-3xl font-bold text-red-300">{statusCounts.publish_failed || 0}</p></Card>
      </div>

      <Card title="Measurement">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-xs text-slate-500">Lifetime clicks, engagement, and leads from first-party funnel events, matched to each post by its tracked link (utm_content). Refresh pulls in the latest full day; totals are recomputed from every stored snapshot.</p>
          <form action={refreshSocialMeasurement}><button className={buttonClass}>Refresh counts for today</button></form>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-3">Post</th>
                <th className="px-3 py-1">Platform</th>
                <th className="px-3 py-1">Status</th>
                <th className="px-3 py-1 text-right">Clicks</th>
                <th className="px-3 py-1 text-right">Engaged</th>
                <th className="px-3 py-1 text-right">Leads</th>
                <th className="px-3 py-1 text-right">Lead rate</th>
              </tr>
            </thead>
            <tbody>
              {measured.map((item) => {
                const rate = item.visitors > 0 ? Math.round((100 * (item.leads || 0)) / item.visitors) : null;
                return (
                  <tr key={item.id} className="border-t border-white/5 text-slate-300">
                    <td className="max-w-xs truncate py-2 pr-3 text-slate-200">{item.title}</td>
                    <td className="px-3 py-2">{item.channel}</td>
                    <td className="px-3 py-2"><StatusBadge item={item} /></td>
                    <td className="px-3 py-2 text-right">{item.visitors || 0}</td>
                    <td className="px-3 py-2 text-right">{item.engaged || 0}</td>
                    <td className="px-3 py-2 text-right">{item.leads || 0}</td>
                    <td className="px-3 py-2 text-right">{rate === null ? "—" : `${rate}%`}</td>
                  </tr>
                );
              })}
              {!measured.length && (
                <tr className="border-t border-white/5"><td colSpan={7} className="py-2 text-xs text-slate-500">No tracked posts yet — refresh once a post is live.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 font-semibold text-slate-100">
                <td className="py-2 pr-3">Totals</td>
                <td colSpan={2}></td>
                <td className="px-3 py-2 text-right">{totals.visitors}</td>
                <td className="px-3 py-2 text-right">{totals.engaged}</td>
                <td className="px-3 py-2 text-right">{totals.leads}</td>
                <td className="px-3 py-2 text-right">{totals.visitors > 0 ? `${Math.round((100 * totals.leads) / totals.visitors)}%` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="New post">
        <form action={createSocialItem} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">Channel
            <select name="channel" className={SELECT_CLASS} defaultValue="linkedin">
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Account
            <select name="platform_account_id" className={SELECT_CLASS}>
              <option value="">No account linked (manual copy-and-post)</option>
              {accounts.filter((a) => a.status !== "revoked").map((a) => (
                <option key={a.id} value={a.id}>{a.platform} · {a.account_name}{a.requires_manual_post ? " (manual)" : ""}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Title
            <input name="title" required maxLength={200} className={inputClass} placeholder="What is this about?" />
          </label>
          <label className="block text-xs text-slate-400">Format
            <select name="format" className={SELECT_CLASS} defaultValue="text">
              {SOCIAL_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Target page (path, e.g. /team-building/corporate)
            <input name="target_page" required className={inputClass} placeholder="/teambuilding-london" />
          </label>
          <label className="block text-xs text-slate-400">Content objective
            <select name="content_objective" className={SELECT_CLASS}>
              <option value="">None</option>
              {SOCIAL_OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Funnel stage
            <input name="funnel_stage" className={inputClass} placeholder="e.g. consideration" maxLength={100} />
          </label>
          <label className="block text-xs text-slate-400">Destination (overrides account default)
            <input name="destination" className={inputClass} maxLength={200} />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">Hook <span className="text-slate-500">(first line — what stops the scroll)</span>
            <input name="hook" className={inputClass} maxLength={400} />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">Caption
            <textarea name="caption" rows={5} className={inputClass} placeholder="The body of the post. Plain text — links are tracked automatically." />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">Call to action
            <input name="cta" className={inputClass} maxLength={400} />
          </label>
          <div className="sm:col-span-2">
            <span className="block text-xs text-slate-400">Media</span>
            <SocialMediaField />
          </div>
          <label className="block text-xs text-slate-400">Publish mode
            <select name="publish_mode" className={SELECT_CLASS}>
              <option value="now">Sit as a draft until I approve</option>
              <option value="scheduled">Plan to schedule after approval</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">Planned time (Eastern)
            <input name="scheduled_for" type="datetime-local" className={inputClass} />
          </label>
          <div className="sm:col-span-2"><button className={buttonClass}>Create post</button></div>
        </form>
      </Card>

      {signatures.length > 0 && (
        <Card title="Voice signatures to keep in mind">
          <div className="flex flex-wrap gap-2 text-xs">
            {signatures.map((s) => <span key={s.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">{s.body}</span>)}
          </div>
        </Card>
      )}

      <div className="space-y-5">
        {itemsWithMedia.map(({ item, media }) => {
          const isManual = item.requires_manual_post || item.channel === "reddit" || effectiveControls(item.channel).ready === false;
          const due = item.status === "scheduled" && isPastDue(item.scheduled_for);
          const ready = item.status === "approved" || item.status === "publish_failed" || due;
          const itemEvents = eventsByItem[item.id] || [];
          return (
            <Card key={item.id} title={`${item.channel} · ${item.title}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <StatusBadge item={item} />
                <span>·</span><span>{item.format || "text"}</span>
                {item.objective && <><span>·</span><span>{item.objective}</span></>}
                {item.funnel_stage && <><span>·</span><span>{item.funnel_stage}</span></>}
                {item.published_at ? <><span>·</span><span>published {formatDate(item.published_at)}</span></> : null}
                {item.provider_post_id ? <><span>·</span><span>provider {item.provider_post_id}</span></> : null}
                {latestRenderByItem[item.id] && <><span>·</span><span className="text-amber-300/80">render {latestRenderByItem[item.id].status}</span></>}
                {(item.visitors || item.leads) ? <><span>·</span><span>{item.visitors || 0} clicks · {item.leads || 0} leads</span></> : null}
              </div>

              <div className="space-y-2 text-sm">
                {item.hook && <p className="text-slate-200">{item.hook}</p>}
                {(item.caption || item.body_text) && <p className="whitespace-pre-wrap text-slate-300">{item.caption || item.body_text}</p>}
                {item.cta && <p className="text-slate-400">{item.cta}</p>}
                <p className="text-xs text-slate-500">Costs 1 visitor per click · leads tracked automatically</p>
              </div>

              {media.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {media.map((m) => (
                    m.kind === "image"
                      ? <img key={m.path} src={m.url} alt="attached" className="h-28 rounded-lg border border-white/10 object-cover" />
                      : <a key={m.path} href={m.url} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:border-purple-400">{m.kind} · {m.path.split("/").pop()}</a>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-2">
                <label className="block text-xs text-slate-500">Tracked destination
                  <input readOnly value={item.tracked_url || "—"} className={inputClass + " opacity-70"} />
                </label>
                {item.scheduled_for && <p className="text-xs text-slate-400">Scheduled for {formatDate(item.scheduled_for)} (Eastern).</p>}
                {item.last_error && <p className="text-xs text-red-300">Last error: {item.last_error}</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {item.format === "video" && !latestRenderByItem[item.id] && (
                  <form action={queueSocialVideoRender}><input type="hidden" name="id" value={item.id} /><button className="rounded-lg border border-white/10 px-3 py-2 text-sm">Queue render</button></form>
                )}
                {item.status === "draft" && (
                  <>
                    <form action={approveSocialItem}><input type="hidden" name="id" value={item.id} /><button className={buttonClass}>Approve exact content</button></form>
                    <form action={rejectSocialItem}><input type="hidden" name="id" value={item.id} /><button className="rounded-lg border border-white/10 px-4 py-2 text-sm">Reject</button></form>
                    <form action={reviseSocialItem} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input name="caption" defaultValue={item.caption || item.body_text} className={inputClass + " !w-72"} placeholder="Caption…" />
                      <button className="rounded-lg border border-white/10 px-3 py-2 text-xs">Save caption</button>
                    </form>
                  </>
                )}
                {item.status === "approved" && (
                  <>
                    {isManual
                      ? <form action={publishSocialItem} className="flex items-end gap-2"><input type="hidden" name="id" value={item.id} /><input name="published_url" type="url" placeholder="Paste the post URL after posting manually…" className={inputClass + " !w-80"} /><button className={buttonClass}>I posted it</button></form>
                      : <form action={publishSocialItem}><input type="hidden" name="id" value={item.id} /><button className={buttonClass}>Publish now</button></form>}
                    <form action={scheduleSocialItem} className="flex items-center gap-2"><input type="hidden" name="id" value={item.id} /><input name="scheduled_for" type="datetime-local" className={inputClass + " !w-56"} /><button className="rounded-lg border border-white/10 px-3 py-2 text-sm">Schedule</button></form>
                  </>
                )}
                {item.status === "scheduled" && (
                  <>
                    {ready
                      ? (isManual
                          ? <form action={publishSocialItem} className="flex items-end gap-2"><input type="hidden" name="id" value={item.id} /><input name="published_url" type="url" placeholder="Paste the post URL after posting manually…" className={inputClass + " !w-80"} /><button className={buttonClass}>I posted it</button></form>
                          : <form action={publishSocialItem}><input type="hidden" name="id" value={item.id} /><button className={buttonClass}>Publish now</button></form>)
                      : <span className="text-xs text-slate-500">Not due yet — unlock on its exact time.</span>}
                    <form action={rescheduleSocialItem} className="flex items-center gap-2"><input type="hidden" name="id" value={item.id} /><input name="scheduled_for" type="datetime-local" className={inputClass + " !w-56"} /><button className="rounded-lg border border-white/10 px-3 py-2 text-sm">Reschedule</button></form>
                    <form action={pauseScheduledSocialItem}><input type="hidden" name="id" value={item.id} /><button className="rounded-lg border border-white/10 px-3 py-2 text-sm">Pause</button></form>
                  </>
                )}
                {item.status === "paused" && (
                  <form action={rescheduleSocialItem} className="flex items-center gap-2"><input type="hidden" name="id" value={item.id} /><input name="scheduled_for" type="datetime-local" className={inputClass + " !w-56"} /><button className={buttonClass}>Re-schedule</button></form>
                )}
                {item.status === "publish_failed" && (
                  <form action={retrySocialPublish}><input type="hidden" name="id" value={item.id} /><button className={buttonClass}>Retry publish</button></form>
                )}
              </div>

              {itemEvents.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-slate-500">History</summary>
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {itemEvents.map((event, index) => (
                      <li key={index}>{event.action} · {event.status_before || "—"} → {event.status_after || "—"} · {event.actor} · {formatDate(event.created_at)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          );
        })}
        {!items.length && <p className="text-sm text-slate-400">No social desk items yet — create your first post above.</p>}
      </div>
    </div>
  );
}
