CREATE OR REPLACE FUNCTION public.sf_lead_summary(_states text[] DEFAULT NULL::text[], _amount_min numeric DEFAULT NULL::numeric, _amount_max numeric DEFAULT NULL::numeric, _skip_status text DEFAULT NULL::text, _status text DEFAULT NULL::text, _source text DEFAULT NULL::text, _search text DEFAULT NULL::text)
 RETURNS TABLE(total_leads bigint, distinct_states bigint, total_surplus numeric, avg_surplus numeric, skip_pending_count bigint, skip_traced_count bigint, skip_failed_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      l.state,
      COALESCE(l.surplus_amount, 0)::numeric AS surplus_amount,
      CASE
        WHEN l.status = 'skip_trace_failed' THEN 'failed'
        WHEN l.skip_traced = true THEN 'traced'
        WHEN l.status IN ('phone_found','queued','called','interested','consultation_booked','agreement_signed','referred_to_attorney','case_filed','hearing_scheduled','approved','funds_released','closed') THEN 'traced'
        WHEN COALESCE(NULLIF(l.phone,''), NULLIF(l.email,'')) IS NOT NULL THEN 'traced'
        ELSE 'pending'
      END AS skip_status
    FROM public.surplus_funds_leads l
    WHERE
      (_states IS NULL OR array_length(_states, 1) IS NULL OR l.state = ANY(_states))
      AND (_amount_min IS NULL OR COALESCE(l.surplus_amount, 0) >= _amount_min)
      AND (_amount_max IS NULL OR COALESCE(l.surplus_amount, 0) <= _amount_max)
      AND (
        _skip_status IS NULL
        OR (_skip_status = 'traced' AND (
              l.skip_traced = true
              OR l.status IN ('phone_found','queued','called','interested','consultation_booked','agreement_signed','referred_to_attorney','case_filed','hearing_scheduled','approved','funds_released','closed')
              OR COALESCE(NULLIF(l.phone,''), NULLIF(l.email,'')) IS NOT NULL
           ) AND COALESCE(l.status,'') <> 'skip_trace_failed')
        OR (_skip_status = 'failed' AND l.status = 'skip_trace_failed')
        OR (_skip_status = 'pending'
              AND COALESCE(l.skip_traced, false) = false
              AND COALESCE(l.status, '') <> 'skip_trace_failed'
              AND l.status NOT IN ('phone_found','queued','called','interested','consultation_booked','agreement_signed','referred_to_attorney','case_filed','hearing_scheduled','approved','funds_released','closed')
              AND COALESCE(NULLIF(l.phone,''), NULLIF(l.email,'')) IS NULL)
      )
      AND (_status IS NULL OR l.status = _status)
      AND (_source IS NULL OR COALESCE(l.lead_source, 'manual_upload') = _source)
      AND (
        _search IS NULL OR _search = ''
        OR (
          COALESCE(l.first_name,'')        ILIKE '%' || _search || '%'
          OR COALESCE(l.last_name,'')      ILIKE '%' || _search || '%'
          OR COALESCE(l.county,'')         ILIKE '%' || _search || '%'
          OR COALESCE(l.state,'')          ILIKE '%' || _search || '%'
          OR COALESCE(l.court_case_number,'') ILIKE '%' || _search || '%'
        )
      )
  )
  SELECT
    COUNT(*)::bigint                                              AS total_leads,
    COUNT(DISTINCT state) FILTER (WHERE state IS NOT NULL)::bigint AS distinct_states,
    COALESCE(SUM(surplus_amount), 0)::numeric                     AS total_surplus,
    COALESCE(AVG(NULLIF(surplus_amount, 0)), 0)::numeric          AS avg_surplus,
    COUNT(*) FILTER (WHERE skip_status = 'pending')::bigint       AS skip_pending_count,
    COUNT(*) FILTER (WHERE skip_status = 'traced')::bigint        AS skip_traced_count,
    COUNT(*) FILTER (WHERE skip_status = 'failed')::bigint        AS skip_failed_count
  FROM base;
$function$;