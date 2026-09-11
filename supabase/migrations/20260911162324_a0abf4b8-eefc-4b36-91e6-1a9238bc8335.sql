
-- Territory coverage records (reuse existing ambassador_territory_coverage)
INSERT INTO public.ambassador_territory_coverage (ambassador_id, region_type, region_value, is_primary, updated_by)
VALUES
  ('903ecd8b-990f-456c-bdaf-18ef5f0b4317','city','Brooklyn, NY', true, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('546688e9-745f-421b-96f5-420250268348','city','Staten Island, NY', true, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('546688e9-745f-421b-96f5-420250268348','state','New Jersey', false, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('a1bcd0fe-dd98-40ad-ad91-257fca39bbe4','state','Connecticut', true, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('bec6d140-ec1b-4dc0-890c-6dc22f7a2f71','city','Bronx, NY', true, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('bec6d140-ec1b-4dc0-890c-6dc22f7a2f71','city','Mount Vernon, NY', false, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('587e8817-bc7e-447d-bf3e-fd2504a55aaf','state','Delaware', true, '6019a316-2d95-4662-997c-c47bd0b37697'),
  ('26a02f2b-19ea-4c41-aff7-57adb76a61e6','state','Florida', true, '6019a316-2d95-4662-997c-c47bd0b37697');

-- Brooklyn default ownership -> Ching's existing field identity.
-- Skips any store already actively assigned to anyone (no overwrite, no duplicates).
INSERT INTO public.ambassador_assignments
  (ambassador_id, store_id, assignment_type, active, start_date, created_by)
SELECT '903ecd8b-990f-456c-bdaf-18ef5f0b4317', sm.id, 'assigned', true, CURRENT_DATE,
       '6019a316-2d95-4662-997c-c47bd0b37697'
FROM public.store_master sm
WHERE sm.deleted_at IS NULL
  AND COALESCE(sm.is_simulation,false) = false
  AND (lower(COALESCE(sm.borough,'')) = 'brooklyn' OR lower(COALESCE(sm.city,'')) = 'brooklyn')
  AND NOT EXISTS (
    SELECT 1 FROM public.ambassador_assignments aa
    WHERE aa.store_id = sm.id AND aa.active = true AND aa.unassigned_at IS NULL
  );
