-- Make automation.score_prospect the only implementation of prospect scoring.
-- The Edge Function now orchestrates candidates and calls this RPC instead of
-- maintaining a second copy of the scoring formula.

alter table public.prospect_score_history
  add column if not exists scoring_version text not null default 'phase3-v1';

create or replace function automation.score_prospect(p_prospect_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prospect_record public.prospects%rowtype;
  company_record public.companies%rowtype;
  company_points numeric(7,3) := 0;
  role_points numeric(7,3) := 0;
  signal_points numeric(7,3) := 0;
  intent_points numeric(7,3) := 0;
  total_points numeric(7,3);
  strongest_signal numeric(4,3) := 0;
  intent_text text;
  reasons jsonb := '[]'::jsonb;
  qualification_threshold numeric(7,3);
  scoring_version constant text := 'phase3-v1';
begin
  select * into prospect_record
  from public.prospects
  where id = p_prospect_id;

  if prospect_record.id is null then
    return jsonb_build_object('scored', false, 'reason', 'prospect_not_found');
  end if;

  if prospect_record.email_normalized is null then
    return jsonb_build_object('scored', false, 'reason', 'missing_email');
  end if;

  if prospect_record.status in ('suppressed', 'not_interested', 'converted', 'disqualified')
     or exists (
       select 1
       from public.suppression_list s
       where s.email_normalized = prospect_record.email_normalized
     ) then
    return jsonb_build_object('scored', false, 'reason', 'ineligible_status_or_suppression');
  end if;

  select coalesce(phase3_minimum_score, 65)
  into qualification_threshold
  from public.system_config
  where id = true;
  qualification_threshold := coalesce(qualification_threshold, 65);

  if prospect_record.company_id is not null then
    select * into company_record
    from public.companies
    where id = prospect_record.company_id;
  end if;

  if company_record.id is not null then
    if company_record.employee_count between 25 and 2000 then company_points := company_points + 20; end if;
    if company_record.domain is not null then company_points := company_points + 5; end if;
    if company_record.industry is not null then company_points := company_points + 5; end if;
    if company_record.lifecycle_stage in ('prospect', 'qualified', 'opportunity') then company_points := company_points + 5; end if;
  end if;

  if coalesce(prospect_record.job_title, '') ~* '(chief people|people operations|human resources|employee experience|culture|events?|office manager|workplace|executive assistant|chief of staff)' then
    role_points := 25;
  elsif coalesce(prospect_record.job_title, '') ~* '(director|head|vice president|vp|manager|founder|owner|president|coordinator)' then
    role_points := 15;
  elsif prospect_record.job_title is not null then
    role_points := 5;
  end if;

  if company_record.id is not null then
    select coalesce(max(s.strength), 0)
    into strongest_signal
    from public.signals s
    where s.company_id = company_record.id
      and (s.expires_at is null or s.expires_at > now());
  end if;
  signal_points := round((strongest_signal * 30)::numeric, 3);

  intent_text := prospect_record.metadata ->> 'posthog_intent_score';
  if intent_text ~ '^[0-9]+([.][0-9]+)?$' then
    intent_points := least(10, greatest(0, intent_text::numeric));
  end if;

  total_points := least(100, company_points + role_points + signal_points + intent_points);
  reasons := jsonb_build_array(
    jsonb_build_object('component', 'company_fit', 'points', company_points),
    jsonb_build_object('component', 'role_fit', 'points', role_points),
    jsonb_build_object('component', 'signal_fit', 'points', signal_points, 'strongest_signal', strongest_signal),
    jsonb_build_object('component', 'intent_fit', 'points', intent_points)
  );

  update public.prospects
  set score = total_points,
      score_reasons = reasons,
      status = case
        when total_points >= qualification_threshold and status in ('new', 'researching') then 'qualified'
        else status
      end
  where id = prospect_record.id;

  insert into public.prospect_score_history(
    prospect_id, score, company_fit, role_fit, signal_fit, intent_fit, reasons, scoring_version
  ) values (
    prospect_record.id, total_points, company_points, role_points, signal_points,
    intent_points, reasons, scoring_version
  );

  return jsonb_build_object(
    'scored', true,
    'score', total_points,
    'company_fit', company_points,
    'role_fit', role_points,
    'signal_fit', signal_points,
    'intent_fit', intent_points,
    'qualification_threshold', qualification_threshold,
    'scoring_version', scoring_version,
    'reasons', reasons
  );
end;
$$;

revoke all on function automation.score_prospect(uuid) from public, anon, authenticated;
grant execute on function automation.score_prospect(uuid) to service_role;
