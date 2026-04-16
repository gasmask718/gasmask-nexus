
-- ============================================================
-- PART 1: ALTER brandaro_qualified_leads
-- ============================================================
ALTER TABLE brandaro_qualified_leads
ADD COLUMN IF NOT EXISTS call_source TEXT,
ADD COLUMN IF NOT EXISTS dc_call_id TEXT,
ADD COLUMN IF NOT EXISTS dc_queue_id TEXT,
ADD COLUMN IF NOT EXISTS last_dc_call_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_va_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_dc_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_call_source TEXT,
ADD COLUMN IF NOT EXISTS claude_analysis_summary JSONB;

CREATE INDEX IF NOT EXISTS idx_qualified_leads_call_source ON brandaro_qualified_leads(call_source);
CREATE INDEX IF NOT EXISTS idx_qualified_leads_dc_call ON brandaro_qualified_leads(dc_call_id);

-- ============================================================
-- PART 2: ALTER dynasty_call_queue
-- ============================================================
ALTER TABLE dynasty_call_queue
ADD COLUMN IF NOT EXISTS source_table TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_lead_id TEXT,
ADD COLUMN IF NOT EXISTS assigned_by TEXT,
ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_call_queue_source ON dynasty_call_queue(source_table, source_lead_id);

-- ============================================================
-- PART 3: ALTER dynasty_ai_calls
-- ============================================================
ALTER TABLE dynasty_ai_calls
ADD COLUMN IF NOT EXISTS source_table TEXT,
ADD COLUMN IF NOT EXISTS source_lead_id TEXT,
ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'ai_outbound';

CREATE INDEX IF NOT EXISTS idx_ai_calls_source ON dynasty_ai_calls(source_table, source_lead_id);

-- ============================================================
-- PART 4: CREATE unified call history VIEW
-- ============================================================
CREATE OR REPLACE VIEW brandaro_unified_call_history AS
SELECT 
  'va_native' AS call_system,
  bc.id::TEXT AS call_id,
  bc.lead_id::TEXT AS source_lead_id,
  bc.created_at AS call_date,
  bc.duration_seconds,
  bc.outcome,
  bc.transcript,
  NULL AS recording_url,
  bci.ai_summary AS claude_analysis_text,
  bci.intent_level AS lead_quality,
  bci.sentiment AS sentiment_score
FROM brandaro_calls bc
LEFT JOIN brandaro_call_insights bci ON bc.id = bci.call_log_id

UNION ALL

SELECT
  'dynasty_connect' AS call_system,
  dac.call_id,
  dac.source_lead_id,
  dac.created_at AS call_date,
  dac.duration_seconds,
  dac.outcome,
  dac.transcript,
  dac.recording_url,
  dca.specific_coaching AS claude_analysis_text,
  dac.lead_quality,
  dca.customer_sentiment AS sentiment_score
FROM dynasty_ai_calls dac
LEFT JOIN dynasty_call_analysis dca ON dac.call_id = dca.call_id
WHERE dac.source_table = 'brandaro_qualified_leads'

ORDER BY call_date DESC;

-- ============================================================
-- PART 5: CREATE auto-sync trigger
-- ============================================================
CREATE OR REPLACE FUNCTION sync_dc_call_to_brandaro()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_quality TEXT;
  v_analysis_summary JSONB;
  v_source_lead_id TEXT;
  v_source_table TEXT;
BEGIN
  v_source_lead_id := NEW.source_lead_id;
  v_source_table := NEW.source_table;

  -- Only process Brandaro leads
  IF v_source_table IS NULL OR v_source_table != 'brandaro_qualified_leads' THEN
    RETURN NEW;
  END IF;

  IF v_source_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Claude analysis if available
  SELECT 
    COALESCE(dac.customer_sentiment, 'unknown'),
    jsonb_build_object(
      'overall_score', dac.overall_score,
      'rapport_score', dac.rapport_score,
      'qualification_score', dac.qualification_score,
      'closing_score', dac.closing_score,
      'what_went_well', dac.what_went_well,
      'what_to_improve', dac.what_to_improve,
      'specific_coaching', dac.specific_coaching,
      'recommended_followup', dac.recommended_followup
    )
  INTO v_lead_quality, v_analysis_summary
  FROM dynasty_call_analysis dac
  WHERE dac.call_id = NEW.call_id;

  -- Use call-level lead_quality if analysis didn't provide one
  IF v_lead_quality = 'unknown' OR v_lead_quality IS NULL THEN
    v_lead_quality := NEW.lead_quality;
  END IF;

  -- Update Brandaro lead
  UPDATE brandaro_qualified_leads
  SET 
    lead_status = CASE 
      WHEN v_lead_quality IN ('hot', 'warm', 'positive') THEN 'qualified'
      WHEN v_lead_quality IN ('cold', 'neutral') THEN 'contacted'
      ELSE COALESCE(lead_status, 'contacted')
    END,
    dc_call_id = NEW.call_id,
    last_dc_call_date = COALESCE(NEW.call_ended_at, NOW()),
    last_call_at = COALESCE(NEW.call_ended_at, NOW()),
    total_dc_calls = COALESCE(total_dc_calls, 0) + 1,
    call_attempts = COALESCE(call_attempts, 0) + 1,
    call_source = CASE
      WHEN call_source = 'va_native' THEN 'both'
      ELSE COALESCE(call_source, 'dynasty_connect')
    END,
    claude_analysis_summary = COALESCE(v_analysis_summary, claude_analysis_summary),
    updated_at = NOW()
  WHERE id = v_source_lead_id::UUID;

  -- Add to close pipeline if hot/warm
  IF v_lead_quality IN ('hot', 'warm', 'positive') THEN
    INSERT INTO brandaro_close_pipeline (lead_id, stage, created_at, updated_at)
    VALUES (v_source_lead_id::UUID, v_lead_quality, NOW(), NOW())
    ON CONFLICT (lead_id) DO UPDATE
    SET stage = v_lead_quality, updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS after_dc_call_completes ON dynasty_ai_calls;

CREATE TRIGGER after_dc_call_completes
AFTER UPDATE ON dynasty_ai_calls
FOR EACH ROW
WHEN (NEW.outcome IS DISTINCT FROM OLD.outcome AND NEW.outcome IN ('completed', 'voicemail', 'no_answer'))
EXECUTE FUNCTION sync_dc_call_to_brandaro();
