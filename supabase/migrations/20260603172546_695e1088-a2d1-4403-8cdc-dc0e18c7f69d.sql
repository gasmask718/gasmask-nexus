DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dc_bulk_batches; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dc_bulk_targets; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.dc_bulk_batches REPLICA IDENTITY FULL;
ALTER TABLE public.dc_bulk_targets REPLICA IDENTITY FULL;