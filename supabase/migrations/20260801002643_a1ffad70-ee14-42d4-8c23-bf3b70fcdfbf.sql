select cron.schedule(
  'sbo-signal-combiner-morning',
  '15 5 * * *',
  $$SELECT private.cron_post('sbo-signal-combiner', '{}'::jsonb) AS request_id;$$
);

select cron.schedule(
  'sbo-signal-combiner-evening',
  '50 23 * * *',
  $$SELECT private.cron_post('sbo-signal-combiner', '{}'::jsonb) AS request_id;$$
);

create or replace view public.v_sbo_automation_daily_check as
with day as (select current_date as d),
capper_run as (
  select max(end_time) as finished_at,
         bool_or(status = 'succeeded') as ok
  from cron.job_run_details, day
  where jobid = 104 and start_time::date = day.d
),
capper_weights as (
  select count(*) as updated_today
  from public.sbo_capper_performance, day
  where updated_at::date = day.d
),
engine_windows as (
  select jrd.start_time
  from cron.job_run_details jrd
  join cron.job j on j.jobid = jrd.jobid, day
  where j.jobid in (23, 24) and jrd.start_time::date = day.d
),
auto_preds as (
  select p.id
  from public.sbo_predictions p, day
  where p.created_at::date = day.d
    and exists (
      select 1 from engine_windows w
      where p.created_at between w.start_time - interval '5 minutes'
                             and w.start_time + interval '45 minutes'
    )
),
auto_signals as (
  select count(*) as n
  from public.sbo_signals s, day
  where s.created_at::date = day.d
    and exists (
      select 1 from engine_windows w
      where s.created_at between w.start_time - interval '5 minutes'
                             and w.start_time + interval '45 minutes'
    )
),
combiner_run as (
  select max(jrd.end_time) as finished_at
  from cron.job_run_details jrd
  join cron.job j on j.jobid = jrd.jobid, day
  where j.jobname like 'sbo-signal-combiner%'
    and jrd.start_time::date = day.d
    and jrd.status = 'succeeded'
)
select
  day.d                                                as check_date,
  coalesce(capper_run.ok, false)                       as a_job104_fired,
  coalesce(capper_weights.updated_today, 0)            as a_weights_updated_today,
  coalesce(capper_run.ok, false)
    and coalesce(capper_weights.updated_today, 0) > 0  as a_pass,
  (select count(*) from auto_preds)                    as b_auto_predictions,
  (select count(*) from auto_preds) > 0                as b_pass,
  auto_signals.n                                       as c_auto_signals,
  auto_signals.n > 0                                   as c_pass,
  combiner_run.finished_at                             as d_combiner_finished_at,
  (combiner_run.finished_at is not null
    and capper_run.finished_at is not null
    and combiner_run.finished_at > capper_run.finished_at
    and coalesce(capper_weights.updated_today, 0) > 0) as d_pass
from day, capper_run, capper_weights, auto_signals, combiner_run;

grant select on public.v_sbo_automation_daily_check to authenticated;
grant all on public.v_sbo_automation_daily_check to service_role;