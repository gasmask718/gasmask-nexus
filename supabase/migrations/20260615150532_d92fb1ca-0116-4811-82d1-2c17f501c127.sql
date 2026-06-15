CREATE OR REPLACE FUNCTION public.approve_ai_draft_invoice(p_invoice_id uuid, p_reviewer uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM invoices WHERE id = p_invoice_id;
  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  IF v_status <> 'draft_ai' THEN
    RETURN json_build_object('success', false, 'error', 'Invoice is not an AI draft', 'current_status', v_status);
  END IF;

  -- Flip status only. Line items (bag/tube split) are intentionally untouched.
  UPDATE invoices SET status = 'draft' WHERE id = p_invoice_id;

  UPDATE ai_backfill_items
    SET status = 'reviewed', reviewed_by = p_reviewer, reviewed_at = now()
    WHERE entity_type = 'invoice' AND entity_id = p_invoice_id;

  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id, 'new_status', 'draft');
END;
$function$;