
-- Remove forbidden FK to auth.users
ALTER TABLE public.cold_call_campaigns
  DROP CONSTRAINT IF EXISTS cold_call_campaigns_created_by_fkey;

-- Remove overly permissive policies
DROP POLICY IF EXISTS "Service role full access campaigns" ON public.cold_call_campaigns;
DROP POLICY IF EXISTS "Service role full access items" ON public.cold_call_items;

-- Lock policies to authenticated users (not PUBLIC)
ALTER POLICY "Users can view own campaigns" ON public.cold_call_campaigns TO authenticated;
ALTER POLICY "Users can create campaigns" ON public.cold_call_campaigns TO authenticated;
ALTER POLICY "Users can update own campaigns" ON public.cold_call_campaigns TO authenticated;

ALTER POLICY "Users can view items of own campaigns" ON public.cold_call_items TO authenticated;
ALTER POLICY "Users can insert items to own campaigns" ON public.cold_call_items TO authenticated;
ALTER POLICY "Users can update items of own campaigns" ON public.cold_call_items TO authenticated;

-- Storage: scope upload to authenticated role explicitly
ALTER POLICY "Authenticated users can upload cold call audio" ON storage.objects TO authenticated;
