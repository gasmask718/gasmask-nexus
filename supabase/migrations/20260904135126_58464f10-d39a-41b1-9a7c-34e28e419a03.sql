UPDATE public.user_invitations
SET metadata = metadata || jsonb_build_object(
  'va_company_memberships', jsonb_build_array(
    jsonb_build_object('company_id','316bf3a6-dabe-4592-8266-4528a496268f','is_primary',true),
    jsonb_build_object('company_id','582767f5-2461-4c80-bed5-f9f690622519','is_primary',false)
  ))
WHERE email = 'efrelynblessedbeyondmeasure@gmail.com' AND invite_status = 'sent';

UPDATE public.user_invitations
SET metadata = metadata || jsonb_build_object(
  'va_company_memberships', jsonb_build_array(
    jsonb_build_object('company_id','316bf3a6-dabe-4592-8266-4528a496268f','is_primary',true)
  ))
WHERE email = 'francescelis01@gmail.com' AND invite_status = 'sent';

INSERT INTO public.va_company_memberships (user_id, company_id, role, is_primary, is_active)
VALUES ('0eb78ad0-bbae-4791-a292-70ab0094ee59','316bf3a6-dabe-4592-8266-4528a496268f','va',true,true)
ON CONFLICT (user_id, company_id) DO NOTHING;