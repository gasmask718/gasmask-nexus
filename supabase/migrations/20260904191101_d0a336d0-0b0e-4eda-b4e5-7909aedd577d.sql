-- negative test: AI fully resolved => no notification
INSERT INTO public.inbound_call_outcomes (call_sid, kind, summary, reason_category, urgency, callback_requested, ai_resolved, caller_phone)
VALUES ('TEST_SID_VERIFY_3','note','Caller just wanted store hours','hours_or_location','low',false,true,'+15550002222');

-- cleanup all verification artifacts
DELETE FROM public.notifications
WHERE entity_id IN (SELECT id FROM public.inbound_call_outcomes WHERE call_sid LIKE 'TEST_SID_VERIFY_%');
DELETE FROM public.inbound_call_outcomes WHERE call_sid LIKE 'TEST_SID_VERIFY_%';