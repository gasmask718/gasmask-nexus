ALTER FUNCTION public.create_ambassador_invite(text, text, uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_ambassador_invite(text, text, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.accept_ambassador_invite(text, uuid) SET search_path = public, extensions;