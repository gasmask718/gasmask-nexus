-- 1. Class limits (editable configuration)
CREATE TABLE IF NOT EXISTS public.messaging_class_limits (
  send_class text PRIMARY KEY,
  daily_limit integer NOT NULL,
  cooldown_minutes integer NOT NULL DEFAULT 0,
  cooldown_scope text NOT NULL DEFAULT 'class' CHECK (cooldown_scope IN ('class','none')),
  suppression_check boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_class_limits TO authenticated;
GRANT ALL ON public.messaging_class_limits TO service_role;
ALTER TABLE public.messaging_class_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage messaging class limits"
ON public.messaging_class_limits FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.messaging_class_limits (send_class, daily_limit, cooldown_minutes, cooldown_scope, suppression_check, notes) VALUES
  ('transactional', 2000, 0,    'none',  false, 'Customer-initiated: receipts, confirmations, codes. Never marketing-suppressed; legal STOP still blocks.'),
  ('workforce',     1000, 0,    'none',  false, 'Contracted staff/partner dispatch. Never marketing-suppressed; legal STOP still blocks.'),
  ('conversational', 1000, 0,   'none',  true,  '1:1 human-initiated rep-to-store messages. Suppression checked, no cooldown.'),
  ('campaign',       500, 1440, 'class', true,  'Marketing/outreach. Suppression checked. 24h cooldown scoped to campaign traffic only.')
ON CONFLICT (send_class) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_messaging_class_limits()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_messaging_class_limits ON public.messaging_class_limits;
CREATE TRIGGER trg_touch_messaging_class_limits
BEFORE UPDATE ON public.messaging_class_limits
FOR EACH ROW EXECUTE FUNCTION public.touch_messaging_class_limits();

-- 2. Per-class per-day counters (the reservation ledger)
CREATE TABLE IF NOT EXISTS public.messaging_send_counters (
  send_class text NOT NULL,
  send_date date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (send_class, send_date)
);
GRANT ALL ON public.messaging_send_counters TO service_role;
GRANT SELECT ON public.messaging_send_counters TO authenticated;
ALTER TABLE public.messaging_send_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read messaging send counters"
ON public.messaging_send_counters FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Per-campaign caps
CREATE TABLE IF NOT EXISTS public.messaging_campaign_caps (
  campaign_id uuid PRIMARY KEY,
  max_sends integer NOT NULL CHECK (max_sends >= 0),
  reserved integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'recipient_count',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.messaging_campaign_caps TO authenticated;
GRANT ALL ON public.messaging_campaign_caps TO service_role;
ALTER TABLE public.messaging_campaign_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage campaign caps"
ON public.messaging_campaign_caps FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. outbound_messages: class + last10
ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS send_class text;

ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (right(regexp_replace(to_number, '[^0-9]', '', 'g'), 10)) STORED;

CREATE INDEX IF NOT EXISTS idx_outbound_messages_class_created
  ON public.outbound_messages (send_class, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_last10_class
  ON public.outbound_messages (phone_last10, send_class, created_at DESC);

-- 5. Atomic reservation: claim a class slot (and a campaign slot) in one statement each
CREATE OR REPLACE FUNCTION public.reserve_sms_send(
  p_send_class text,
  p_campaign_id uuid DEFAULT NULL,
  p_campaign_max integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.messaging_class_limits%ROWTYPE;
  v_used integer;
  v_campaign_used integer;
BEGIN
  SELECT * INTO v_cfg FROM public.messaging_class_limits WHERE send_class = p_send_class;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unknown_class', 'send_class', p_send_class);
  END IF;
  IF NOT v_cfg.enabled THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'class_disabled', 'send_class', p_send_class);
  END IF;

  -- Per-campaign cap first: default to the caller-supplied recipient count.
  IF p_campaign_id IS NOT NULL THEN
    INSERT INTO public.messaging_campaign_caps (campaign_id, max_sends, reserved)
    VALUES (p_campaign_id, GREATEST(COALESCE(p_campaign_max, 0), 0), 0)
    ON CONFLICT (campaign_id) DO NOTHING;

    UPDATE public.messaging_campaign_caps
       SET reserved = reserved + 1, updated_at = now()
     WHERE campaign_id = p_campaign_id
       AND reserved < max_sends
    RETURNING reserved INTO v_campaign_used;

    IF v_campaign_used IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'campaign_cap_reached', 'campaign_id', p_campaign_id);
    END IF;
  END IF;

  -- Per-class daily budget: single atomic increment-and-check.
  INSERT INTO public.messaging_send_counters (send_class, send_date, used)
  VALUES (p_send_class, CURRENT_DATE, 0)
  ON CONFLICT (send_class, send_date) DO NOTHING;

  UPDATE public.messaging_send_counters
     SET used = used + 1, updated_at = now()
   WHERE send_class = p_send_class
     AND send_date = CURRENT_DATE
     AND used < v_cfg.daily_limit
  RETURNING used INTO v_used;

  IF v_used IS NULL THEN
    -- roll back the campaign claim so it isn't burned by a class-budget refusal
    IF p_campaign_id IS NOT NULL THEN
      UPDATE public.messaging_campaign_caps
         SET reserved = GREATEST(reserved - 1, 0), updated_at = now()
       WHERE campaign_id = p_campaign_id;
    END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'class_daily_limit_reached',
                              'send_class', p_send_class, 'daily_limit', v_cfg.daily_limit);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'send_class', p_send_class,
    'class_used', v_used,
    'class_limit', v_cfg.daily_limit,
    'campaign_used', v_campaign_used,
    'cooldown_minutes', v_cfg.cooldown_minutes,
    'cooldown_scope', v_cfg.cooldown_scope,
    'suppression_check', v_cfg.suppression_check
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_sms_send(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_sms_send(text, uuid, integer) TO service_role;

-- 6. Release a reservation when the provider refuses the message
CREATE OR REPLACE FUNCTION public.release_sms_reservation(
  p_send_class text,
  p_campaign_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messaging_send_counters
     SET used = GREATEST(used - 1, 0), updated_at = now()
   WHERE send_class = p_send_class AND send_date = CURRENT_DATE;

  IF p_campaign_id IS NOT NULL THEN
    UPDATE public.messaging_campaign_caps
       SET reserved = GREATEST(reserved - 1, 0), updated_at = now()
     WHERE campaign_id = p_campaign_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.release_sms_reservation(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_sms_reservation(text, uuid) TO service_role;

-- 7. Class-scoped cooldown check
CREATE OR REPLACE FUNCTION public.sms_cooldown_active(
  p_send_class text,
  p_to_number text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.messaging_class_limits%ROWTYPE;
  v_last10 text;
  v_hit boolean;
BEGIN
  SELECT * INTO v_cfg FROM public.messaging_class_limits WHERE send_class = p_send_class;
  IF NOT FOUND OR v_cfg.cooldown_scope = 'none' OR COALESCE(v_cfg.cooldown_minutes, 0) <= 0 THEN
    RETURN false;
  END IF;

  v_last10 := right(regexp_replace(COALESCE(p_to_number, ''), '[^0-9]', '', 'g'), 10);
  IF v_last10 IS NULL OR length(v_last10) < 10 THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.outbound_messages
     WHERE phone_last10 = v_last10
       AND send_class = p_send_class
       AND status IN ('sent','queued','pending')
       AND created_at >= now() - make_interval(mins => v_cfg.cooldown_minutes)
  ) INTO v_hit;

  RETURN COALESCE(v_hit, false);
END;
$$;

REVOKE ALL ON FUNCTION public.sms_cooldown_active(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_cooldown_active(text, text) TO service_role;