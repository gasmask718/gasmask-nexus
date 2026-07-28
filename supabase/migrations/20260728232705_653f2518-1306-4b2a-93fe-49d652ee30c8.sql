CREATE OR REPLACE FUNCTION public.delete_invoice_cascade(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_tube int := 0;
  v_bag int := 0;
  v_pay int := 0;
  v_txn int := 0;
  v_task int := 0;
BEGIN
  IF NOT (public.is_owner(auth.uid()) OR public.is_admin(auth.uid()) OR public.is_elevated_user(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to delete invoices';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.invoices WHERE id = p_invoice_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  DELETE FROM public.tube_sale_ledger WHERE invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_tube = ROW_COUNT;

  DELETE FROM public.bag_sale_ledger WHERE invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_bag = ROW_COUNT;

  DELETE FROM public.store_payments WHERE invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_pay = ROW_COUNT;

  DELETE FROM public.store_transactions WHERE invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_txn = ROW_COUNT;

  UPDATE public.delivery_tasks SET invoice_id = NULL WHERE invoice_id = p_invoice_id;
  GET DIAGNOSTICS v_task = ROW_COUNT;

  UPDATE public.inventory_repair_ledger SET invoice_id = NULL WHERE invoice_id = p_invoice_id;
  UPDATE public.historical_invoice_repairs SET invoice_id = NULL WHERE invoice_id = p_invoice_id;
  UPDATE public.historical_invoice_line_repairs SET invoice_id = NULL WHERE invoice_id = p_invoice_id;

  DELETE FROM public.invoices WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'tube_sale_ledger_deleted', v_tube,
    'bag_sale_ledger_deleted', v_bag,
    'store_payments_deleted', v_pay,
    'store_transactions_deleted', v_txn,
    'delivery_tasks_unlinked', v_task
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_invoice_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_invoice_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invoice_cascade(uuid) TO service_role;