import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

/**
 * Schema-drift policy (2026-08-17) — same treatment as receive-ut-staff.
 * Known keys map to columns; unknown keys land in mirror_extra, are logged by
 * name, and are echoed in the 200. Nothing is discarded silently: an
 * allowlist that drops without saying so is the same shape as a catch block
 * that swallows.
 */
const FIELD_MAP: Record<string, string> = {
  business_name: 'business_name',
  company_name: 'business_name',
  name: 'business_name',
  owner_name: 'owner_name',
  contact_name: 'owner_name',
  email: 'email',
  contact_email: 'email',
  phone: 'phone',
  contact_phone: 'phone',
  city: 'city',
  state: 'state',
  geo_lat: 'geo_lat',
  latitude: 'geo_lat',
  geo_lng: 'geo_lng',
  longitude: 'geo_lng',
  commission_rate: 'commission_rate',
  user_id: 'user_id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const secret = req.headers.get('x-shared-secret')
    const expected = Deno.env.get('UT_OS_SHARED_SECRET');
    const ok = !!expected && !!secret && secret === expected;
    if (!ok) {
      // Response stays a bare 401 for every failure mode; the reason is logged
      // only, so the sender can be told why out-of-band without leaking it.
      const reason = !expected
        ? 'receiver_secret_not_configured (UT_OS_SHARED_SECRET is unset on this project)'
        : secret === null
          ? 'header_missing (no x-shared-secret header sent)'
          : secret.length === 0
            ? 'header_present_but_empty (x-shared-secret sent with empty value)'
            : secret.length !== expected.length
              ? `value_mismatch (length ${secret.length}, expected length ${expected.length})`
              : 'value_mismatch (same length, different value)';
      console.error(`[receive-ut-rental] 401 unauthorized: ${reason}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const email = body?.email || body?.contact_email

    const { data: existing } = await supabase
      .from('rental_partners')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Email already exists', code: 'DUPLICATE' }),
        { status: 409, headers: corsHeaders }
      )
    }

    const row: Record<string, unknown> = { status: 'pending', verified: false }
    const extra: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body ?? {})) {
      const column = FIELD_MAP[key]
      // Aliases: don't let an empty alias overwrite a real value.
      if (column) {
        if (row[column] === undefined || row[column] === null || row[column] === '') row[column] = value
      } else {
        extra[key] = value
      }
    }
    row.email = email

    const unknownKeys = Object.keys(extra)
    if (unknownKeys.length > 0) {
      row.mirror_extra = extra
      console.warn(
        `[receive-ut-rental] schema drift: ${unknownKeys.length} unknown field(s) captured into mirror_extra: ${unknownKeys.join(', ')}`
      )
    }

    const { error: insertError } = await supabase
      .from('rental_partners')
      .insert(row)

    if (insertError) {
      console.error(`[receive-ut-rental] insert failed: ${insertError.message} (code ${insertError.code ?? 'n/a'})`)
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, unknown_fields: unknownKeys }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    console.error(`[receive-ut-rental] unhandled: ${err instanceof Error ? err.message : String(err)}`)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
