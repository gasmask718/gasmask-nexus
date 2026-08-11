CREATE TABLE IF NOT EXISTS public.funding_strategy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order integer NOT NULL,
  step_key text NOT NULL UNIQUE,
  step_label text NOT NULL,
  funding_lane text,
  rationale text NOT NULL,
  prerequisite_step_keys text[] NOT NULL DEFAULT '{}',
  min_credit_score integer,
  min_time_in_business_months integer,
  min_monthly_revenue numeric,
  inquiry_sensitivity text NOT NULL DEFAULT 'medium',
  requires_personal_guarantee boolean NOT NULL DEFAULT false,
  requires_business_entity boolean NOT NULL DEFAULT false,
  requires_tradelines integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_strategy_rules TO authenticated;
GRANT ALL ON public.funding_strategy_rules TO service_role;

ALTER TABLE public.funding_strategy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funding staff can view strategy rules"
ON public.funding_strategy_rules FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'accountant')
);

CREATE POLICY "Funding admins can manage strategy rules"
ON public.funding_strategy_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_funding_strategy_rules_updated_at
BEFORE UPDATE ON public.funding_strategy_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.funding_strategy_rules
  (step_order, step_key, step_label, funding_lane, rationale, prerequisite_step_keys,
   min_credit_score, min_time_in_business_months, min_monthly_revenue,
   inquiry_sensitivity, requires_personal_guarantee, requires_business_entity, requires_tradelines)
VALUES
  (1,'business_foundation','Business Foundation','foundation',
   'Entity, EIN, business address, phone and bank account must exist before any business lender will underwrite the file.',
   '{}', NULL, NULL, NULL, 'none', false, false, 0),
  (2,'tradelines','Tradeline Requirement','foundation',
   'Business credit lenders price off reporting tradelines; applying before they report produces avoidable declines and hard inquiries.',
   '{business_foundation}', NULL, NULL, NULL, 'none', false, true, 0),
  (3,'credit_union','Credit Union Product','credit_union',
   'Credit unions pull the fewest inquiries and approve earliest, so they are used before inquiry-sensitive lenders see the report.',
   '{business_foundation}', 660, 0, NULL, 'low', true, true, 0),
  (4,'business_card','Business Card Stack','business_card',
   'Business cards are stacked after the first approval so existing limits support higher offers, and they do not report to personal utilisation.',
   '{business_foundation,credit_union}', 700, 6, NULL, 'high', true, true, 2),
  (5,'fintech','Fintech / Revenue Product','fintech',
   'Revenue-based fintech products underwrite on deposits rather than score, so they are held until bank data is clean and seasoned.',
   '{business_foundation}', NULL, 6, 10000, 'medium', false, true, 0),
  (6,'sba_alternative','SBA / Alternative Funding','sba',
   'SBA and alternative capital take the longest to close and require full financials, so they run last while faster lanes fund.',
   '{business_foundation,tradelines}', 680, 24, 20000, 'medium', true, true, 3)
ON CONFLICT (step_key) DO NOTHING;