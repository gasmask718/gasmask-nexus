DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'brandaro_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE brandaro_conversations;
  END IF;
END $$;