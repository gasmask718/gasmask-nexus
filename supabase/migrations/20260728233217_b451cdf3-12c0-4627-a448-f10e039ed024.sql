CREATE OR REPLACE FUNCTION public.protect_tube_sale_ledger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_merge_flag       text;
  v_invoice_flag     text;
  v_store_id_changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only the audited invoice-deletion routine may remove ledger rows,
    -- and only the rows belonging to the invoice being deleted.
    v_invoice_flag := current_setting('app.invoice_delete_in_progress', true);
    IF v_invoice_flag IS NOT NULL
       AND OLD.invoice_id IS NOT NULL
       AND v_invoice_flag = OLD.invoice_id::text THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'tube_sale_ledger is immutable: DELETE operations are not allowed';
  END IF;

  v_store_id_changed := NEW.store_id IS DISTINCT FROM OLD.store_id;

  IF v_store_id_changed THEN
    v_merge_flag := current_setting('app.merge_in_progress', true);

    IF v_merge_flag IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'tube_sale_ledger.store_id can only change inside the merge engine (app.merge_in_progress flag required).';
    END IF;

    IF to_jsonb(NEW) - 'store_id' <> to_jsonb(OLD) - 'store_id' THEN
      RAISE EXCEPTION
        'Merge bypass permits store_id changes only; other columns may not be modified in the same UPDATE on tube_sale_ledger.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'tube_sale_ledger is immutable: % operations are not allowed', TG_OP;
END;
$function$;

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

  -- Scoped, audited ledger bypass: only this invoice's rows.
  PERFORM set_config('app.invoice_delete_in_progress', p_invoice_id::text, true);

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

  PERFORM set_config('app.invoice_delete_in_progress', '', true);

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