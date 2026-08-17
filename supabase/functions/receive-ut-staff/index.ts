import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

/**
 * Schema-drift policy (decided deliberately, 2026-08-17):
 *
 * UT owns its signup form; we own this table. Every field UT adds lands here
 * before we know about it. The previous behaviour spread the whole payload
 * into the insert, so a single unrecognised key (custom_role_description)
 * returned PGRST204 and 500'd the mirror — an outage-shaped failure for what
 * is really a schema gap.
 *
 * New behaviour: known columns are inserted; anything else is captured into
 * mirror_extra (jsonb) and logged by name. Nothing is lost, the mirror keeps
 * flowing, and the log tells us which columns to promote. Unknown fields are
 * never a reason to reject a staff signup.
 */
const KNOWN_COLUMNS = new Set([
  'user_id', 'full_name', 'email', 'phone', 'bio', 'role_category',
  'custom_role_description', 'specialties', 'city', 'state', 'hourly_rate',
  'event_rate', 'profile_photo', 'portfolio_photos', 'portfolio_videos',
  'demo_video_url', 'years_experience', 'languages', 'availability',
  'instagram_handle', 'tiktok_handle', 'website', 'available_states',
  'contact_email', 'contact_phone', 'tagline', 'skills', 'price_per_hour',
  'price_per_event', 'price_type', 'languages_spoken', 'travel_willing',
  // Promoted from mirror_extra 2026-08-17: geocoded signup coordinates.
  // Nullable on purpose — an unresolved geocode must stay NULL, never 0,0.
  'latitude', 'longitude',
  // UT-side primary key, injected at UT's enqueue point. Natural key for upsert.
  'ut_listing_id', 'ut_entity_type',
])

/**
 * Identity policy (2026-08-17):
 *
 * UT now injects ut_listing_id + ut_entity_type at its single enqueue point,
 * so every mirror payload carries the sender-side primary key. That key is the
 * natural key for this table (unique index, nullable for pre-2026-08-17 rows)
 * and the mirror upserts on it — replays are idempotent, not duplicate rows.
 *
 * The email 409 is scoped to the legacy path only: it fires when
 * ut_listing_id is ABSENT. With an id present the upsert is the guard, so a
 * replay reaches the write and the unknown_fields echo actually comes back.
 * Keeping it on the id path would 409 before the upsert and give us no echo.
 *
 * A payload with NO ut_listing_id and NO email is rejected 400 rather than
 * inserted: with neither key we cannot tell a replay from a new partner, and
 * a silent duplicate is the failure mode this whole pass exists to kill.
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
      console.error(`[receive-ut-staff] 401 unauthorized: ${reason}`);
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
    const utListingId = body?.ut_listing_id != null && String(body.ut_listing_id).length > 0
      ? String(body.ut_listing_id)
      : null
    const contact_email = body?.contact_email

    let existingId: string | null = null

    if (utListingId) {
      const { data: existing } = await supabase
        .from('staff_members_ut')
        .select('id')
        .eq('ut_listing_id', utListingId)
        .maybeSingle()
      existingId = existing?.id ?? null
    } else {
      if (!contact_email) {
        console.error('[receive-ut-staff] 400 unidentifiable: no ut_listing_id and no contact_email')
        return new Response(
          JSON.stringify({ error: 'ut_listing_id or contact_email required', code: 'UNIDENTIFIABLE' }),
          { status: 400, headers: corsHeaders }
        )
      }
      const { data: existing } = await supabase
        .from('staff_members_ut')
        .select('id')
        .eq('contact_email', contact_email)
        .maybeSingle()
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Email already exists', code: 'DUPLICATE' }),
          { status: 409, headers: corsHeaders }
        )
      }
    }

    // Partition the payload: known columns insert directly, everything else is
    // preserved in mirror_extra rather than failing the request.
    // status is set on first sight only — a replay must not reset an approved
    // partner back to pending.
    const row: Record<string, unknown> = existingId ? {} : { status: 'pending' }
    const extra: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body ?? {})) {
      if (KNOWN_COLUMNS.has(key)) row[key] = value
      else extra[key] = value
    }
    if (utListingId) row.ut_listing_id = utListingId
    if (existingId) row.id = existingId
    const unknownKeys = Object.keys(extra)
    if (unknownKeys.length > 0) {
      row.mirror_extra = extra
      console.warn(
        `[receive-ut-staff] schema drift: ${unknownKeys.length} unknown field(s) captured into mirror_extra: ${unknownKeys.join(', ')}`
      )
    }

    const table = supabase.from('staff_members_ut')
    const { error: insertError } = utListingId
      ? await table.upsert(row, { onConflict: 'ut_listing_id' })
      : await table.insert(row)

    if (insertError) {
      console.error(`[receive-ut-staff] write failed: ${insertError.message} (code ${insertError.code ?? 'n/a'})`)
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
    console.error(`[receive-ut-staff] unhandled: ${err instanceof Error ? err.message : String(err)}`)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
