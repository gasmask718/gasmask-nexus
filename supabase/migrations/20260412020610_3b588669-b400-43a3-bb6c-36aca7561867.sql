-- Enable realtime on dispatch and drivers tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tt_dispatches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_dispatches;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tt_drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_drivers;
  END IF;
END $$;

-- Add is_featured column for review curation
ALTER TABLE public.tt_customer_reviews ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
