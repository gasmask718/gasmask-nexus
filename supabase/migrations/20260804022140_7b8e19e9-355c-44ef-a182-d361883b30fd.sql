ALTER TABLE public.ai_communication_queue
  DROP CONSTRAINT IF EXISTS ai_communication_queue_entity_type_check;

ALTER TABLE public.ai_communication_queue
  ADD CONSTRAINT ai_communication_queue_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    'store','contact','influencer','wholesaler','driver','ambassador',
    'invoice','inventory','risk','routine','order','task'
  ]));