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
  // UT-side primary key, injected at UT's enqueue point.
  ut_listing_id: 'ut_listing_id',
  ut_entity_type: 'ut_entity_type',
}

/**
 * Identity policy (2026-08-17):
 *
 * UT injects ut_listing_id + ut_entity_type at its single enqueue point, so
 * every payload carries the sender-side primary key. It is the natural key
 * here (unique index, nullable for pre-2026-08-17 rows) and the mirror
 * upserts on it — replays are idempotent, not duplicate rows.
 *
 * The email 409 is scoped to the legacy path: it fires only when
 * ut_listing_id is ABSENT. With an id present the upsert is the guard, so a
 * replay reaches the write and the unknown_fields echo comes back; keeping
 * the 409 on that path would reject before the upsert and tell us nothing.
 *
 * No ut_listing_id and no email => 400, never a blind insert. With neither
 * key we cannot tell a replay from a new partner, and a silent duplicate is
 * exactly the failure this pass exists to kill.
 */

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
    const utListingId = body?.ut_listing_id != null && String(body.ut_listing_id).length > 0
      ? String(body.ut_listing_id)
      : null

    let existingId: string | null = null

    if (utListingId) {
      const { data: existing } = await supabase
        .from('rental_partners')
        .select('id')
        .eq('ut_listing_id', utListingId)
        .maybeSingle()
      existingId = existing?.id ?? null
    } else {
      if (!email) {
        console.error('[receive-ut-rental] 400 unidentifiable: no ut_listing_id and no email')
        return new Response(
          JSON.stringify({ error: 'ut_listing_id or email required', code: 'UNIDENTIFIABLE' }),
          { status: 400, headers: corsHeaders }
        )
      }
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
    }

    // status/verified only on first sight — a replay must not un-verify a
    // partner someone has already approved.
    const row: Record<string, unknown> = existingId ? {} : { status: 'pending', verified: false }
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
    if (email) row.email = email
    if (utListingId) row.ut_listing_id = utListingId
    if (existingId) row.id = existingId

    const unknownKeys = Object.keys(extra)
    if (unknownKeys.length > 0) {
      row.mirror_extra = extra
      console.warn(
        `[receive-ut-rental] schema drift: ${unknownKeys.length} unknown field(s) captured into mirror_extra: ${unknownKeys.join(', ')}`
      )
    }

    const table = supabase.from('rental_partners')
    const { error: insertError } = utListingId
      ? await table.upsert(row, { onConflict: 'ut_listing_id' })
      : await table.insert(row)

    if (insertError) {
      console.error(`[receive-ut-rental] write failed: ${insertError.message} (code ${insertError.code ?? 'n/a'})`)
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, unknown_fields: unknownKeys, mode: utListingId ? (existingId ? 'updated' : 'inserted') : 'inserted_legacy' }),
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
