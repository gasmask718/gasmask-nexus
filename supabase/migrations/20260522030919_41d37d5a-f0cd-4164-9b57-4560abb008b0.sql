
ALTER TABLE public.tt_dispatch_requests DROP CONSTRAINT IF EXISTS tt_dispatch_requests_status_check;
ALTER TABLE public.tt_dispatch_requests ADD CONSTRAINT tt_dispatch_requests_status_check
  CHECK (status = ANY (ARRAY['pending','sent','accepted','declined','expired','fulfilled','cancelled','awaiting_quote','needs_review','manual_queue']));
