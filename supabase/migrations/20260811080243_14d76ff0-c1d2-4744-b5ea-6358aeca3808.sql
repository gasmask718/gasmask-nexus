ALTER TABLE public.sentinel_campaign_approvals
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approval_note text;

COMMENT ON COLUMN public.sentinel_campaign_approvals.approved_by IS
  'The human who approved this campaign. Required for any human approval; NULL is only permitted when approved_by_system = true, which must then carry an approval_note explaining the automatic path.';

CREATE INDEX IF NOT EXISTS idx_sentinel_campaign_approvals_approved_by
  ON public.sentinel_campaign_approvals (approved_by);

-- The table exists to record that a human reviewed a campaign before it sent.
-- A row with no human and no explicit system justification does not do that.
CREATE OR REPLACE FUNCTION public.sentinel_campaign_approval_requires_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.approved_by IS NULL THEN
    IF COALESCE(NEW.approved_by_system, false) IS NOT TRUE THEN
      RAISE EXCEPTION
        'sentinel_campaign_approvals.approved_by is required: a campaign approval must name the human who approved it';
    END IF;
    IF NEW.approval_note IS NULL OR btrim(NEW.approval_note) = '' THEN
      RAISE EXCEPTION
        'system approvals must set approval_note explaining the automatic approval path';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sentinel_campaign_approval_requires_actor ON public.sentinel_campaign_approvals;
CREATE TRIGGER trg_sentinel_campaign_approval_requires_actor
  BEFORE INSERT OR UPDATE ON public.sentinel_campaign_approvals
  FOR EACH ROW EXECUTE FUNCTION public.sentinel_campaign_approval_requires_actor();