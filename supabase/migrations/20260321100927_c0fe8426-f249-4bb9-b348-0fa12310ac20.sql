-- Add cleaning tracking columns to store_notes
ALTER TABLE store_notes
  ADD COLUMN IF NOT EXISTS is_legacy boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_cleaning boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_note text,
  ADD COLUMN IF NOT EXISTS cleaning_status text DEFAULT null;

-- Note cleaning log table
CREATE TABLE IF NOT EXISTS note_cleaning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES store_master(id),
  note_id uuid REFERENCES store_notes(id) ON DELETE SET NULL,
  original_note text,
  cleaned_note text,
  status text,
  cleaned_by text DEFAULT 'ai_agent',
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE note_cleaning_log ENABLE ROW LEVEL SECURITY;