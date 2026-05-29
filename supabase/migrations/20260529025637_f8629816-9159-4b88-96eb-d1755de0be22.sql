-- =====================================================================
-- MIGRATION 1: Audit table + revised finalized-invoice guard trigger.
-- No data writes. No engine changes. Behavior is gated by
-- app.merge_in_progress, which no existing code sets.
-- =====================================================================

-- 1) Audit table for invoice repoints during store merges
CREATE TABLE public.merge_invoice_repoint_log (
  id                  bigserial   PRIMARY KEY,
  invoice_id          uuid        NOT NULL,
  original_store_id   uuid        NOT NULL,
  new_store_id        uuid        NOT NULL,
  new_store_name      text,
  was_finalized       boolean     NOT NULL,
  invoice_status      text        NOT NULL,
  invoice_total       numeric,
  merge_session_id    uuid        NOT NULL,
  duplicate_group_id  integer,
  session_label       text,
  merged_at           timestamptz NOT NULL DEFAULT now(),
  merged_by           uuid
);

CREATE INDEX idx_mirl_invoice_id     ON public.merge_invoice_repoint_log(invoice_id);
CREATE INDEX idx_mirl_session_id     ON public.merge_invoice_repoint_log(merge_session_id);
CREATE INDEX idx_mirl_original_store ON public.merge_invoice_repoint_log(original_store_id);
CREATE INDEX idx_mirl_new_store      ON public.merge_invoice_repoint_log(new_store_id);

GRANT ALL ON public.merge_invoice_repoint_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.merge_invoice_repoint_log_id_seq TO service_role;

ALTER TABLE public.merge_invoice_repoint_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view repoint log"
  ON public.merge_invoice_repoint_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Revised finalized-invoice guard.
--    store_id-change branch evaluated FIRST. Allowlist cannot be an escape hatch.
--    Bypass requires app.merge_in_progress='true' AND zero non-store_id column changes.
CREATE OR REPLACE FUNCTION public.guard_finalized_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_merge_flag       text;
  v_store_id_changed boolean;
BEGIN
  IF TG_TABLE_NAME <> 'invoices' THEN
    RETURN NEW;
  END IF;

  -- Drafts and non-finalized rows: unchanged behavior.
  IF OLD.status <> 'finalized' THEN
    RETURN NEW;
  END IF;

  v_store_id_changed := NEW.store_id IS DISTINCT FROM OLD.store_id;

  -- ============================================================
  -- store_id-change branch (evaluated first; no allowlist bypass)
  -- ============================================================
  IF v_store_id_changed THEN
    v_merge_flag := current_setting('app.merge_in_progress', true);

    IF v_merge_flag IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION
        'Finalized invoice store_id can only change inside the merge engine (app.merge_in_progress flag required).';
    END IF;

    -- Strict: only store_id may differ. Compare rows with store_id stripped.
    IF to_jsonb(NEW) - 'store_id' <> to_jsonb(OLD) - 'store_id' THEN
      RAISE EXCEPTION
        'Merge bypass permits store_id changes only; other columns may not be modified in the same UPDATE.';
    END IF;

    RETURN NEW;
  END IF;

  -- ============================================================
  -- store_id unchanged → original allowlist for finalized rows
  -- ============================================================
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
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cannot modify a finalized invoice. Void it first to make corrections.';
END;
$function$;