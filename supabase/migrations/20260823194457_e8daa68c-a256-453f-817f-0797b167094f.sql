SELECT cron.alter_job(job_id := j, active := true)
FROM (VALUES (34),(30),(3),(6),(7),(13),(73),(43),(79),(36),(37)) AS v(j);
SELECT jobid, jobname, active FROM cron.job WHERE jobid IN (34, 30, 3, 6, 7, 13, 73, 43, 79, 36, 37) ORDER BY jobid;