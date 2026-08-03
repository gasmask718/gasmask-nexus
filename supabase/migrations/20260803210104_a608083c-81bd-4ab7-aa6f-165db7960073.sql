CREATE OR REPLACE FUNCTION public.guard_finalized_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merge_flag       text;
  v_store_id_changed boolean;
BEGIN
  IF TG_TABLE_NAME <> 'invoices' THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'finalized' THEN
    RETURN NEW;
  END IF;

  v_store_id_changed := NEW.store_id IS DISTINCT FROM OLD.store_id;

  IF v_store_id_changed THEN
    v_merge_flag := current_setting('app.merge_in_progress', true);

    IF v_merge_flag IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Finalized invoice store_id can only change inside the merge engine (app.merge_in_progress flag required).';
    END IF;

    IF to_jsonb(NEW) - 'store_id' <> to_jsonb(OLD) - 'store_id' THEN
      RAISE EXCEPTION
        'Merge bypass permits store_id changes only; other columns may not be modified in the same UPDATE.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status              IS DISTINCT FROM OLD.status
     OR NEW.voided_at        IS DISTINCT FROM OLD.voided_at
     OR NEW.void_reason      IS DISTINCT FROM OLD.void_reason
     OR NEW.voided_by        IS DISTINCT FROM OLD.voided_by
     OR NEW.payment_status   IS DISTINCT FROM OLD.payment_status
     OR NEW.amount_paid      IS DISTINCT FROM OLD.amount_paid
     OR NEW.paid_at          IS DISTINCT FROM OLD.paid_at
     OR NEW.partial_amount   IS DISTINCT FROM OLD.partial_amount
     OR NEW.receipt_sent_at  IS DISTINCT FROM OLD.receipt_sent_at
     OR NEW.receipt_status   IS DISTINCT FROM OLD.receipt_status
     OR NEW.receipt_message_sid    IS DISTINCT FROM OLD.receipt_message_sid
     OR NEW.receipt_delivered_at   IS DISTINCT FROM OLD.receipt_delivered_at
     OR NEW.receipt_failure_reason IS DISTINCT FROM OLD.receipt_failure_reason
     OR NEW.receipt_phone_used     IS DISTINCT FROM OLD.receipt_phone_used
     OR NEW.deleted_at       IS DISTINCT FROM OLD.deleted_at
     OR NEW.deleted_by       IS DISTINCT FROM OLD.deleted_by
     OR NEW.delete_reason    IS DISTINCT FROM OLD.delete_reason
     OR NEW.repair_status    IS DISTINCT FROM OLD.repair_status
     OR NEW.repair_notes     IS DISTINCT FROM OLD.repair_notes
     OR NEW.repaired_at      IS DISTINCT FROM OLD.repaired_at
     OR NEW.repaired_by      IS DISTINCT FROM OLD.repaired_by
     OR NEW.entry_mode       IS DISTINCT FROM OLD.entry_mode
     OR NEW.revenue_role     IS DISTINCT FROM OLD.revenue_role
     OR NEW.sale_never_imported IS DISTINCT FROM OLD.sale_never_imported
     OR NEW.referenced_external_number IS DISTINCT FROM OLD.referenced_external_number
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cannot modify a finalized invoice. Void it first to make corrections.';
END;
$function$;