import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-shared-secret",
};

/**
 * Schema-drift policy (2026-08-17) — same treatment as receive-ut-staff.
 * Known keys map to columns; unknown keys land in mirror_extra, are logged by
 * name, and are echoed in the 200. Dropping an unrecognised field is a
 * decision, and a decision made by omission is one nobody made.
 */
const KNOWN_COLUMNS = new Set([
  'full_name', 'email', 'phone', 'state',
  // Promoted 2026-08-17: UT has been sending city and the table had nowhere
  // to put it, so every ambassador city was discarded at the door.
  'city',
  'instagram_handle', 'tiktok_handle', 'youtube_handle',
  'why_ambassador', 'follower_range', 'event_types',
  'source', 'business_unit', 'auth_user_id',
  // Promoted 2026-08-18: UT owns the referral code. The ambassador signs up
  // there and the code is on their dashboard and in their emails before this
  // row exists, so a locally minted one would be a second live code for the
  // same person. We generate only when the payload carries none.
  'referral_code',
  // UT-side primary key, injected at UT's enqueue point. Natural key for upsert.
  'ut_listing_id', 'ut_entity_type',
]);

/**
 * Identity policy (2026-08-17): ut_listing_id is the natural key and the
 * mirror upserts on it, so replays are idempotent. The email 409 is scoped to
 * the legacy path (no ut_listing_id) — on the id path the upsert is the guard
 * and the 409 would block the unknown_fields echo. Neither key present => 400,
 * never a blind insert.
 */

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate shared secret
    const secret = req.headers.get("x-shared-secret");
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
      console.error(`[receive-ut-ambassador] 401 unauthorized: ${reason}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { full_name, email } = body ?? {};
    const utListingId = body?.ut_listing_id != null && String(body.ut_listing_id).length > 0
      ? String(body.ut_listing_id)
      : null;

    let existingId: string | null = null;

    if (utListingId) {
      const { data: existing } = await supabase
        .from("unforgettable_ambassadors")
        .select("id")
        .eq("ut_listing_id", utListingId)
        .maybeSingle();
      existingId = existing?.id ?? null;
    } else {
      if (!email) {
        console.error('[receive-ut-ambassador] 400 unidentifiable: no ut_listing_id and no email');
        return new Response(
          JSON.stringify({ error: "ut_listing_id or email required", code: "UNIDENTIFIABLE" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: existing } = await supabase
        .from("unforgettable_ambassadors")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ error: "Email already exists", code: "DUPLICATE" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Referral code and status are first-sight only. A replay must not mint a
    // new referral code for an ambassador who has already been sharing one.
    const row: Record<string, unknown> = existingId
      ? {}
      : {
          referral_code:
            "UT-" +
            String(full_name ?? "").split(" ")[0].toUpperCase().slice(0, 5) +
            "-" +
            Math.random().toString(36).substring(2, 6).toUpperCase(),
          status: "pending",
        };
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body ?? {})) {
      if (KNOWN_COLUMNS.has(key)) row[key] = value;
      else extra[key] = value;
    }
    if (utListingId) row.ut_listing_id = utListingId;
    if (existingId) row.id = existingId;
    const unknownKeys = Object.keys(extra);
    if (unknownKeys.length > 0) {
      row.mirror_extra = extra;
      console.warn(
        `[receive-ut-ambassador] schema drift: ${unknownKeys.length} unknown field(s) captured into mirror_extra: ${unknownKeys.join(", ")}`
      );
    }

    const utTable = supabase.from("unforgettable_ambassadors");
    const { error: insertError } = utListingId
      ? await utTable.upsert(row, { onConflict: "ut_listing_id" })
      : await utTable.insert(row);

    if (insertError) {
      console.error(`[receive-ut-ambassador] insert failed: ${insertError.message} (code ${insertError.code ?? 'n/a'})`);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, referral_code: row.referral_code ?? null, unknown_fields: unknownKeys, mode: utListingId ? (existingId ? 'updated' : 'inserted') : 'inserted_legacy' }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
