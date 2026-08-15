create or replace function automation.capture_organic_lead_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare opportunity_record public.organic_opportunities;
declare attribution_enabled boolean;
begin
  select organic_attribution_enabled into attribution_enabled from public.system_config where id = true;
  if not coalesce(attribution_enabled, false) or new.utm_source <> 'organic_intent' then return new; end if;
  begin
    select * into opportunity_record from public.organic_opportunities where tracking_token = new.utm_content::uuid;
  exception when invalid_text_representation then return new;
  end;
  if opportunity_record.id is null then return new; end if;
  insert into public.organic_attribution(opportunity_id, lead_id, prospect_id, touch_type, landing_page, utm_source, utm_medium, utm_campaign, utm_content, fingerprint)
  values(opportunity_record.id, new.id, new.prospect_id, 'lead', new.landing_page, new.utm_source, new.utm_medium, new.utm_campaign, new.utm_content, opportunity_record.id::text || '|lead|' || new.id::text)
  on conflict (fingerprint) do update set prospect_id = excluded.prospect_id;
  update public.organic_opportunities set status = 'converted', updated_at = now() where id = opportunity_record.id;
  return new;
end;
$$;

drop trigger if exists leads_capture_organic_attribution on public.leads;
create trigger leads_capture_organic_attribution after insert or update of prospect_id, utm_source, utm_content on public.leads for each row execute function automation.capture_organic_lead_attribution();
revoke all on function automation.capture_organic_lead_attribution() from public, anon, authenticated;

create or replace function automation.trigger_organic_opportunity_collection()
returns void language plpgsql security invoker set search_path = '' as $$
declare function_url text; webhook_secret text;
begin
  select decrypted_secret into function_url from vault.decrypted_secrets where name = 'organic_collector_function_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'organic_collector_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(url := function_url, headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret), body := '{}'::jsonb, timeout_milliseconds := 30000);
  end if;
end;
$$;
revoke all on function automation.trigger_organic_opportunity_collection() from public, anon, authenticated;

do $$
declare job_id bigint;
begin
  perform cron.schedule('organic-opportunity-collection', '17 */4 * * *', 'select automation.trigger_organic_opportunity_collection();');
  select jobid into job_id from cron.job where jobname = 'organic-opportunity-collection';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
