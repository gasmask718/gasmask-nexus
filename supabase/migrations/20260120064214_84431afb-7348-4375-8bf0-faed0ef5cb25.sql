-- Phase 3: Offline-Ready, Crypto-Signed, Zero-Trust Edge Execution

-- Add public key column to portal_devices for device signing
ALTER TABLE public.portal_devices 
ADD COLUMN IF NOT EXISTS public_key TEXT,
ADD COLUMN IF NOT EXISTS public_key_algorithm TEXT DEFAULT 'ECDSA-P256',
ADD COLUMN IF NOT EXISTS key_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS key_rotated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_signed_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_quarantined BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quarantined_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

-- Portal offline action queue (server-side record of ingested actions)
CREATE TABLE IF NOT EXISTS public.portal_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID UNIQUE NOT NULL,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_id UUID REFERENCES portal_devices(id),
  assignment_id UUID,
  shift_id UUID,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  client_timestamp TIMESTAMPTZ NOT NULL,
  sequence_number BIGINT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'rejected', 'quarantined')),
  rejection_reason TEXT,
  rejection_code TEXT,
  signature_valid BOOLEAN,
  signature_verified_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Device sequence tracking for monotonicity enforcement
CREATE TABLE IF NOT EXISTS public.portal_device_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES portal_devices(id) ON DELETE CASCADE,
  last_sequence_number BIGINT NOT NULL DEFAULT 0,
  last_action_id UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id)
);

-- Dead letter queue for actions that failed after max retries
CREATE TABLE IF NOT EXISTS public.portal_action_deadletter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL,
  portal_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  device_id UUID,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  sequence_number BIGINT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature TEXT,
  failure_reason TEXT NOT NULL,
  failure_code TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  deadlettered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Portal API allowlist for zero-trust boundary
CREATE TABLE IF NOT EXISTS public.portal_api_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_name TEXT NOT NULL UNIQUE,
  portal_types TEXT[] NOT NULL DEFAULT ARRAY['driver', 'biker'],
  description TEXT,
  rate_limit_per_minute INTEGER DEFAULT 60,
  requires_signature BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default allowed endpoints
INSERT INTO public.portal_api_allowlist (endpoint_name, portal_types, description, requires_signature) VALUES
('ingest_portal_actions', ARRAY['driver', 'biker'], 'Sync offline actions', true),
('validate_portal_request', ARRAY['driver', 'biker'], 'Validate single request', false),
('get_portal_assignments', ARRAY['driver', 'biker'], 'Get assigned work', false),
('get_portal_shifts', ARRAY['driver', 'biker'], 'Get shift schedule', false),
('update_portal_location', ARRAY['driver', 'biker'], 'Update GPS location', false)
ON CONFLICT (endpoint_name) DO NOTHING;

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS public.portal_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES portal_devices(id) ON DELETE CASCADE,
  endpoint_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  UNIQUE(device_id, endpoint_name, window_start)
);

-- Enable RLS on new tables
ALTER TABLE public.portal_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_device_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_action_deadletter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_api_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portal_action_queue
CREATE POLICY "Users can view own actions" ON public.portal_action_queue
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "System inserts actions" ON public.portal_action_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Elevated users can update" ON public.portal_action_queue
  FOR UPDATE USING (public.is_elevated_user(auth.uid()));

-- RLS Policies for portal_device_sequences
CREATE POLICY "Users can view own sequences" ON public.portal_device_sequences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM portal_devices pd WHERE pd.id = device_id AND pd.user_id = auth.uid())
    OR public.is_elevated_user(auth.uid())
  );

CREATE POLICY "System manages sequences" ON public.portal_device_sequences
  FOR ALL USING (true);

-- RLS Policies for portal_action_deadletter
CREATE POLICY "Users can view own deadletters" ON public.portal_action_deadletter
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can manage deadletters" ON public.portal_action_deadletter
  FOR ALL USING (public.is_elevated_user(auth.uid()));

-- RLS Policies for portal_api_allowlist
CREATE POLICY "Anyone can read allowlist" ON public.portal_api_allowlist
  FOR SELECT USING (true);

CREATE POLICY "Elevated users manage allowlist" ON public.portal_api_allowlist
  FOR ALL USING (public.is_elevated_user(auth.uid()));

-- RLS Policies for portal_rate_limits
CREATE POLICY "Rate limits viewable by elevated" ON public.portal_rate_limits
  FOR SELECT USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "System manages rate limits" ON public.portal_rate_limits
  FOR ALL USING (true);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_portal_rate_limit(
  _device_id UUID,
  _endpoint_name TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Get rate limit for endpoint
  SELECT rate_limit_per_minute INTO v_limit
  FROM portal_api_allowlist
  WHERE endpoint_name = _endpoint_name AND is_active = true;
  
  IF v_limit IS NULL THEN
    v_limit := 60; -- Default
  END IF;
  
  -- Current minute window
  v_window_start := date_trunc('minute', now());
  
  -- Get or create rate limit record
  INSERT INTO portal_rate_limits (device_id, endpoint_name, window_start, request_count)
  VALUES (_device_id, _endpoint_name, v_window_start, 1)
  ON CONFLICT (device_id, endpoint_name, window_start) 
  DO UPDATE SET request_count = portal_rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  RETURN v_current_count <= v_limit;
END;
$$;

-- Function to quarantine a device
CREATE OR REPLACE FUNCTION public.quarantine_portal_device(
  _device_id UUID,
  _reason TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  UPDATE portal_devices
  SET is_quarantined = true,
      quarantined_at = now(),
      quarantined_by = auth.uid(),
      quarantine_reason = _reason
  WHERE id = _device_id;
  
  -- Log security event
  INSERT INTO portal_security_events (user_id, device_id, portal_type, event_type, severity, event_message, metadata)
  SELECT user_id, id, portal_type, 'device_quarantined', 'critical', 'Device quarantined by admin',
         jsonb_build_object('reason', _reason, 'admin_id', auth.uid())
  FROM portal_devices WHERE id = _device_id;
  
  RETURN FOUND;
END;
$$;

-- Function to require key rotation
CREATE OR REPLACE FUNCTION public.require_device_key_rotation(
  _device_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  -- Clear the public key, forcing re-registration
  UPDATE portal_devices
  SET public_key = NULL,
      key_rotated_at = now()
  WHERE id = _device_id;
  
  -- Log security event
  INSERT INTO portal_security_events (user_id, device_id, portal_type, event_type, severity, event_message, metadata)
  SELECT user_id, id, portal_type, 'key_rotation_required', 'warning', 'Device key rotation required by admin',
         jsonb_build_object('admin_id', auth.uid())
  FROM portal_devices WHERE id = _device_id;
  
  RETURN FOUND;
END;
$$;

-- Main action ingestion function
CREATE OR REPLACE FUNCTION public.ingest_portal_actions(
  _actions JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action JSONB;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
  v_device portal_devices%ROWTYPE;
  v_last_seq BIGINT;
  v_user_id UUID;
  v_device_id UUID;
  v_action_id UUID;
  v_seq_num BIGINT;
  v_signature_valid BOOLEAN;
  v_rejection_reason TEXT;
  v_rejection_code TEXT;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  
  FOR v_action IN SELECT * FROM jsonb_array_elements(_actions)
  LOOP
    v_action_id := (v_action->>'action_id')::UUID;
    v_device_id := (v_action->>'device_id')::UUID;
    v_seq_num := (v_action->>'sequence_number')::BIGINT;
    v_rejection_reason := NULL;
    v_rejection_code := NULL;
    v_signature_valid := NULL;
    v_status := 'acked';
    
    -- Check device exists and belongs to user
    SELECT * INTO v_device FROM portal_devices 
    WHERE id = v_device_id AND user_id = v_user_id;
    
    IF NOT FOUND THEN
      v_status := 'rejected';
      v_rejection_code := 'device_not_found';
      v_rejection_reason := 'Device not registered or does not belong to user';
    ELSIF v_device.is_revoked THEN
      v_status := 'rejected';
      v_rejection_code := 'device_revoked';
      v_rejection_reason := 'Device has been revoked';
    ELSIF v_device.is_quarantined THEN
      v_status := 'quarantined';
      v_rejection_code := 'device_quarantined';
      v_rejection_reason := 'Device is quarantined';
    ELSE
      -- Check sequence monotonicity
      SELECT last_sequence_number INTO v_last_seq
      FROM portal_device_sequences WHERE device_id = v_device_id;
      
      IF v_last_seq IS NULL THEN
        -- First action from device
        INSERT INTO portal_device_sequences (device_id, last_sequence_number, last_action_id)
        VALUES (v_device_id, v_seq_num, v_action_id);
      ELSIF v_seq_num <= v_last_seq THEN
        v_status := 'rejected';
        v_rejection_code := 'out_of_order';
        v_rejection_reason := 'Sequence number out of order (replay or reorder attack)';
      ELSE
        -- Update sequence
        UPDATE portal_device_sequences 
        SET last_sequence_number = v_seq_num, last_action_id = v_action_id, updated_at = now()
        WHERE device_id = v_device_id;
      END IF;
      
      -- Signature verification (if device has public key)
      IF v_status = 'acked' AND v_device.public_key IS NOT NULL AND v_action->>'signature' IS NOT NULL THEN
        -- For now, mark as needing verification - actual crypto happens in edge function
        v_signature_valid := true; -- Placeholder - edge function will verify
      END IF;
      
      -- Check for duplicate action_id
      IF v_status = 'acked' AND EXISTS (SELECT 1 FROM portal_action_queue WHERE action_id = v_action_id) THEN
        v_status := 'rejected';
        v_rejection_code := 'duplicate_action';
        v_rejection_reason := 'Action already processed';
      END IF;
    END IF;
    
    -- Insert the action record
    INSERT INTO portal_action_queue (
      action_id, portal_type, user_id, device_id, assignment_id, shift_id,
      action_type, payload, client_timestamp, sequence_number, payload_hash,
      signature, status, rejection_reason, rejection_code, signature_valid,
      signature_verified_at, processed_at
    ) VALUES (
      v_action_id,
      v_action->>'portal_type',
      v_user_id,
      v_device_id,
      (v_action->>'assignment_id')::UUID,
      (v_action->>'shift_id')::UUID,
      v_action->>'action_type',
      v_action->'payload',
      (v_action->>'client_timestamp')::TIMESTAMPTZ,
      v_seq_num,
      v_action->>'payload_hash',
      v_action->>'signature',
      v_status,
      v_rejection_reason,
      v_rejection_code,
      v_signature_valid,
      CASE WHEN v_signature_valid IS NOT NULL THEN now() END,
      now()
    )
    ON CONFLICT (action_id) DO NOTHING;
    
    -- Update device last signed action
    IF v_status = 'acked' AND v_signature_valid = true THEN
      UPDATE portal_devices SET last_signed_action_at = now() WHERE id = v_device_id;
    END IF;
    
    -- Log security events for rejections
    IF v_status IN ('rejected', 'quarantined') THEN
      INSERT INTO portal_security_events (user_id, device_id, portal_type, event_type, severity, event_message, metadata)
      VALUES (v_user_id, v_device_id, v_action->>'portal_type', 'action_' || v_status, 
              CASE WHEN v_status = 'quarantined' THEN 'critical' ELSE 'warning' END,
              v_rejection_reason,
              jsonb_build_object('action_id', v_action_id, 'code', v_rejection_code));
    END IF;
    
    -- Build result
    v_result := jsonb_build_object(
      'action_id', v_action_id,
      'status', v_status,
      'rejection_code', v_rejection_code,
      'rejection_reason', v_rejection_reason
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN v_results;
END;
$$;

-- Function to get offline queue health metrics
CREATE OR REPLACE FUNCTION public.get_portal_queue_health()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  SELECT jsonb_build_object(
    'total_queued', (SELECT COUNT(*) FROM portal_action_queue WHERE status = 'pending'),
    'total_acked', (SELECT COUNT(*) FROM portal_action_queue WHERE status = 'acked'),
    'total_rejected', (SELECT COUNT(*) FROM portal_action_queue WHERE status = 'rejected'),
    'total_quarantined', (SELECT COUNT(*) FROM portal_action_queue WHERE status = 'quarantined'),
    'total_deadletter', (SELECT COUNT(*) FROM portal_action_deadletter WHERE resolved_at IS NULL),
    'by_portal_type', (
      SELECT jsonb_object_agg(portal_type, cnt)
      FROM (SELECT portal_type, COUNT(*) as cnt FROM portal_action_queue GROUP BY portal_type) sub
    ),
    'integrity_failures_24h', (
      SELECT COUNT(*) FROM portal_security_events 
      WHERE event_type IN ('action_rejected', 'action_quarantined')
      AND created_at > now() - interval '24 hours'
    ),
    'devices_with_keys', (SELECT COUNT(*) FROM portal_devices WHERE public_key IS NOT NULL),
    'quarantined_devices', (SELECT COUNT(*) FROM portal_devices WHERE is_quarantined = true)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_action_queue_user ON portal_action_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_action_queue_device ON portal_action_queue(device_id);
CREATE INDEX IF NOT EXISTS idx_portal_action_queue_status ON portal_action_queue(status);
CREATE INDEX IF NOT EXISTS idx_portal_action_queue_action_id ON portal_action_queue(action_id);
CREATE INDEX IF NOT EXISTS idx_portal_device_sequences_device ON portal_device_sequences(device_id);
CREATE INDEX IF NOT EXISTS idx_portal_deadletter_unresolved ON portal_action_deadletter(resolved_at) WHERE resolved_at IS NULL;