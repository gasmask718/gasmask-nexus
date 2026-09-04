INSERT INTO public.business_members (user_id, business_id, role)
SELECT bm.user_id, (SELECT id FROM public.businesses WHERE slug = 'grabba_r_us'), 'va'
FROM public.business_members bm
JOIN public.businesses b ON b.id = bm.business_id
WHERE b.slug = 'gasmask' AND bm.role = 'va'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_members x
    WHERE x.user_id = bm.user_id
      AND x.business_id = (SELECT id FROM public.businesses WHERE slug = 'grabba_r_us')
      AND x.role = 'va'
  );