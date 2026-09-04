-- Attach the GasMask toll-free number to the humans-first inbound engine.
update public.dc_phone_numbers
   set va_company_id = '316bf3a6-dabe-4592-8266-4528a496268f'
 where id = '6b2b8a0e-3474-48ae-902f-acae0736030f'
   and va_company_id is null;

-- Human ring targets: softphone seats for the configured GasMask callers.
-- No personal phone numbers are hard-coded; browser seats only ring when the
-- agent is marked available on shift.
insert into public.inbound_ring_targets (va_company_id, label, target_type, user_id, ring_order, active, only_business_hours)
select '316bf3a6-dabe-4592-8266-4528a496268f', v.label, 'browser', v.uid::uuid, 1, true, false
from (values
  ('Efrelyn (VA softphone)', 'fa706257-0997-4335-884c-a9558df5fec7'),
  ('Internal test VA (softphone)', '0eb78ad0-bbae-4791-a292-70ab0094ee59')
) as v(label, uid)
where not exists (
  select 1 from public.inbound_ring_targets t
   where t.va_company_id = '316bf3a6-dabe-4592-8266-4528a496268f'
     and t.user_id = v.uid::uuid
);

-- The owner mobile stays as the later escalation stage, not the first ring.
update public.inbound_ring_targets
   set ring_order = 2
 where id = 'b4b98678-510b-4ae8-a307-78aded658244';