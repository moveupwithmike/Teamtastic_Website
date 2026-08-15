do $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'organic-opportunity-collection';
  if job_id is not null then perform cron.alter_job(job_id := job_id, active := true); end if;
end $$;
