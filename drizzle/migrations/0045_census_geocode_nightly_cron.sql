SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'census-store-geocode-nightly';
SELECT cron.schedule('census-store-geocode-nightly', '0 8 * * *',
  $$SELECT private.cron_post('census-store-geocode', '{"limit":1500}'::jsonb) AS request_id;$$);