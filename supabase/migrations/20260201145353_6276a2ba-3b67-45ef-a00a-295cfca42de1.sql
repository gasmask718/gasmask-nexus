-- ============================================================
-- PRODUCTION PORTAL PRODUCTION-GRADE UPGRADE
-- Adds: per-brand inputs, variance tracking, day close/locking,
-- worker attendance ledger, office user mapping with RLS
-- ============================================================

-- 1) Add per-brand input fields to production_batches
ALTER TABLE production_batches 
ADD COLUMN IF NOT EXISTS stickers_issued jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS empty_boxes_issued jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS total_tubes_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_stickers_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_empty_boxes_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_defects integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS variance_tubes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS variance_notes text;

-- 2) Create production_office_users mapping for RLS
CREATE TABLE IF NOT EXISTS production_office_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES production_offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('office_manager', 'supervisor', 'admin', 'viewer')),
  is_primary boolean DEFAULT false,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(office_id, user_id)
);

-- 3) Create production_daily_closeouts for day locking
CREATE TABLE IF NOT EXISTS production_daily_closeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES production_offices(id) ON DELETE CASCADE,
  close_date date NOT NULL,
  closed_by uuid NOT NULL REFERENCES auth.users(id),
  closed_at timestamptz DEFAULT now(),
  unlocked_by uuid REFERENCES auth.users(id),
  unlocked_at timestamptz,
  is_locked boolean DEFAULT true,
  total_boxes integer DEFAULT 0,
  total_tobacco_lbs numeric(10,2) DEFAULT 0,
  total_tubes_used integer DEFAULT 0,
  total_defects integer DEFAULT 0,
  variance_summary jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(office_id, close_date)
);

-- 4) Create production_communication_log for message tracking
CREATE TABLE IF NOT EXISTS production_communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES production_offices(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES production_workers(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES production_batches(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'call')),
  phone_used text,
  message_body text,
  direction text DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'read')),
  provider_message_id text,
  error_message text,
  sent_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 5) Extend production_worker_attendance for check-in/check-out
ALTER TABLE production_worker_attendance
ADD COLUMN IF NOT EXISTS shift_label text,
ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
ADD COLUMN IF NOT EXISTS hours_worked numeric(5,2),
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id);

-- 6) Add variance tracking fields to production_batch_outputs
ALTER TABLE production_batch_outputs
ADD COLUMN IF NOT EXISTS stickers_issued integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS empty_boxes_issued integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS variance_stickers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS variance_boxes integer DEFAULT 0;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS FOR RLS
-- ============================================================

-- Function to check if user has access to an office
CREATE OR REPLACE FUNCTION public.has_production_office_access(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM production_office_users
    WHERE user_id = _user_id 
      AND office_id = _office_id
      AND active = true
  ) OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Function to check if user is production admin
CREATE OR REPLACE FUNCTION public.is_production_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE production_office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_daily_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_communication_log ENABLE ROW LEVEL SECURITY;

-- production_office_users policies
CREATE POLICY "Admins can manage office users"
ON production_office_users FOR ALL
TO authenticated
USING (public.is_production_admin(auth.uid()));

CREATE POLICY "Users can view their own office assignments"
ON production_office_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- production_daily_closeouts policies
CREATE POLICY "Users can view closeouts for their offices"
ON production_daily_closeouts FOR SELECT
TO authenticated
USING (public.has_production_office_access(auth.uid(), office_id));

CREATE POLICY "Office managers can create closeouts"
ON production_daily_closeouts FOR INSERT
TO authenticated
WITH CHECK (public.has_production_office_access(auth.uid(), office_id));

CREATE POLICY "Admins can manage closeouts"
ON production_daily_closeouts FOR ALL
TO authenticated
USING (public.is_production_admin(auth.uid()));

-- production_communication_log policies
CREATE POLICY "Users can view comms for their offices"
ON production_communication_log FOR SELECT
TO authenticated
USING (public.has_production_office_access(auth.uid(), office_id));

CREATE POLICY "Users can create comms for their offices"
ON production_communication_log FOR INSERT
TO authenticated
WITH CHECK (public.has_production_office_access(auth.uid(), office_id));

-- ============================================================
-- TRIGGERS FOR AUTO-CALCULATIONS
-- ============================================================

-- Function to update batch totals when outputs are modified
CREATE OR REPLACE FUNCTION update_batch_output_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_boxes integer;
  v_total_tubes integer;
  v_total_stickers integer;
  v_total_empty_boxes integer;
  v_total_defects integer;
  v_batch_tubes integer;
  v_variance_tubes integer;
  v_efficiency_pct numeric;
BEGIN
  -- Calculate totals from all outputs for this batch
  SELECT 
    COALESCE(SUM(boxes_completed), 0),
    COALESCE(SUM(tubes_used), 0),
    COALESCE(SUM(stickers_used), 0),
    COALESCE(SUM(empty_boxes_used), 0),
    COALESCE(SUM(defects_count), 0)
  INTO v_total_boxes, v_total_tubes, v_total_stickers, v_total_empty_boxes, v_total_defects
  FROM production_batch_outputs
  WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id);

  -- Get batch input tubes
  SELECT COALESCE(tubes_total, 0)
  INTO v_batch_tubes
  FROM production_batches
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);

  -- Calculate variance and efficiency
  v_variance_tubes := v_batch_tubes - v_total_tubes;
  IF v_total_tubes > 0 THEN
    v_efficiency_pct := ROUND((v_total_boxes::numeric / (v_total_tubes::numeric / 20)) * 100, 1);
  ELSE
    v_efficiency_pct := 0;
  END IF;

  -- Update batch with calculated values
  UPDATE production_batches
  SET 
    boxes_produced = v_total_boxes,
    total_tubes_used = v_total_tubes,
    total_stickers_used = v_total_stickers,
    total_empty_boxes_used = v_total_empty_boxes,
    total_defects = v_total_defects,
    variance_tubes = v_variance_tubes,
    efficiency_pct = v_efficiency_pct,
    updated_at = now()
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_batch_totals ON production_batch_outputs;
CREATE TRIGGER trigger_update_batch_totals
AFTER INSERT OR UPDATE OR DELETE ON production_batch_outputs
FOR EACH ROW
EXECUTE FUNCTION update_batch_output_totals();

-- Function to log production history events
CREATE OR REPLACE FUNCTION log_production_history()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type text;
  v_event_data jsonb;
  v_office_id uuid;
BEGIN
  -- Determine event type based on operation and table
  IF TG_TABLE_NAME = 'production_batches' THEN
    v_office_id := COALESCE(NEW.office_id, OLD.office_id);
    
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'batch_created';
      v_event_data := jsonb_build_object(
        'brand', NEW.brand,
        'shift', NEW.shift_label,
        'tobacco_lbs', NEW.tobacco_lbs,
        'tubes_total', NEW.tubes_total
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status != NEW.status THEN
        IF NEW.status = 'in_progress' THEN v_event_type := 'batch_started';
        ELSIF NEW.status = 'completed' THEN v_event_type := 'batch_completed';
        ELSIF NEW.status = 'cancelled' THEN v_event_type := 'batch_cancelled';
        ELSE v_event_type := 'batch_updated';
        END IF;
        v_event_data := jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'boxes_completed', NEW.boxes_produced
        );
      ELSIF NEW.is_locked AND NOT OLD.is_locked THEN
        v_event_type := 'batch_locked';
        v_event_data := jsonb_build_object('locked_by', NEW.locked_by);
      ELSE
        v_event_type := 'input_updated';
        v_event_data := jsonb_build_object(
          'tobacco_lbs', NEW.tobacco_lbs,
          'tubes_total', NEW.tubes_total
        );
      END IF;
    END IF;
    
    INSERT INTO production_history (office_id, batch_id, event_type, event_data, performed_by)
    VALUES (v_office_id, NEW.id, v_event_type, v_event_data, auth.uid());
    
  ELSIF TG_TABLE_NAME = 'production_batch_outputs' THEN
    SELECT office_id INTO v_office_id FROM production_batches WHERE id = NEW.batch_id;
    
    v_event_type := 'output_recorded';
    v_event_data := jsonb_build_object(
      'brand', NEW.brand,
      'boxes_completed', NEW.boxes_completed,
      'tubes_used', NEW.tubes_used,
      'defects', NEW.defects_count
    );
    
    INSERT INTO production_history (office_id, batch_id, event_type, event_data, performed_by)
    VALUES (v_office_id, NEW.batch_id, v_event_type, v_event_data, auth.uid());
    
  ELSIF TG_TABLE_NAME = 'production_daily_closeouts' THEN
    v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'day_closed' ELSE 'day_unlocked' END;
    v_event_data := jsonb_build_object(
      'close_date', NEW.close_date,
      'total_boxes', NEW.total_boxes,
      'total_tobacco_lbs', NEW.total_tobacco_lbs
    );
    
    INSERT INTO production_history (office_id, event_type, event_data, performed_by)
    VALUES (NEW.office_id, v_event_type, v_event_data, auth.uid());
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create history triggers
DROP TRIGGER IF EXISTS trigger_log_batch_history ON production_batches;
CREATE TRIGGER trigger_log_batch_history
AFTER INSERT OR UPDATE ON production_batches
FOR EACH ROW
EXECUTE FUNCTION log_production_history();

DROP TRIGGER IF EXISTS trigger_log_output_history ON production_batch_outputs;
CREATE TRIGGER trigger_log_output_history
AFTER INSERT ON production_batch_outputs
FOR EACH ROW
EXECUTE FUNCTION log_production_history();

DROP TRIGGER IF EXISTS trigger_log_closeout_history ON production_daily_closeouts;
CREATE TRIGGER trigger_log_closeout_history
AFTER INSERT OR UPDATE ON production_daily_closeouts
FOR EACH ROW
EXECUTE FUNCTION log_production_history();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE production_daily_closeouts;
ALTER PUBLICATION supabase_realtime ADD TABLE production_communication_log;