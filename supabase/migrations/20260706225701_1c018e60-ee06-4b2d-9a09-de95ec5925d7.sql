CREATE UNIQUE INDEX IF NOT EXISTS grant_tasks_application_title_uidx
  ON public.grant_tasks (application_id, title);