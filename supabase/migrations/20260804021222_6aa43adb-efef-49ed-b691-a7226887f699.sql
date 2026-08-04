-- opt_out_events.phone_number is targeted by ON CONFLICT in every STOP handler,
-- but no unique constraint exists -> Postgres 42P10, every opt-out write failed.
DELETE FROM public.opt_out_events a
USING public.opt_out_events b
WHERE a.ctid < b.ctid AND a.phone_number = b.phone_number;

ALTER TABLE public.opt_out_events
  ADD CONSTRAINT opt_out_events_phone_number_key UNIQUE (phone_number);

-- Data API grants (missing: PostgREST cannot reach the table at all today).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opt_out_events TO authenticated;
GRANT ALL ON public.opt_out_events TO service_role;

-- Existing policy is FOR ALL to authenticated admins/owners/VAs; keep it and
-- make the intent explicit for inserts by service-side STOP handlers.
DROP POLICY IF EXISTS "Service role manages opt outs" ON public.opt_out_events;
CREATE POLICY "Service role manages opt outs"
  ON public.opt_out_events
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ambassador_activity_log / dnc_list / ai_communication_queue: ensure the Data
-- API roles actually hold privileges (RLS alone is not enough).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dnc_list TO authenticated;
GRANT ALL ON public.dnc_list TO service_role;
GRANT SELECT, INSERT ON public.ambassador_activity_log TO authenticated;
GRANT ALL ON public.ambassador_activity_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.ai_communication_queue TO authenticated;
GRANT ALL ON public.ai_communication_queue TO service_role;