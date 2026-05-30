-- Add explicit "payment choice made" flag so brand relationships can sit in
-- a "Neither / Not set" state (#52/53) until a rep actually picks
-- pay_upfront or bill_to_bill.
ALTER TABLE public.store_brand_relationships
  ADD COLUMN IF NOT EXISTS payment_type_chosen boolean NOT NULL DEFAULT false;

-- Backfill: rows that already have a non-default value or were explicitly
-- updated since seeding are treated as chosen. Conservative: only mark
-- chosen when updated_at differs from created_at (i.e. someone touched it).
UPDATE public.store_brand_relationships
   SET payment_type_chosen = true
 WHERE payment_type_chosen = false
   AND updated_at IS NOT NULL
   AND created_at IS NOT NULL
   AND updated_at > created_at + interval '1 second';
