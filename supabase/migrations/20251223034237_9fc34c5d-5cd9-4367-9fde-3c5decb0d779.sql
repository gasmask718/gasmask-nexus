-- Fix function search path for update_conversation_memory_timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversation_memories
  SET 
    last_interaction_at = NEW.created_at,
    first_interaction_at = COALESCE(first_interaction_at, NEW.created_at),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  -- Add business to associated_businesses if not already there
  IF NEW.business_id IS NOT NULL THEN
    UPDATE public.conversation_memories
    SET associated_businesses = array_append(
      array_remove(associated_businesses, NEW.business_id),
      NEW.business_id
    )
    WHERE id = NEW.conversation_id
    AND NOT (NEW.business_id = ANY(associated_businesses));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;