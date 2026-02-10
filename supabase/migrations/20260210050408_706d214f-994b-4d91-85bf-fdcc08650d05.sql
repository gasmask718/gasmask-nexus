
-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 8 — Territory Planning & Commitment Layer
-- Strategic intent declarations. No execution. No automation. Only authority.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Core commitment types
CREATE TYPE public.territory_commitment_type AS ENUM (
  'dominate',
  'maintain',
  'observe',
  'freeze',
  'exit'
);

-- Commitments table
CREATE TABLE public.territory_commitments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood_id UUID NOT NULL REFERENCES public.territory_neighborhoods(id) ON DELETE CASCADE,
  commitment_type public.territory_commitment_type NOT NULL,
  ai_allowed BOOLEAN NOT NULL DEFAULT false,
  human_only BOOLEAN NOT NULL DEFAULT false,
  no_outbound_contact BOOLEAN NOT NULL DEFAULT false,
  no_new_promotions BOOLEAN NOT NULL DEFAULT false,
  wholesaler_only_verification BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  review_date DATE NOT NULL,
  expiration_date DATE,
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  superseded_by UUID REFERENCES public.territory_commitments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable audit log
CREATE TABLE public.territory_commitment_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commitment_id UUID NOT NULL REFERENCES public.territory_commitments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_by UUID NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.territory_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_commitment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read commitments"
  ON public.territory_commitments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/admin can create commitments"
  ON public.territory_commitments FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owner/admin can update commitments"
  ON public.territory_commitments FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Authenticated users can read commitment audit"
  ON public.territory_commitment_audit FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/admin can create audit entries"
  ON public.territory_commitment_audit FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Triggers
CREATE TRIGGER update_territory_commitments_updated_at
  BEFORE UPDATE ON public.territory_commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.audit_commitment_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.territory_commitment_audit (commitment_id, action, changed_by, new_state, reason)
  VALUES (NEW.id, 'created', NEW.created_by, to_jsonb(NEW), NEW.reason);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_commitment_audit_insert
  AFTER INSERT ON public.territory_commitments
  FOR EACH ROW EXECUTE FUNCTION public.audit_commitment_insert();

CREATE OR REPLACE FUNCTION public.audit_commitment_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    INSERT INTO public.territory_commitment_audit (commitment_id, action, changed_by, previous_state, new_state, reason)
    VALUES (NEW.id, 'superseded', NEW.created_by, to_jsonb(OLD), to_jsonb(NEW), 'Superseded by new commitment');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_commitment_audit_update
  AFTER UPDATE ON public.territory_commitments
  FOR EACH ROW EXECUTE FUNCTION public.audit_commitment_update();

-- Indexes
CREATE INDEX idx_territory_commitments_neighborhood ON public.territory_commitments(neighborhood_id);
CREATE INDEX idx_territory_commitments_active ON public.territory_commitments(is_active) WHERE is_active = true;
CREATE INDEX idx_territory_commitment_audit_commitment ON public.territory_commitment_audit(commitment_id);
