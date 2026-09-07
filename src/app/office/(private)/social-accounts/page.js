import { getOfficeDb } from "@/lib/server/office-auth";
import { Card, buttonClass, inputClass } from "../../office-ui";
import { platformStatus } from "@/lib/server/office/social-publishers";
import { SOCIAL_PLATFORMS } from "@/lib/server/office/social-shared";
import { createSocialAccount, updateSocialAccount, updateSocialConfig } from "../../actions";

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400";

export default async function SocialAccountsPage({ searchParams }) {
  const params = await searchParams;
  const { db } = await getOfficeDb();
  const [accountsResult, configResult] = await Promise.all([
    db.from("social_accounts").select("*").order("platform", { ascending: true }).order("created_at", { ascending: true }),
    db.from("system_config").select("social_master_enabled,linkedin_write_enabled,instagram_write_enabled,facebook_write_enabled,x_write_enabled").eq("id", true).maybeSingle(),
  ]);
  const accounts = accountsResult.data || [];
  const config = configResult.data || {};

  const switches = [
    ["social_master_enabled", "Social desk master switch — gate for every automated Social Desk action"],
    ["linkedin_write_enabled", "LinkedIn write permission"],
    ["instagram_write_enabled", "Instagram write permission"],
    ["facebook_write_enabled", "Facebook write permission"],
    ["x_write_enabled", "X write permission"],
  ];

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && (
        <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
          {params.error ? `The account action couldn't be completed (${params.error}).` : "Account settings saved."}
        </p>
      )}

      <div>
        <h2 className="text-3xl font-bold">Social accounts</h2>
        <p className="mt-2 text-slate-400">Connectors, write permissions, and brand destinations. Publishing stays off until every gate here is explicitly enabled.</p>
      </div>

      <Card title="Publish gates">
        <form action={updateSocialConfig} className="space-y-3">
          {switches.map(([flag, label]) => (
            <label key={flag} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm">
              <span className="text-slate-300">{label}</span>
              <input type="checkbox" name={flag} defaultChecked={Boolean(config[flag])} className="h-4 w-4 accent-purple-500" />
            </label>
          ))}
          <button className={buttonClass}>Save gates</button>
        </form>
      </Card>

      <Card title="Connected accounts">
        {!accounts.length && <p className="text-sm text-slate-400">No accounts yet. Add your first below.</p>}
        <div className="space-y-4">
          {accounts.map((account) => {
            const status = platformStatus({ platform: account.platform, account, config });
            return (
              <form key={account.id} action={updateSocialAccount} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <input type="hidden" name="id" value={account.id} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{account.platform} · {account.account_name}</p>
                    <p className="text-xs text-slate-400">{account.account_type} · {account.destination} · {account.provider_id}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 font-semibold ${account.status === "connected" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{account.status}</span>
                    {account.credentials?.access_token && <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">token saved</span>}
                    <span className={`rounded-full px-2 py-1 ${status.ready ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-slate-400"}`}>{status.ready ? "ready to publish" : status.reason}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" name="write_enabled" defaultChecked={Boolean(account.write_enabled)} className="h-4 w-4 accent-purple-500" /> Write enabled
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" name="requires_manual_post" defaultChecked={Boolean(account.requires_manual_post)} className="h-4 w-4 accent-purple-500" /> Manual copy-and-post
                  </label>
                  <select name="status" defaultValue={account.status} className={SELECT_CLASS + " !w-40"}>
                    <option value="connected">connected</option>
                    <option value="disconnected">disconnected</option>
                    <option value="revoked">revoked</option>
                  </select>
                  <button className="rounded-lg border border-white/10 px-3 py-2 text-xs">Save account</button>
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card title="Add account">
        <form action={createSocialAccount} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">Platform
            <select name="platform" className={SELECT_CLASS} defaultValue="linkedin">
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Account name
            <input name="account_name" required maxLength={120} className={inputClass} placeholder="Teamtastic LinkedIn company page" />
          </label>
          <label className="block text-xs text-slate-400">Account type
            <select name="account_type" className={SELECT_CLASS}>
              <option value="organization">Organization / company page</option>
              <option value="person">Person</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">Provider ID (page URN number or handle)
            <input name="provider_id" className={inputClass} placeholder="e.g. 1234567 for urn:li:organization:1234567" />
          </label>
          <label className="block text-xs text-slate-400">Destination (brand name used as the link destination)
            <input name="destination" className={inputClass} placeholder="Teamtastic" />
          </label>
          <label className="block text-xs text-slate-400">OAuth access token (only for automated connectors)
            <input name="access_token" className={inputClass} placeholder="Paste LinkedIn access token…" />
          </label>
          <label className="block text-xs text-slate-400">Org URN (for company pages, optional — overrides provider ID)
            <input name="org_urn" className={inputClass} placeholder="urn:li:organization:1234567" />
          </label>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" name="requires_manual_post" defaultChecked className="h-4 w-4 accent-purple-500" /> Manual copy-and-post only (no connector calls)
            </label>
          </div>
          <div className="sm:col-span-2"><button className={buttonClass}>Add account</button></div>
        </form>
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-400">
          <p className="mb-1 font-semibold text-slate-300">How publishing gates work</p>
          <p>An automated publish only runs when: the master switch is on, this platform&apos;s write permission is on, the account is connected with write enabled, and the platform has a real connector (LinkedIn today). Reddit and any account without a token go through the manual copy-and-post flow in Social desk.</p>
        </div>
      </Card>
    </div>
  );
}