GRANT SELECT ON public.ut_coverage_by_metro TO authenticated;

CREATE OR REPLACE VIEW public.ut_coverage_by_metro_category
WITH (security_invoker = true) AS
  SELECT c.metro_id, c.metro_name, b.category, b.source, count(b.id) AS n
    FROM public.ut_metro_centroids c
    JOIN public.business_leads b
      ON b.business = 'ut' AND b.duplicate_of IS NULL AND b.metro = c.metro_name
   GROUP BY c.metro_id, c.metro_name, b.category, b.source;

GRANT SELECT ON public.ut_coverage_by_metro_category TO authenticated;