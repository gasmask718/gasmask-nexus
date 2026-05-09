CREATE OR REPLACE VIEW public.v_va_address_call_queue AS
SELECT
  q.store_id,
  s.store_name,
  s.phone,
  v.lifetime_tubes_delivered,
  q.priority,
  q.status,
  q.reason,
  (
    SELECT array_agg(LEFT(note_text, 200) ORDER BY created_at DESC)
    FROM (
      SELECT note_text, created_at
      FROM public.store_notes
      WHERE store_id = q.store_id
        AND note_text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 3
    ) recent
  ) AS recent_notes_preview
FROM public.field_capture_queue q
JOIN public.store_master s ON s.id = q.store_id
LEFT JOIN public.v_reactivation_targets v ON v.store_id = s.id
WHERE q.reason = 'phone_call_address_resolution'
  AND q.status IN ('pending','assigned')
ORDER BY q.priority DESC NULLS LAST;

GRANT SELECT ON public.v_va_address_call_queue TO authenticated;