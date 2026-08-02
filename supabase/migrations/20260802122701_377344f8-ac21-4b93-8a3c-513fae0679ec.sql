CREATE TABLE public.commission_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','category','seller','order')),
  scope_id text,
  rate_pct numeric(6,3) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  effective_from timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  note text,
  needs_confirmation boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rates_scope_id_shape CHECK (
    (scope = 'platform' AND scope_id IS NULL) OR (scope <> 'platform' AND scope_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX commission_rates_platform_uniq
  ON public.commission_rates (effective_from) WHERE scope = 'platform' AND active;
CREATE UNIQUE INDEX commission_rates_scoped_uniq
  ON public.commission_rates (scope, scope_id, effective_from) WHERE active;

CREATE TABLE public.commission_rate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id uuid,
  action text NOT NULL,
  scope text,
  scope_id text,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rates TO authenticated;
GRANT ALL ON public.commission_rates TO service_role;
GRANT SELECT ON public.commission_rate_audit TO authenticated;
GRANT ALL ON public.commission_rate_audit TO service_role;

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rate_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission rates" ON public.commission_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "Admins read commission rate audit" ON public.commission_rate_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE OR REPLACE FUNCTION public.commission_rates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commission_rates_updated_at
  BEFORE UPDATE ON public.commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.commission_rates_set_updated_at();

CREATE OR REPLACE FUNCTION public.commission_rates_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_rate_audit(rate_id, action, scope, scope_id, new_values, changed_by)
    VALUES (NEW.id,'INSERT',NEW.scope,NEW.scope_id,to_jsonb(NEW),COALESCE(NEW.updated_by, auth.uid()));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.commission_rate_audit(rate_id, action, scope, scope_id, old_values, new_values, changed_by)
    VALUES (NEW.id,'UPDATE',NEW.scope,NEW.scope_id,to_jsonb(OLD),to_jsonb(NEW),COALESCE(NEW.updated_by, auth.uid()));
    RETURN NEW;
  ELSE
    INSERT INTO public.commission_rate_audit(rate_id, action, scope, scope_id, old_values, changed_by)
    VALUES (OLD.id,'DELETE',OLD.scope,OLD.scope_id,to_jsonb(OLD),auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER commission_rates_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.commission_rates_audit();

-- Single source of truth resolver
CREATE OR REPLACE FUNCTION public.get_commission_rate(
  p_seller_id uuid DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_at timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rate_pct FROM public.commission_rates
  WHERE active
    AND effective_from <= p_at
    AND (
      (scope = 'order'    AND p_order_id  IS NOT NULL AND scope_id = p_order_id::text) OR
      (scope = 'seller'   AND p_seller_id IS NOT NULL AND scope_id = p_seller_id::text) OR
      (scope = 'category' AND p_category_id IS NOT NULL AND scope_id = p_category_id) OR
      (scope = 'platform')
    )
  ORDER BY CASE scope WHEN 'order' THEN 1 WHEN 'seller' THEN 2 WHEN 'category' THEN 3 ELSE 4 END,
           effective_from DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_commission_rate(uuid, text, uuid, timestamptz) TO authenticated, service_role, anon;

INSERT INTO public.commission_rates (scope, scope_id, rate_pct, note, needs_confirmation)
VALUES ('platform', NULL, 15.000, 'TEMPORARY PLACEHOLDER — awaiting David''s confirmed platform commission %', true);