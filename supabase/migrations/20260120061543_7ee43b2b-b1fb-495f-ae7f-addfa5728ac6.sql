-- =====================================================
-- PHASE 2: MILITARY-GRADE HARDENING - DATABASE LAYER
-- =====================================================

-- 1. PORTAL SESSIONS TABLE (Session & Identity Hardening)
-- Short-lived sessions with refresh token tracking
CREATE TABLE public.portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  device_id UUID,
  access_token_hash TEXT, -- hash of current access token for validation
  refresh_token_hash TEXT, -- hash of refresh token
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  refresh_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast session lookups
CREATE INDEX idx_portal_sessions_user_active ON portal_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_portal_sessions_device ON portal_sessions(device_id) WHERE device_id IS NOT NULL;

-- 2. PORTAL DEVICES TABLE (Device Trust & Binding)
CREATE TABLE public.portal_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  device_name TEXT,
  device_fingerprint TEXT, -- signal only, not relied upon
  platform TEXT, -- ios, android, web
  browser TEXT,
  os_version TEXT,
  app_version TEXT,
  push_token TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ip_address INET,
  last_location JSONB, -- { lat, lng, accuracy }
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  trusted_at TIMESTAMPTZ,
  trusted_by UUID REFERENCES auth.users(id),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

-- Index for device lookups
CREATE INDEX idx_portal_devices_user_active ON portal_devices(user_id, is_revoked) WHERE is_revoked = false;
CREATE INDEX idx_portal_devices_fingerprint ON portal_devices(device_fingerprint);

-- 3. PORTAL REQUEST LOG (Action Integrity & Replay Protection)
CREATE TABLE public.portal_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL, -- client-provided nonce/request ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES portal_sessions(id),
  device_id UUID REFERENCES portal_devices(id),
  portal_type TEXT NOT NULL CHECK (portal_type IN ('driver', 'biker')),
  action_type TEXT NOT NULL,
  assignment_id UUID,
  shift_id UUID,
  entity_type TEXT,
  entity_id UUID,
  client_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  location JSONB, -- { lat, lng, accuracy }
  payload_hash TEXT, -- hash of request payload for integrity
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'duplicate')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, user_id) -- prevent replay attacks
);

-- Index for deduplication checks
CREATE INDEX idx_portal_request_log_dedup ON portal_request_log(request_id, user_id);
CREATE INDEX idx_portal_request_log_user_recent ON portal_request_log(user_id, created_at DESC);

-- 4. PORTAL SECURITY EVENTS (Risk & Anomaly Detection)
CREATE TABLE public.portal_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id UUID REFERENCES portal_devices(id) ON DELETE SET NULL,
  session_id UUID REFERENCES portal_sessions(id) ON DELETE SET NULL,
  portal_type TEXT CHECK (portal_type IN ('driver', 'biker')),
  event_type TEXT NOT NULL, -- login_denied, role_mismatch, new_device, impossible_travel, repeated_failure, device_revoked, session_revoked, suspicious_activity
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  event_message TEXT NOT NULL,
  ip_address INET,
  location JSONB,
  user_agent TEXT,
  metadata JSONB, -- additional context
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for security console queries
CREATE INDEX idx_portal_security_events_recent ON portal_security_events(created_at DESC);
CREATE INDEX idx_portal_security_events_user ON portal_security_events(user_id, created_at DESC);
CREATE INDEX idx_portal_security_events_severity ON portal_security_events(severity, created_at DESC) WHERE severity IN ('warning', 'critical');

-- 5. USER SECURITY STATE (for forced logout on changes)
CREATE TABLE public.portal_user_security_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  password_changed_at TIMESTAMPTZ,
  role_changed_at TIMESTAMPTZ,
  mfa_reset_at TIMESTAMPTZ,
  force_logout_at TIMESTAMPTZ, -- all sessions before this time are invalid
  portal_frozen_at TIMESTAMPTZ, -- emergency freeze
  portal_frozen_by UUID REFERENCES auth.users(id),
  portal_frozen_reason TEXT,
  max_active_devices INT NOT NULL DEFAULT 3,
  require_step_up_auth BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for security state lookups
CREATE INDEX idx_portal_user_security_state_user ON portal_user_security_state(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_user_security_state ENABLE ROW LEVEL SECURITY;

-- PORTAL SESSIONS: Users see only their own, elevated can manage
CREATE POLICY "Users view own sessions" ON portal_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Elevated users can revoke sessions" ON portal_sessions
  FOR UPDATE USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "System can create sessions" ON portal_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- PORTAL DEVICES: Users see own, elevated can manage
CREATE POLICY "Users view own devices" ON portal_devices
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Users can register own devices" ON portal_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Elevated users can manage devices" ON portal_devices
  FOR UPDATE USING (public.is_elevated_user(auth.uid()));

-- PORTAL REQUEST LOG: Users see own, elevated see all
CREATE POLICY "Users view own requests" ON portal_request_log
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "Users can log own requests" ON portal_request_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- PORTAL SECURITY EVENTS: Elevated only (security console)
CREATE POLICY "Elevated users view security events" ON portal_security_events
  FOR SELECT USING (public.is_elevated_user(auth.uid()));

CREATE POLICY "System can create security events" ON portal_security_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Elevated users can acknowledge events" ON portal_security_events
  FOR UPDATE USING (public.is_elevated_user(auth.uid()));

-- PORTAL USER SECURITY STATE: Users see own, elevated can manage
CREATE POLICY "Users view own security state" ON portal_user_security_state
  FOR SELECT USING (auth.uid() = user_id OR public.is_elevated_user(auth.uid()));

CREATE POLICY "System can create security state" ON portal_user_security_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Elevated users can manage security state" ON portal_user_security_state
  FOR UPDATE USING (public.is_elevated_user(auth.uid()));

-- =====================================================
-- SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Function to check if a session is valid
CREATE OR REPLACE FUNCTION public.is_portal_session_valid(_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session portal_sessions%ROWTYPE;
  v_security_state portal_user_security_state%ROWTYPE;
  v_device portal_devices%ROWTYPE;
BEGIN
  -- Get session
  SELECT * INTO v_session FROM portal_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Check if session is active and not expired
  IF NOT v_session.is_active OR v_session.access_expires_at < now() THEN
    RETURN false;
  END IF;
  
  -- Check if session was revoked
  IF v_session.revoked_at IS NOT NULL THEN
    RETURN false;
  END IF;
  
  -- Check user security state
  SELECT * INTO v_security_state FROM portal_user_security_state WHERE user_id = v_session.user_id;
  IF FOUND THEN
    -- Check if force logout was triggered after session was created
    IF v_security_state.force_logout_at IS NOT NULL AND v_security_state.force_logout_at > v_session.issued_at THEN
      RETURN false;
    END IF;
    
    -- Check if portal is frozen
    IF v_security_state.portal_frozen_at IS NOT NULL THEN
      RETURN false;
    END IF;
    
    -- Check if role changed after session was created
    IF v_security_state.role_changed_at IS NOT NULL AND v_security_state.role_changed_at > v_session.issued_at THEN
      RETURN false;
    END IF;
    
    -- Check if password changed after session was created
    IF v_security_state.password_changed_at IS NOT NULL AND v_security_state.password_changed_at > v_session.issued_at THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check device if bound
  IF v_session.device_id IS NOT NULL THEN
    SELECT * INTO v_device FROM portal_devices WHERE id = v_session.device_id;
    IF FOUND AND v_device.is_revoked THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to validate and log a portal request (replay protection)
CREATE OR REPLACE FUNCTION public.validate_portal_request(
  _request_id TEXT,
  _user_id UUID,
  _portal_type TEXT,
  _action_type TEXT,
  _assignment_id UUID DEFAULT NULL,
  _shift_id UUID DEFAULT NULL,
  _client_timestamp TIMESTAMPTZ DEFAULT NULL,
  _payload_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing portal_request_log%ROWTYPE;
  v_security_state portal_user_security_state%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Check for replay attack (duplicate request_id)
  SELECT * INTO v_existing FROM portal_request_log 
  WHERE request_id = _request_id AND user_id = _user_id;
  
  IF FOUND THEN
    -- Log the duplicate attempt
    INSERT INTO portal_security_events (user_id, portal_type, event_type, severity, event_message, metadata)
    VALUES (_user_id, _portal_type, 'replay_attempt', 'warning', 'Duplicate request ID detected', 
            jsonb_build_object('request_id', _request_id, 'original_timestamp', v_existing.server_timestamp));
    
    RETURN jsonb_build_object('valid', false, 'reason', 'duplicate_request', 'original_id', v_existing.id);
  END IF;
  
  -- Check user security state
  SELECT * INTO v_security_state FROM portal_user_security_state WHERE user_id = _user_id;
  IF FOUND AND v_security_state.portal_frozen_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'portal_frozen');
  END IF;
  
  -- Log the valid request
  INSERT INTO portal_request_log (request_id, user_id, portal_type, action_type, assignment_id, shift_id, client_timestamp, payload_hash, status)
  VALUES (_request_id, _user_id, _portal_type, _action_type, _assignment_id, _shift_id, _client_timestamp, _payload_hash, 'accepted');
  
  RETURN jsonb_build_object('valid', true);
END;
$$;

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_portal_security_event(
  _user_id UUID,
  _device_id UUID,
  _portal_type TEXT,
  _event_type TEXT,
  _severity TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO portal_security_events (user_id, device_id, portal_type, event_type, severity, event_message, metadata)
  VALUES (_user_id, _device_id, _portal_type, _event_type, _severity, _message, _metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function to force logout a user (emergency control)
CREATE OR REPLACE FUNCTION public.force_portal_logout(_target_user_id UUID, _reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only elevated users can force logout
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  -- Update or create security state
  INSERT INTO portal_user_security_state (user_id, force_logout_at)
  VALUES (_target_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    force_logout_at = now(),
    updated_at = now();
  
  -- Revoke all active sessions
  UPDATE portal_sessions
  SET is_active = false, revoked_at = now(), revoked_by = auth.uid(), revoke_reason = COALESCE(_reason, 'Forced logout')
  WHERE user_id = _target_user_id AND is_active = true;
  
  -- Log the event
  PERFORM public.log_portal_security_event(
    _target_user_id, NULL, NULL, 'force_logout', 'warning',
    'User forced logged out by admin',
    jsonb_build_object('admin_id', auth.uid(), 'reason', _reason)
  );
  
  RETURN true;
END;
$$;

-- Function to freeze portal access (emergency control)
CREATE OR REPLACE FUNCTION public.freeze_portal_access(_target_user_id UUID, _reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only elevated users can freeze access
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  -- Update or create security state
  INSERT INTO portal_user_security_state (user_id, portal_frozen_at, portal_frozen_by, portal_frozen_reason, force_logout_at)
  VALUES (_target_user_id, now(), auth.uid(), _reason, now())
  ON CONFLICT (user_id) DO UPDATE SET
    portal_frozen_at = now(),
    portal_frozen_by = auth.uid(),
    portal_frozen_reason = _reason,
    force_logout_at = now(),
    updated_at = now();
  
  -- Revoke all active sessions
  UPDATE portal_sessions
  SET is_active = false, revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Portal access frozen: ' || _reason
  WHERE user_id = _target_user_id AND is_active = true;
  
  -- Log the event
  PERFORM public.log_portal_security_event(
    _target_user_id, NULL, NULL, 'portal_frozen', 'critical',
    'Portal access frozen by admin',
    jsonb_build_object('admin_id', auth.uid(), 'reason', _reason)
  );
  
  RETURN true;
END;
$$;

-- Function to revoke a device
CREATE OR REPLACE FUNCTION public.revoke_portal_device(_device_id UUID, _reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device portal_devices%ROWTYPE;
BEGIN
  -- Only elevated users can revoke devices
  IF NOT public.is_elevated_user(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: elevated users only';
  END IF;
  
  -- Get device
  SELECT * INTO v_device FROM portal_devices WHERE id = _device_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found';
  END IF;
  
  -- Revoke the device
  UPDATE portal_devices
  SET is_revoked = true, revoked_at = now(), revoked_by = auth.uid(), revoke_reason = _reason, updated_at = now()
  WHERE id = _device_id;
  
  -- Revoke all sessions for this device
  UPDATE portal_sessions
  SET is_active = false, revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Device revoked: ' || COALESCE(_reason, 'No reason provided')
  WHERE device_id = _device_id AND is_active = true;
  
  -- Log the event
  PERFORM public.log_portal_security_event(
    v_device.user_id, _device_id, v_device.portal_type, 'device_revoked', 'warning',
    'Device revoked by admin',
    jsonb_build_object('admin_id', auth.uid(), 'reason', _reason)
  );
  
  RETURN true;
END;
$$;

-- Trigger to update timestamps
CREATE TRIGGER update_portal_devices_timestamp
  BEFORE UPDATE ON portal_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_user_security_state_timestamp
  BEFORE UPDATE ON portal_user_security_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();