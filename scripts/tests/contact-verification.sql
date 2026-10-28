\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"6019a316-2d95-4662-997c-c47bd0b37697","role":"authenticated"}',true);
DO $$ DECLARE c uuid:='bee0fa3b-b536-4fb6-bebf-86a6b0a196d4'; s uuid:='8d962954-2466-4a72-b03f-7229a3ebd55b'; v uuid; a jsonb; n int; BEGIN
 SELECT count(*) INTO n FROM public.store_contacts WHERE store_id=s;
 v:=public.contact_verification_save(s,'Ching','owner','(718) 308-9391');
 IF v<>c OR (SELECT count(*) FROM public.store_contacts WHERE store_id=s)<>n THEN RAISE EXCEPTION 'Duplicate phone was inserted'; END IF;
 BEGIN UPDATE public.store_contacts SET number_verification_status='confirmed' WHERE id=c; RAISE EXCEPTION 'Direct confirmation accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Direct confirmation accepted' THEN RAISE; END IF; END;
 BEGIN PERFORM public.contact_verification_override(c,''); RAISE EXCEPTION 'Blank override accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Blank override accepted' THEN RAISE; END IF; END;
 PERFORM public.contact_verification_override(c,'QA rollback in-person verification');
 IF (SELECT number_verification_status FROM public.store_contacts WHERE id=c)='confirmed' THEN RAISE EXCEPTION 'Override became text verified'; END IF;
 a:=public.contact_verification_begin(c,'+18776818621',true);
 IF NOT (SELECT verification_auto_send_link FROM public.store_contacts WHERE id=c) THEN RAISE EXCEPTION 'Auto link default not on'; END IF;
 RAISE NOTICE 'PASS dedupe, confirmation guard, required override reason, non-text override, auto link ON';
END $$;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE c uuid:='bee0fa3b-b536-4fb6-bebf-86a6b0a196d4'; s uuid:='8d962954-2466-4a72-b03f-7229a3ebd55b'; b uuid; r jsonb; x text; BEGIN
 SELECT business_id INTO b FROM public.store_master WHERE id=s;
 BEGIN PERFORM public.contact_verification_claim_link(s,c,NULL,true); RAISE EXCEPTION 'Unconfirmed invite accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unconfirmed invite accepted' THEN RAISE; END IF; END;
 r:=public.contact_verification_receive('+17183089391','+19999999999','YES','SMqa',b);IF (r->>'matched')::boolean THEN RAISE EXCEPTION 'Wrong receiving number confirmed'; END IF;
 FOREACH x IN ARRAY ARRAY['YES','Y','yes','yeah','ok','confirmed'] LOOP
 UPDATE public.store_contacts SET number_verification_status='sent',number_verification_confirmed_at=NULL,verification_attempt_id=gen_random_uuid(),number_verification_sent_at=now(),portal_link_attempt_at=NULL,portal_link_status=NULL WHERE id=c;
 r:=public.contact_verification_receive('+1 (718) 308-9391','+18776818621',x,'SMqa-'||x,b);
 IF r->>'confirmed'<>'true' OR r->>'auto_send'<>'true' THEN RAISE EXCEPTION 'Affirmative reply failed: % %',x,r; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_contacts WHERE id=c AND number_verification_status='confirmed' AND number_verification_confirmed_at IS NOT NULL AND responsive_by_text=true AND last_text_received_at IS NOT NULL AND sms_opt_in_status='opted_in' AND sms_opt_in_source='in_person_verification') THEN RAISE EXCEPTION 'Confirmation fields missing'; END IF;
 END LOOP;
 IF (SELECT phone_verified_at FROM public.store_master WHERE id=s) IS NULL THEN RAISE EXCEPTION 'Store verification timestamp missing'; END IF;
 r:=public.contact_verification_claim_link(s,c,NULL,true);IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Confirmed auto-link not claimed %',r; END IF;
 r:=public.contact_verification_claim_link(s,c,NULL,true);IF r->>'already_attempted'<>'true' THEN RAISE EXCEPTION 'Duplicate auto-link claim accepted'; END IF;
 UPDATE public.store_contacts SET portal_link_attempt_at=NULL WHERE id=c;
 UPDATE public.store_master SET is_portal_test=false WHERE id=s;
 r:=public.contact_verification_claim_link(s,c,NULL,true);IF r->>'status'<>'ready_locked' THEN RAISE EXCEPTION 'Launch lock bypassed'; END IF;
 UPDATE public.store_master SET is_portal_test=true WHERE id=s;
 UPDATE public.store_contacts SET number_verification_status='sent',number_verification_sent_at=now(),verification_attempt_id=gen_random_uuid(),number_verification_confirmed_at=NULL WHERE id=c;
 PERFORM public.handle_sms_opt_out('+17183089391','QA STOP rollback');
 IF NOT EXISTS(SELECT 1 FROM public.dnc_list WHERE phone_number='+17183089391') OR NOT EXISTS(SELECT 1 FROM public.opt_out_events WHERE phone_number='+17183089391') THEN RAISE EXCEPTION 'STOP missing suppression records'; END IF;
 r:=public.contact_verification_receive('+17183089391','+18776818621','YES','SMqa-stop',b);
 IF coalesce((r->>'confirmed')::boolean,false) OR (SELECT sms_opt_in_status FROM public.store_contacts WHERE id=c)<>'opted_out' THEN RAISE EXCEPTION 'YES lifted STOP'; END IF;
 IF public.store_portal_is_live() THEN RAISE EXCEPTION 'Launch lock changed'; END IF;
 RAISE NOTICE 'PASS all YES variants, sender matching, timestamps/consent, auto-link claim/dedupe, launch OFF, STOP never lifted';
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
DO $$ BEGIN
 IF public.contact_verification_can_access('8d962954-2466-4a72-b03f-7229a3ebd55b') THEN RAISE EXCEPTION 'Outsider store access'; END IF;
 BEGIN PERFORM public.contact_verification_override('bee0fa3b-b536-4fb6-bebf-86a6b0a196d4','Outsider override'); RAISE EXCEPTION 'Outsider override accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Outsider override accepted' THEN RAISE; END IF; END;
 IF has_function_privilege('authenticated','public.contact_verification_receive(text,text,text,text,uuid)','execute') THEN RAISE EXCEPTION 'Browser can forge YES'; END IF;
 IF has_function_privilege('anon','public.contact_verification_contacts(uuid)','execute') THEN RAISE EXCEPTION 'Anon contact access'; END IF;
 RAISE NOTICE 'PASS outsider/anon isolation, admin-only override, no browser-forged YES';
END $$;
ROLLBACK;
