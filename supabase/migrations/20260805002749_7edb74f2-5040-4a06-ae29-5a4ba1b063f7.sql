SELECT cron.alter_job(
  job_id  => 108,
  command => $cmd$SELECT private.cron_post('sbo-signal-combiner', '{"reprocess_all": true}'::jsonb) AS request_id;$cmd$
);

SELECT cron.alter_job(
  job_id  => 109,
  command => $cmd$SELECT private.cron_post('sbo-signal-combiner', '{"reprocess_all": true}'::jsonb) AS request_id;$cmd$
);