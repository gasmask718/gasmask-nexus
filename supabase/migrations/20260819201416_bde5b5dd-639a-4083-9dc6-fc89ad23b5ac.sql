CREATE OR REPLACE FUNCTION public.brandaro_pending_stamp_campaign()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    NEW.campaign_id := md5(
      'brandaro-pending|' || coalesce(NEW.ai_agent, 'unknown') || '|' ||
      coalesce(NEW.created_at, now())::date::text
    )::uuid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brandaro_pending_stamp_campaign_trg ON public.brandaro_pending_messages;
CREATE TRIGGER brandaro_pending_stamp_campaign_trg
BEFORE INSERT ON public.brandaro_pending_messages
FOR EACH ROW EXECUTE FUNCTION public.brandaro_pending_stamp_campaign();