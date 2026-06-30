
ALTER TABLE public.surplus_funds_leads DROP CONSTRAINT IF EXISTS surplus_funds_leads_status_check;
ALTER TABLE public.surplus_funds_leads ADD CONSTRAINT surplus_funds_leads_status_check
  CHECK (status = ANY (ARRAY['new','skip_trace_pending','phone_found','queued','called','interested','consultation_booked','agreement_signed','referred_to_attorney','case_filed','hearing_scheduled','approved','funds_released','closed','do_not_contact','cancelled']));

ALTER TABLE public.re_leads DROP CONSTRAINT IF EXISTS re_leads_status_check;
ALTER TABLE public.re_leads ADD CONSTRAINT re_leads_status_check
  CHECK (status = ANY (ARRAY['new','skip_trace_pending','phone_found','queued','called','interested','appointment_set','analyzed','offer_made','countering','under_contract','buyer_found','assigned','closed','dead','dnc','cancelled']));
