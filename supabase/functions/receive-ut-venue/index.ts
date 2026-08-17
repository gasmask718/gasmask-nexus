import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

/**
 * Schema-drift policy (2026-08-17) — same treatment as receive-ut-staff.
 *
 * The previous version listed the fields it wanted and dropped everything
 * else without a word. latitude/longitude were in the payload and in the
 * table, and still landed NULL on all six rows: the field list was written
 * once and never compared against what UT sends. A silent discard is worse
 * than the 500 we started with — the 500 was loud and cost one delayed row.
 *
 * Rule: dropping an unrecognised field is a decision, and a decision made by
 * omission is one nobody made. Known keys map to columns, unknown keys are
 * preserved in mirror_extra, logged by name, and echoed in the 200 so the
 * sender knows what we didn't understand.
 */

// Payload key -> event_halls column. Keys whose payload name already equals
// the column name map to themselves.
const FIELD_MAP: Record<string, string> = {
  hall_name: 'hall_name',
  name: 'name',
  description: 'description',
  tagline: 'tagline',
  address: 'address',
  city: 'city',
  state: 'state',
  zip_code: 'zip_code',
  capacity_min: 'capacity_min',
  capacity_max: 'capacity_max',
  price_per_hour: 'price_per_hour',
  price_per_day: 'price_per_day',
  price_per_event: 'price_per_event',
  contact_name: 'contact_name',
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',
  phone: 'phone',
  email: 'email',
  instagram_handle: 'instagram_handle',
  facebook_url: 'facebook_url',
  website: 'website',
  website_url: 'website_url',
  amenities: 'amenities',
  event_types: 'event_types',
  photos: 'photos',
  rules: 'rules',
  parking_info: 'parking_info',
  catering_options: 'catering_options',
  availability: 'availability',
  owner_user_id: 'owner_user_id',
  // The column was already waiting for these. Nullable on purpose: an
  // unresolved geocode stays NULL. A fabricated 0,0 puts every unresolved
  // venue in the Gulf of Guinea.
  latitude: 'latitude',
  longitude: 'longitude',
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
      console.error(`[receive-ut-venue] 401 unauthorized: ${reason}`);
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

    let existingId: string | null = null

    if (utListingId) {
      const { data: existing } = await supabase
        .from('event_halls')
        .select('id')
        .eq('ut_listing_id', utListingId)
        .maybeSingle()
      existingId = existing?.id ?? null
    } else {
      const contactEmail = body?.contact_email || body?.email
      if (!contactEmail) {
        console.error('[receive-ut-venue] 400 unidentifiable: no ut_listing_id and no contact_email')
        return new Response(
          JSON.stringify({ error: 'ut_listing_id or contact_email required', code: 'UNIDENTIFIABLE' }),
          { status: 400, headers: corsHeaders }
        )
      }
      const { data: existing } = await supabase
        .from('event_halls')
        .select('id')
        .eq('contact_email', contactEmail)
        .maybeSingle()
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Email already exists', code: 'DUPLICATE' }),
          { status: 409, headers: corsHeaders }
        )
      }
    }

    // Partition: mapped keys become columns, everything else is kept.
    // status only on first sight — a replay must not reset an approved venue.
    const row: Record<string, unknown> = existingId ? {} : { status: 'pending' }
    const extra: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body ?? {})) {
      const column = FIELD_MAP[key]
      if (column) row[column] = value
      else extra[key] = value
    }
    // name is NOT NULL in practice; UT sends hall_name.
    if (row.name == null) row.name = body?.hall_name ?? body?.name
    if (utListingId) row.ut_listing_id = utListingId
    if (existingId) row.id = existingId

    const unknownKeys = Object.keys(extra)
    if (unknownKeys.length > 0) {
      row.mirror_extra = extra
      console.warn(
        `[receive-ut-venue] schema drift: ${unknownKeys.length} unknown field(s) captured into mirror_extra: ${unknownKeys.join(', ')}`
      )
    }

    const table = supabase.from('event_halls')
    const { error: insertError } = utListingId
      ? await table.upsert(row, { onConflict: 'ut_listing_id' })
      : await table.insert(row)

    if (insertError) {
      console.error(`[receive-ut-venue] write failed: ${insertError.message} (code ${insertError.code ?? 'n/a'})`)
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
    console.error(`[receive-ut-venue] unhandled: ${err instanceof Error ? err.message : String(err)}`)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
