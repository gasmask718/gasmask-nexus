CREATE OR REPLACE FUNCTION public.mirror_outbound_message_to_comm_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_logs
      SET delivery_status = NEW.status,
          error_code = NEW.error_code,
          error_message = NEW.error_message,
          provider_message_id = NEW.provider_message_id,
          sent_at = NEW.sent_at
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.communication_logs (
    id, store_id, channel, direction, summary, message_content, recipient_phone,
    delivery_status, provider, provider_message_id, error_code, error_message,
    campaign_id, metadata, message_hash, idempotency_key, sent_at, created_at,
    performed_by, event_type
  )
  SELECT
    NEW.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id) THEN NEW.store_id END,
    'sms', 'outbound',
    COALESCE(NULLIF(left(NEW.message_body, 140), ''), 'Outbound SMS'),
    NEW.message_body, NEW.to_number, NEW.status, NEW.provider::text,
    NEW.provider_message_id, NEW.error_code, NEW.error_message, NEW.campaign_id,
    COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('migrated_from','outbound_messages'),
    NEW.message_hash, NEW.idempotency_key, NEW.sent_at, NEW.created_at,
    'system', 'sms_outbound'
  WHERE NOT EXISTS (SELECT 1 FROM public.communication_logs cl WHERE cl.id = NEW.id)
    AND (NEW.idempotency_key IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.communication_logs c2 WHERE c2.idempotency_key = NEW.idempotency_key))
    AND (NEW.provider_message_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.communication_logs c3 WHERE c3.twilio_sid = NEW.provider_message_id));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mirror_communication_message_to_comm_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.communication_logs
      SET delivery_status = NEW.status,
          error_code = NEW.error_code,
          error_message = NEW.error_message,
          sentiment = NEW.sentiment
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.communication_logs (
    id, store_id, contact_id, channel, direction, summary, message_content,
    recipient_phone, sender_phone, delivery_status, provider, provider_message_id,
    error_code, error_message, cost_amount, media_urls, metadata, sentiment,
    ai_assisted, idempotency_key, created_at, performed_by, event_type
  )
  SELECT
    NEW.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id) THEN NEW.store_id END,
    NEW.contact_id,
    CASE WHEN COALESCE(NEW.channel,'sms') = ANY (ARRAY['call','sms','email','whatsapp','in-person','note','visit','mission','ai_call','voice'])
         THEN NEW.channel ELSE 'sms' END,
    CASE WHEN NEW.direction IN ('inbound','outbound') THEN NEW.direction ELSE 'outbound' END,
    COALESCE(NULLIF(left(NEW.content, 140), ''), 'SMS message'),
    NEW.content,
    COALESCE(NEW.to_number, CASE WHEN NEW.direction = 'outbound' THEN NEW.phone_number END),
    COALESCE(NEW.from_number, CASE WHEN NEW.direction = 'inbound' THEN NEW.phone_number END),
    NEW.status, NEW.provider::text, NEW.provider_message_id,
    NEW.error_code, NEW.error_message, NEW.cost_amount, NEW.media_urls,
    COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('migrated_from','communication_messages','business_id',NEW.business_id,'actor_type',NEW.actor_type),
    NEW.sentiment, COALESCE(NEW.ai_generated,false), NEW.idempotency_key, NEW.created_at,
    CASE WHEN COALESCE(NEW.ai_generated,false) THEN 'ai' ELSE 'system' END,
    'sms_' || COALESCE(NEW.direction,'outbound')
  WHERE NOT EXISTS (SELECT 1 FROM public.communication_logs cl WHERE cl.id = NEW.id)
    AND (NEW.idempotency_key IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.communication_logs c2 WHERE c2.idempotency_key = NEW.idempotency_key))
    AND (NEW.provider_message_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.communication_logs c3 WHERE c3.twilio_sid = NEW.provider_message_id));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mirror_communication_event_to_comm_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.communication_logs (
    id, store_id, channel, direction, summary, event_type,
    linked_entity_type, linked_entity_id, metadata, created_at, performed_by
  )
  SELECT
    NEW.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.stores s WHERE s.id = NEW.store_id) THEN NEW.store_id END,
    CASE WHEN COALESCE(NEW.channel,'note') = ANY (ARRAY['call','sms','email','whatsapp','in-person','note','visit','mission','ai_call','voice'])
         THEN NEW.channel ELSE 'note' END,
    CASE WHEN NEW.direction IN ('inbound','outbound') THEN NEW.direction ELSE 'system' END,
    COALESCE(NULLIF(NEW.summary,''), COALESCE(NEW.event_type,'Communication event')),
    COALESCE(NEW.event_type,'event'),
    NEW.linked_entity_type, NEW.linked_entity_id,
    COALESCE(NEW.payload,'{}'::jsonb) || jsonb_build_object('migrated_from','communication_events','external_contact',NEW.external_contact,'user_id',NEW.user_id),
    NEW.created_at, 'system'
  WHERE NOT EXISTS (SELECT 1 FROM public.communication_logs cl WHERE cl.id = NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_outbound_messages ON public.outbound_messages;
CREATE TRIGGER trg_mirror_outbound_messages
  AFTER INSERT OR UPDATE ON public.outbound_messages
  FOR EACH ROW EXECUTE FUNCTION public.mirror_outbound_message_to_comm_log();

DROP TRIGGER IF EXISTS trg_mirror_communication_messages ON public.communication_messages;
CREATE TRIGGER trg_mirror_communication_messages
  AFTER INSERT OR UPDATE ON public.communication_messages
  FOR EACH ROW EXECUTE FUNCTION public.mirror_communication_message_to_comm_log();

DROP TRIGGER IF EXISTS trg_mirror_communication_events ON public.communication_events;
CREATE TRIGGER trg_mirror_communication_events
  AFTER INSERT ON public.communication_events
  FOR EACH ROW EXECUTE FUNCTION public.mirror_communication_event_to_comm_log();