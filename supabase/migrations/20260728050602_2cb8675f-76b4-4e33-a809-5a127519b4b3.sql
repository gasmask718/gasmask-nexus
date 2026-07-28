DELETE FROM public.followup_recommendations a
USING public.followup_recommendations b
WHERE a.store_id = b.store_id AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS followup_recommendations_store_id_uidx
  ON public.followup_recommendations (store_id);