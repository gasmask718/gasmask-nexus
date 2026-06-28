CREATE OR REPLACE FUNCTION public.check_partner_blackout_overlap(
  p_partner_id UUID,
  p_booking_start DATE,
  p_booking_end DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_blackout_dates
    WHERE partner_id = p_partner_id
      AND start_date <= p_booking_end
      AND end_date   >= p_booking_start
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_partner_blackout_overlap(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_partner_blackout_overlap(UUID, DATE, DATE) TO service_role;