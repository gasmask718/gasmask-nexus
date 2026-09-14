// ═══════════════════════════════════════════════════════════════════════════
// playboxxx-recruiting-ingest — inbound recruiting ingest webhook (Make.com / direct)
// ═══════════════════════════════════════════════════════════════════════════
//
// Two lanes, two canonical homes — a person is never stored as a business:
//
//   business lane (beauty, private_chef, cleaner, decorator, florist, staff…)
//     → ingest_business_lead(): the SHARED canonical business row
//       (business = 'shared') + a 'playboxxx' eligibility record. Dedupe order
//       source_record_id → phone → website domain → name+address, cross-company.
//
//   creator lane (model, creator, photographer, cameraman, videographer)
//     → ingest_recruiting_applicant(): the canonical recruiting PERSON
//       (recruiting_applicants + recruiting_applications). Dedupe order
//       email → phone → instagram handle.
//
// Every batch opens a lead_ingestion_runs row and closes it with real counts,
// so a run that fails is visible instead of absent.
//
// verify_jwt = false in config.toml — the shared secret IS the auth boundary.
// No service-role key or Supabase JWT is ever given to Make.com.
// NO OUTREACH: this function only stores and dedupes. It never calls, texts or emails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  CREATOR_LANE,
  normalizeLead,
  type NormalizedLead,
  type RawLead,
} from '../_shared/playboxxxLeadNormalize.ts';

const MAX_BATCH = 500;
const DEFAULT_CAMPAIGN = 'PBX-SOURCING';

type Outcome = {
  index: number;
  lane?: 'business' | 'creator';
  status: 'inserted' | 'duplicate' | 'invalid';
  id?: string;
  external_id?: string | null;
  matched_by?: 'external_id' | 'phone' | 'website_domain' | 'name_address' | 'person' | 'batch';
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

  const externalRunRef = typeof payload.run_id === 'string' ? payload.run_id.slice(0, 120) : null;
  const defaultSource = typeof payload.source === 'string' ? payload.source : null;
  const campaignCode =
    typeof payload.campaign_code === 'string' && payload.campaign_code.trim()
      ? payload.campaign_code.trim()
      : DEFAULT_CAMPAIGN;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 3. Open the ingestion run (shared run-history table) ─────────────────
  let runId: string | null = null;
  {
    const { data, error } = await supabase
      .from('lead_ingestion_runs')
      .insert({
        source: defaultSource ?? 'playboxxx_make_ingest',
        query_term: typeof payload.search_term === 'string' ? payload.search_term : null,
        geography: typeof payload.geography === 'string' ? payload.geography : null,
        category: typeof payload.category === 'string' ? payload.category : null,
        companies: ['playboxxx'],
        outcome: 'running',
        raw_result_count: rawLeads.length,
        notes: externalRunRef ? `make_run_id=${externalRunRef}` : null,
      })
      .select('id')
      .single();
    if (error) {
      // A run we cannot record is a run nobody can audit — refuse rather than ingest blind.
      console.error('[playboxxx-ingest] could not open ingestion run', error.message);
      return json({ success: false, error: `Could not open ingestion run: ${error.message}` }, 500);
    }
    runId = data.id as string;
  }

  const results: Outcome[] = [];
  // Within-batch guards so one payload cannot create its own duplicates.
  const seenExternal = new Set<string>();
  const seenPhone = new Set<string>();
  const seenName = new Set<string>();
  const seenPerson = new Set<string>();

  try {
    for (let i = 0; i < rawLeads.length; i++) {
      const norm = normalizeLead(rawLeads[i] ?? {}, defaultSource);
      if (!norm.ok) {
        results.push({ index: i, status: 'invalid', error: norm.error });
        continue;
      }

      const lead: NormalizedLead = norm.lead;

      try {
        // ══ creator lane — a PERSON, routed to the canonical applicant ═════
        if (norm.lane === 'creator') {
          const taxonomy = CREATOR_LANE[lead.category];
          const personKey =
            (lead.email ?? lead.instagram_username ?? norm.phoneLast10 ?? lead.business_name).toLowerCase();
          if (seenPerson.has(personKey)) {
            results.push({ index: i, lane: 'creator', status: 'duplicate', matched_by: 'batch' });
            continue;
          }
          seenPerson.add(personKey);

          const { data, error } = await supabase.rpc('ingest_recruiting_applicant', {
            p_payload: {
              full_name: lead.business_name,
              email: lead.email,
              phone: lead.phone,
              instagram_username: lead.instagram_username,
              city: lead.city,
              state: lead.state,
              country: 'US',
              notes: lead.instagram_bio,
              business_slug: 'playboxxx',
              campaign_code: campaignCode,
              category_slug: taxonomy.category_slug,
              role_slug: taxonomy.role_slug,
              source_platform: lead.external_source,
              source_ad_id: lead.external_place_id,
              search_term: lead.search_term,
              instagram_url: lead.instagram_url,
              instagram_followers: lead.instagram_followers,
              ingestion_run_id: runId,
            },
          });
          if (error) throw error;

          const r = data as { applicant_id: string; applicant_created: boolean; application_created: boolean };
          results.push({
            index: i,
            lane: 'creator',
            status: r.applicant_created || r.application_created ? 'inserted' : 'duplicate',
            id: r.applicant_id,
            matched_by: r.applicant_created ? undefined : 'person',
            external_id: lead.external_place_id,
          });
          continue;
        }

        // ══ business lane — shared canonical business + playboxxx eligibility ══
        const extKey =
          lead.external_source && lead.external_place_id
            ? `${lead.external_source}|${lead.external_place_id}`
            : null;
        if (
          (extKey && seenExternal.has(extKey)) ||
          (norm.phoneLast10 && seenPhone.has(norm.phoneLast10)) ||
          seenName.has(norm.nameKey)
        ) {
          results.push({ index: i, lane: 'business', status: 'duplicate', matched_by: 'batch', external_id: lead.external_place_id });
          continue;
        }
        if (extKey) seenExternal.add(extKey);
        if (norm.phoneLast10) seenPhone.add(norm.phoneLast10);
        seenName.add(norm.nameKey);

        const { data, error } = await supabase.rpc('ingest_business_lead', {
          p: {
            business_name: lead.business_name,
            category: lead.category,
            phone: lead.phone,
            email: lead.email,
            website: lead.website,
            full_address: lead.full_address,
            city: lead.city,
            state: lead.state,
            country: 'US',
            latitude: lead.latitude,
            longitude: lead.longitude,
            source: lead.source,
            external_source: lead.external_source,
            external_place_id: lead.external_place_id,
            source_record_id: lead.external_place_id,
            ingestion_run_id: runId,
            companies: ['playboxxx'],
            eligibility_reason: 'playboxxx_recruiting_ingest',
          },
        });
        if (error) throw error;

        const r = data as { lead_id: string; action: 'inserted' | 'deduped'; matched_on: string | null };
        results.push({
          index: i,
          lane: 'business',
          status: r.action === 'inserted' ? 'inserted' : 'duplicate',
          id: r.lead_id,
          matched_by: (r.matched_on as Outcome['matched_by']) ?? undefined,
          external_id: lead.external_place_id,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ index: i, status: 'invalid', error: message });
      }
    }
  } catch (fatal) {
    const message = fatal instanceof Error ? fatal.message : String(fatal);
    await supabase
      .from('lead_ingestion_runs')
      .update({ outcome: 'failed', completed_at: new Date().toISOString(), error_detail: message })
      .eq('id', runId);
    console.error('[playboxxx-ingest] batch failed', message);
    return json({ success: false, run_id: runId, error: message }, 500);
  }

  const counts = {
    received: rawLeads.length,
    inserted: results.filter((r) => r.status === 'inserted').length,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    creators: results.filter((r) => r.lane === 'creator').length,
    businesses: results.filter((r) => r.lane === 'business').length,
  };

  await supabase
    .from('lead_ingestion_runs')
    .update({
      outcome: 'success',
      completed_at: new Date().toISOString(),
      inserted_count: counts.inserted,
      deduped_count: counts.duplicate,
      skipped_count: counts.invalid,
      error_detail: counts.invalid
        ? results.filter((r) => r.status === 'invalid').slice(0, 10).map((r) => r.error).join(' | ')
        : null,
    })
    .eq('id', runId);

  console.log('[playboxxx-ingest] batch complete', { run_id: runId, source: defaultSource, ...counts });

  if (singleMode && results.length === 1) {
    const r = results[0];
    if (r.status === 'invalid') {
      return json({ success: false, error: r.error, run_id: runId }, 400);
    }
    return json({ success: true, lane: r.lane, status: r.status, id: r.id, matched_by: r.matched_by ?? null, run_id: runId });
  }

  return json({ success: true, run_id: runId, counts, results });
});
