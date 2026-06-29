-- Phase 2.1: drop old CHECK
ALTER TABLE public.va_call_logs DROP CONSTRAINT IF EXISTS va_call_logs_disposition_check;

-- Phase 2.2: backfill lowercase → UPPER_SNAKE
UPDATE public.va_call_logs SET disposition = 'CALL_BACK'           WHERE disposition = 'callback';
UPDATE public.va_call_logs SET disposition = 'OWNER_NOT_AVAILABLE' WHERE disposition = 'no_answer';
UPDATE public.va_call_logs SET disposition = 'NOT_INTERESTED'      WHERE disposition = 'not_interested';
-- Defensive: also map any other legacy lowercase codes that could exist in flight
UPDATE public.va_call_logs SET disposition = 'ORDER_PLACED'        WHERE disposition = 'closed';
UPDATE public.va_call_logs SET disposition = 'DO_NOT_CALL'         WHERE disposition = 'dnc';
UPDATE public.va_call_logs SET disposition = NULL                  WHERE disposition = 'voicemail';

-- Phase 2.3: new CHECK enforcing canonical 9-code set
ALTER TABLE public.va_call_logs
  ADD CONSTRAINT va_call_logs_disposition_check
  CHECK (disposition IS NULL OR disposition IN (
    'ALREADY_SUPPLIED','CALL_BACK','DO_NOT_CALL','INTERESTED',
    'NEEDS_SAMPLES','NOT_INTERESTED','ORDER_PLACED',
    'OWNER_NOT_AVAILABLE','WRONG_NUMBER'
  ));