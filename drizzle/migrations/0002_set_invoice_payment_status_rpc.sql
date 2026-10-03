CREATE OR REPLACE FUNCTION public.set_invoice_payment_status(_invoice_id uuid, _status text)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.invoices;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _status NOT IN ('paid','unpaid') THEN
    RAISE EXCEPTION 'Invalid payment status: %', _status;
  END IF;

  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF NOT (public.is_owner(_uid) OR public.is_admin(_uid) OR public.is_elevated_user(_uid)
          OR (_inv.store_id IS NOT NULL AND public.ambassador_has_store_access(_uid, _inv.store_id))) THEN
    RAISE EXCEPTION 'You do not have permission to update payment on this invoice';
  END IF;

  IF _inv.payment_status = 'voided' THEN
    RAISE EXCEPTION 'Voided invoices cannot be paid';
  END IF;

  UPDATE public.invoices
     SET payment_status = _status,
         paid_at = CASE WHEN _status = 'paid' THEN now() ELSE NULL END,
         amount_paid = CASE WHEN _status = 'paid' THEN COALESCE(total_amount, amount_paid) ELSE 0 END
   WHERE id = _invoice_id
  RETURNING * INTO _inv;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice update did not apply';
  END IF;
  RETURN _inv;
END;
$$;

REVOKE ALL ON FUNCTION public.set_invoice_payment_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_payment_status(uuid, text) TO authenticated;