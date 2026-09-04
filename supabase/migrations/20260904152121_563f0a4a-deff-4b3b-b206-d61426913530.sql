-- 1) Reusable fix: one live invite per email. A new invite supersedes older open ones.
CREATE OR REPLACE FUNCTION public.supersede_open_user_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_invitations
     SET invite_status = 'revoked'
   WHERE lower(email) = lower(NEW.email)
     AND id <> NEW.id
     AND invite_status = 'sent';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_open_user_invitations ON public.user_invitations;
CREATE TRIGGER trg_supersede_open_user_invitations
AFTER INSERT ON public.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.supersede_open_user_invitations();

-- 2) Correct the damaged account (Efrelyn) to the role the VA invite intended.
DELETE FROM public.user_roles
 WHERE user_id = 'fa706257-0997-4335-884c-a9558df5fec7'
   AND role IN ('admin','pending');

INSERT INTO public.user_roles (user_id, role)
VALUES ('fa706257-0997-4335-884c-a9558df5fec7', 'va')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
   SET role = 'va', updated_at = now()
 WHERE id = 'fa706257-0997-4335-884c-a9558df5fec7';

INSERT INTO public.business_members (business_id, user_id, role)
VALUES
  ('c3d4e5f6-a7b8-9012-cdef-123456789012','fa706257-0997-4335-884c-a9558df5fec7','va'),
  ('377370de-8a47-4d70-837d-c9f0d877fc91','fa706257-0997-4335-884c-a9558df5fec7','va')
ON CONFLICT (business_id, user_id) DO NOTHING;

INSERT INTO public.va_company_memberships (user_id, company_id, role, is_primary, is_active)
VALUES
  ('fa706257-0997-4335-884c-a9558df5fec7','316bf3a6-dabe-4592-8266-4528a496268f','va',true,true),
  ('fa706257-0997-4335-884c-a9558df5fec7','582767f5-2461-4c80-bed5-f9f690622519','va',false,true)
ON CONFLICT (user_id, company_id) DO UPDATE
  SET is_active = true, role = 'va';

INSERT INTO public.dialer_agent_availability (user_id, business_id, status, max_concurrent_calls, base_max_concurrent)
VALUES ('fa706257-0997-4335-884c-a9558df5fec7','c3d4e5f6-a7b8-9012-cdef-123456789012','offline',1,1)
ON CONFLICT (user_id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- 3) Invite bookkeeping: the VA invite is the one that now reflects reality.
UPDATE public.user_invitations
   SET invite_status = 'accepted',
       accepted_at = now(),
       accepted_user_id = 'fa706257-0997-4335-884c-a9558df5fec7'
 WHERE id = 'ece6920b-654e-48b8-824d-88400ef0d91e';

UPDATE public.user_invitations
   SET invite_status = 'revoked'
 WHERE id = 'c9247af3-4dd4-4bc7-9b71-f92367cc2164';
