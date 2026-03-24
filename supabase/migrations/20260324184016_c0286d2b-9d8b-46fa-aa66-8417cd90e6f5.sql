
ALTER TABLE call_recordings 
ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_call_recordings_conv_id 
  ON call_recordings(elevenlabs_conversation_id)
  WHERE elevenlabs_conversation_id IS NOT NULL;
