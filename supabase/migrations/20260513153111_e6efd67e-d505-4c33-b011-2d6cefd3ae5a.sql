-- Short links table for SMS payment URL shortening
CREATE TABLE IF NOT EXISTS public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  target_url text NOT NULL,
  kind text NOT NULL DEFAULT 'payment',
  invoice_id uuid,
  lead_id uuid,
  session_id uuid,
  created_by uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  click_count integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON public.short_links(code);
CREATE INDEX IF NOT EXISTS idx_short_links_invoice_id ON public.short_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_short_links_lead_id ON public.short_links(lead_id);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- No direct table access from clients; resolution & creation happen via SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Creators can read own short links" ON public.short_links;
CREATE POLICY "Creators can read own short links"
  ON public.short_links
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Mint a short link (returns code). Service role / authed users may call.
CREATE OR REPLACE FUNCTION public.create_short_link(
  p_target_url text,
  p_kind text DEFAULT 'payment',
  p_invoice_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
  v_alphabet text := 'abcdefghijkmnpqrstuvwxyz23456789';
  v_uid uuid := auth.uid();
BEGIN
  IF p_target_url IS NULL OR length(trim(p_target_url)) = 0 THEN
    RAISE EXCEPTION 'target_url is required';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.short_links (
        code, target_url, kind, invoice_id, lead_id, session_id,
        created_by, context, expires_at
      ) VALUES (
        v_code, p_target_url, COALESCE(p_kind, 'payment'),
        p_invoice_id, p_lead_id, p_session_id,
        v_uid, COALESCE(p_context, '{}'::jsonb), p_expires_at
      );
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 8 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_short_link(text, text, uuid, uuid, uuid, jsonb, timestamptz) TO anon, authenticated;

-- Resolve a short link (public). Increments click counter.
CREATE OR REPLACE FUNCTION public.resolve_short_link(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text;
  v_expires timestamptz;
BEGIN
  SELECT target_url, expires_at INTO v_target, v_expires
  FROM public.short_links
  WHERE code = p_code;

  IF v_target IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.short_links
     SET click_count = click_count + 1,
         last_clicked_at = now()
   WHERE code = p_code;

  RETURN v_target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_short_link(text) TO anon, authenticated;