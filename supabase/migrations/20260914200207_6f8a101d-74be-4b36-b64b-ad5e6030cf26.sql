ALTER TABLE public.business_leads DROP CONSTRAINT business_leads_business_known;
ALTER TABLE public.business_leads ADD CONSTRAINT business_leads_business_known
  CHECK (business = ANY (ARRAY['ut','toptier','dynasty','brandaro','gasmask','surplus','brightsun','playboxxx','shared','services_io','goddess_in_you']));