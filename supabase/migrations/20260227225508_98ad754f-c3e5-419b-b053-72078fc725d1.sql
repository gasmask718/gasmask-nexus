-- Trigger function: auto-create live_calls when outbound_call_queue gets an INSERT
CREATE OR REPLACE FUNCTION public.fn_auto_create_live_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.live_calls (
    business_id,
    store_id,
    phone_number,
    agent_type,
    voice_provider,
    state,
    entity_name,
    source_reason,
    started_at,
    metadata
  ) VALUES (
    NEW.business_id,
    NEW.store_id,
    NEW.phone_number,
    COALESCE((NEW.metadata->>'route_mode'), 'human'),
    NEW.voice_provider,
    'queued',
    NEW.contact_name,
    COALESCE(NEW.source_reason, 'auto_dialer'),
    COALESCE(NEW.created_at, now()),
    jsonb_build_object(
      'queue_id', NEW.id,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'campaign_id', NEW.campaign_id
    )
  );
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_create_live_call ON public.outbound_call_queue;
CREATE TRIGGER trg_auto_create_live_call
  AFTER INSERT ON public.outbound_call_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_create_live_call();

-- Backfill: create live_calls for existing queued items that have no observability
INSERT INTO public.live_calls (business_id, store_id, phone_number, agent_type, state, entity_name, source_reason, started_at, metadata)
SELECT 
  q.business_id,
  q.store_id,
  q.phone_number,
  'human',
  'queued',
  q.contact_name,
  COALESCE(q.source_reason, 'auto_dialer'),
  q.created_at,
  jsonb_build_object('queue_id', q.id, 'backfilled', true)
FROM public.outbound_call_queue q
LEFT JOIN public.live_calls lc ON lc.phone_number = q.phone_number AND lc.business_id = q.business_id AND lc.state = 'queued'
WHERE q.status = 'queued'
  AND lc.id IS NULL;