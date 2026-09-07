// ═══════════════════════════════════════════════════════════════════════════
// playboxxx-recruiting-ingest — inbound recruiting lead webhook (Make.com)
// ═══════════════════════════════════════════════════════════════════════════
//
// Make.com (Overpass staff discovery) POSTs batches here. We authenticate with
// a shared secret header (same pattern as scraper-ingest), validate and
// normalise each lead, dedupe against existing playboxxx rows, then insert into
// the shared public.business_leads table with business = 'playboxxx'.
//
// verify_jwt = false in config.toml — the shared secret IS the auth boundary.
// No service-role key or Supabase JWT is ever given to Make.com.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { normalizeLead, type NormalizedLead, type RawLead } from '../_shared/playboxxxLeadNormalize.ts';

const MAX_BATCH = 500;

type Outcome = {
  index: number;
  status: 'inserted' | 'duplicate' | 'invalid';
  id?: string;
  external_id?: string | null;
  matched_by?: 'external_id' | 'phone' | 'name_city_state' | 'batch';
  error?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed, use POST' }, 405);

  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const expected = Deno.env.get('PLAYBOXXX_INGEST_SECRET');
  const provided = req.headers.get('x-playboxxx-secret') ?? '';
  if (!expected || !provided || !safeEqual(provided, expected)) {
    console.warn('[playboxxx-ingest] unauthorized request', {
      secretConfigured: !!expected,
      headerPresent: !!provided,
    });
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Body must be valid JSON' }, 400);
  }

  const singleMode = !Array.isArray(payload?.leads);
  const rawLeads: RawLead[] = Array.isArray(payload?.leads)
    ? (payload.leads as RawLead[])
    : payload?.lead && typeof payload.lead === 'object'
      ? [payload.lead as RawLead]
      : payload && typeof payload === 'object' && (payload.name || payload.business_name)
        ? [payload as RawLead]
        : [];

  if (rawLeads.length === 0) {
    return json({ success: false, error: 'No leads provided. Send { "leads": [...] } or a single lead object.' }, 400);
  }
  if (rawLeads.length > MAX_BATCH) {
    return json({ success: false, error: `Batch too large: ${rawLeads.length} leads (max ${MAX_BATCH})` }, 400);
  }

  const runId = typeof payload.run_id === 'string' ? payload.run_id.slice(0, 120) : null;
  const defaultSource = typeof payload.source === 'string' ? payload.source : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Outcome[] = [];
  // Within-batch guards so one payload cannot create its own duplicates.
  const seenExternal = new Set<string>();
  const seenPhone = new Set<string>();
  const seenName = new Set<string>();

  for (let i = 0; i < rawLeads.length; i++) {
    const norm = normalizeLead(rawLeads[i] ?? {}, defaultSource);
    if (!norm.ok) {
      results.push({ index: i, status: 'invalid', error: norm.error });
      continue;
    }

    const lead: NormalizedLead = norm.lead;
    const extKey =
      lead.external_source && lead.external_place_id
        ? `${lead.external_source}|${lead.external_place_id}`
        : null;

    try {
      // ── in-batch dedupe ────────────────────────────────────────────────
      if (
        (extKey && seenExternal.has(extKey)) ||
        (norm.phoneLast10 && seenPhone.has(norm.phoneLast10)) ||
        seenName.has(norm.nameKey)
      ) {
        results.push({ index: i, status: 'duplicate', matched_by: 'batch', external_id: lead.external_place_id });
        continue;
      }

      // ── existing-row dedupe: external id → phone → name+city+state ─────
      let match: { id: string } | null = null;
      let matchedBy: Outcome['matched_by'];

      if (extKey) {
        const { data, error } = await supabase
          .from('business_leads')
          .select('id')
          .eq('business', 'playboxxx')
          .eq('external_source', lead.external_source!)
          .eq('external_place_id', lead.external_place_id!)
          .is('duplicate_of', null)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) { match = data; matchedBy = 'external_id'; }
      }

      if (!match && norm.phoneLast10) {
        const { data, error } = await supabase
          .from('business_leads')
          .select('id')
          .eq('business', 'playboxxx')
          .eq('phone_last10', norm.phoneLast10)
          .is('duplicate_of', null)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) { match = data; matchedBy = 'phone'; }
      }

      if (!match) {
        const { data, error } = await supabase
          .from('business_leads')
          .select('id, business_name, city')
          .eq('business', 'playboxxx')
          .eq('state', lead.state)
          .ilike('business_name', lead.business_name)
          .is('duplicate_of', null)
          .limit(20);
        if (error) throw error;
        const cityKey = (lead.city ?? '').toLowerCase().trim();
        const hit = (data ?? []).find(
          (r) => (r.city ?? '').toLowerCase().trim() === cityKey,
        );
        if (hit) { match = { id: hit.id }; matchedBy = 'name_city_state'; }
      }

      if (match) {
        results.push({
          index: i,
          status: 'duplicate',
          id: match.id,
          matched_by: matchedBy,
          external_id: lead.external_place_id,
        });
        if (extKey) seenExternal.add(extKey);
        if (norm.phoneLast10) seenPhone.add(norm.phoneLast10);
        seenName.add(norm.nameKey);
        continue;
      }

      // ── insert ─────────────────────────────────────────────────────────
      const { data: inserted, error: insertError } = await supabase
        .from('business_leads')
        .insert(lead)
        .select('id')
        .single();
      if (insertError) throw insertError;

      if (extKey) seenExternal.add(extKey);
      if (norm.phoneLast10) seenPhone.add(norm.phoneLast10);
      seenName.add(norm.nameKey);

      results.push({
        index: i,
        status: 'inserted',
        id: inserted.id,
        external_id: lead.external_place_id,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ index: i, status: 'invalid', error: message });
    }
  }

  const counts = {
    received: rawLeads.length,
    inserted: results.filter((r) => r.status === 'inserted').length,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
  };

  console.log('[playboxxx-ingest] batch complete', {
    run_id: runId,
    source: defaultSource,
    ...counts,
    invalid_reasons: results.filter((r) => r.status === 'invalid').slice(0, 10).map((r) => r.error),
  });

  if (singleMode && results.length === 1) {
    const r = results[0];
    if (r.status === 'invalid') {
      return json({ success: false, error: r.error }, 400);
    }
    return json({ success: true, status: r.status, id: r.id, matched_by: r.matched_by ?? null, run_id: runId });
  }

  return json({ success: true, run_id: runId, counts, results });
});
