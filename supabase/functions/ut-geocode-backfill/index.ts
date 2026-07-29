import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  delay,
  placeDetails,
  DETAILS_MASK_FULL,
  DETAILS_MASK_GEO,
} from "../_shared/places-client.ts";

const MASKS: Record<string, string> = {
  full: DETAILS_MASK_FULL,
  geo_only: DETAILS_MASK_GEO,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return json({ error: 'GOOGLE_PLACES_API_KEY not set' }, 500);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batch_size ?? 100);
    const maskTier = String(body.mask_tier ?? 'full');
    const maxRequests = Number(body.max_requests ?? 200);
    const dryRun = body.dry_run === true;

    const fieldMask = MASKS[maskTier];
    if (!fieldMask) return json({ error: `Unknown mask_tier: ${maskTier}. Use 'full' or 'geo_only'.` }, 400);

    // Resumable selection — already-geocoded rows (including not_found) are skipped.
    const { data: leads, error: selErr } = await sb
      .from('ut_partner_leads')
      .select('id, external_place_id, phone, website, status, review_count, google_rating, full_address')
      .is('geocoded_at', null)
      .is('duplicate_of', null)
      .not('external_place_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);
    if (selErr) throw selErr;

    let processed = 0, updated = 0, notFound = 0, failed = 0, requestsMade = 0;
    let capped = false;
    const sample: any[] = [];

    for (const lead of leads || []) {
      if (requestsMade >= maxRequests) { capped = true; break; }

      processed++;
      try {
        requestsMade++;
        const d = await placeDetails(lead.external_place_id as string, apiKey, fieldMask);
        await delay(150);

        // Permanent not-found (404 / NOT_FOUND / empty): stamp so it is never retried.
        if (!d || !d.id) {
          notFound++;
          const patch = { geocoded_at: new Date().toISOString(), geocode_source: 'not_found' };
          if (dryRun) {
            if (sample.length < 5) sample.push({ id: lead.id, place_id: lead.external_place_id, outcome: 'not_found', patch });
          } else {
            const { error } = await sb.from('ut_partner_leads').update(patch).eq('id', lead.id);
            if (error) throw error;
          }
          continue;
        }

        const patch: Record<string, unknown> = {
          latitude: typeof d.location?.latitude === 'number' ? d.location.latitude : null,
          longitude: typeof d.location?.longitude === 'number' ? d.location.longitude : null,
          geocoded_at: new Date().toISOString(),
          geocode_source: 'places_details',
        };

        // COALESCE-fill only — never overwrite an existing value.
        if (isBlank(lead.review_count) && d.userRatingCount != null) patch.review_count = d.userRatingCount;
        if (isBlank(lead.google_rating) && d.rating != null) patch.google_rating = d.rating;
        if (isBlank(lead.full_address) && d.formattedAddress) patch.full_address = d.formattedAddress;
        if (isBlank(lead.website) && d.websiteUri) patch.website = d.websiteUri;

        const phoneFilled = isBlank(lead.phone) && !!d.nationalPhoneNumber;
        if (phoneFilled) patch.phone = d.nationalPhoneNumber;

        const effectivePhone = isBlank(lead.phone) ? (d.nationalPhoneNumber || null) : lead.phone;
        patch.ai_call_eligible = !isBlank(effectivePhone);

        // Only this exact transition, and only when a phone was just filled.
        if (lead.status === 'needs_enrichment' && phoneFilled) patch.status = 'new';

        if (dryRun) {
          if (sample.length < 5) sample.push({ id: lead.id, place_id: lead.external_place_id, outcome: 'update', patch });
          updated++;
        } else {
          const { error } = await sb.from('ut_partner_leads').update(patch).eq('id', lead.id);
          if (error) throw error;
          updated++;
        }
      } catch (e) {
        // Transient failure: geocoded_at stays NULL so the next run retries it.
        failed++;
        console.error(`geocode-backfill failed for place_id=${lead.external_place_id}:`, e instanceof Error ? e.message : e);
      }
    }

    const { count: remaining } = await sb
      .from('ut_partner_leads')
      .select('id', { count: 'exact', head: true })
      .is('geocoded_at', null)
      .is('duplicate_of', null)
      .not('external_place_id', 'is', null);

    console.log(`ut-geocode-backfill: mask_tier=${maskTier} requests_made=${requestsMade} capped=${capped} dry_run=${dryRun}`);

    return json({
      processed,
      updated,
      not_found: notFound,
      failed,
      requests_made: requestsMade,
      mask_tier: maskTier,
      capped,
      remaining: remaining ?? null,
      ...(dryRun ? { dry_run: true, sample } : {}),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 400);
  }
});
