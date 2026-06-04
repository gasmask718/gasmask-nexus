
CREATE OR REPLACE FUNCTION public.snapshot_batch_cost_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.batch_cost_history WHERE batch_id = NEW.id) THEN
      INSERT INTO public.batch_cost_history (
        batch_id, office_id, product_type, boxes_produced,
        tobacco_cost, packaging_cost, labor_cost, overhead_cost,
        total_batch_cost, cost_per_box, is_immutable, version,
        bag_weight_grams
      ) VALUES (
        NEW.id,
        NEW.office_id,
        COALESCE(NEW.product_type, 'tubes'),
        COALESCE(NEW.boxes_produced, 0),
        0, 0, 0, 0, 0, 0,
        true, 1,
        NEW.bag_weight_grams
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
