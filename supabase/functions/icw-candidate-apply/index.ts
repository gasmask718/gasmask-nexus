// ═══════════════════════════════════════════════════════════════════════════
// ICW CANDIDATE APPLY — public intake endpoint for "Apply as an Independent
// Cleaner". No login required (verify_jwt = false).
// ═══════════════════════════════════════════════════════════════════════════
//
// Fail-closed, exactly like the scraped-lead path:
//   - status is ALWAYS 'candidate' (never advanced here)
//   - no outreach, no approval, no conversion to icw_workers
//   - consent checkbox is mandatory server-side
//   - dedupe mirrors src/lib/icw/candidateIngestion.ts (see _shared module)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  findExistingCandidate,
  phoneDedupeKey,
  sanitizeCandidateInput,
} from '../_shared/icwCandidateDedupe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
};

const CONTACT_METHODS = new Set(['platform_relay', 'public_phone', 'public_email']);
const SELF_REPORTED = 'self-reported on application form';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    // ── Mandatory consent gate ────────────────────────────────────────────
    if (body.consent !== true) {
      return json({ error: 'Consent acknowledgement is required.' }, 400);
    }

    const full_name = clean(body.full_name, 200);
    const email = clean(body.email, 254)?.toLowerCase() ?? null;
    const phone = clean(body.phone, 40);
    const city = clean(body.city, 120);
    const state = clean(body.state, 120);

    if (!full_name) return json({ error: 'Full name is required.' }, 400);
    if (!email && !phone) return json({ error: 'An email or a phone number is required.' }, 400);
    if (email && !/^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/.test(email)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const independentRaw = body.independent_signal;
    const independent_signal =
      independentRaw === 'explicit_yes' || independentRaw === 'explicit_no'
        ? independentRaw
        : null;

    const owns_supplies =
      typeof body.owns_supplies === 'boolean' ? body.owns_supplies : null;

    const contact_method =
      typeof body.contact_method === 'string' && CONTACT_METHODS.has(body.contact_method)
        ? body.contact_method
        : null;

    const now = new Date().toISOString();

    const input = sanitizeCandidateInput({
      full_name,
      email,
      phone,
      city,
      state,
      country: 'US',
      service_area: clean(body.service_area, 500),
      experience_summary: clean(body.experience_summary, 4000),
      availability_summary: clean(body.availability_summary, 2000),
      notes: clean(body.notes, 4000),
      independent_signal,
      independent_signal_source: independent_signal ? SELF_REPORTED : null,
      owns_supplies,
      owns_supplies_source: owns_supplies === null ? null : SELF_REPORTED,
      contact_method,
      referral_source: clean(body.referral_source, 300),
      utm_source: clean(body.utm_source, 200),
      utm_medium: clean(body.utm_medium, 200),
      utm_campaign: clean(body.utm_campaign, 200),
      consent_acknowledged_at: now,
      source_platform: 'application_form',
      source_posted_at: now,
      status: 'candidate',
    } as Record<string, unknown>);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Same candidate-set narrowing as the browser path.
    const filters: string[] = [];
    if (phoneDedupeKey(phone, 'US')) filters.push('phone.not.is.null');
    if (full_name) filters.push('full_name.not.is.null');
    const { data: rows, error: readErr } = await supabase
      .from('icw_candidate_leads')
      .select('*')
      .or(filters.join(','))
      .limit(2000);
    if (readErr) throw readErr;

    const match = findExistingCandidate((rows ?? []) as Record<string, any>[], input);

    if (match) {
      // Merge-patch: never blank out an existing value with an empty one.
      const patch: Record<string, unknown> = { updated_at: now };
      for (const [k, v] of Object.entries(input)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        patch[k] = v;
      }
      const { data: updated, error: upErr } = await supabase
        .from('icw_candidate_leads')
        .update(patch)
        .eq('id', match.candidate.id)
        .select()
        .maybeSingle();
      if (upErr) throw upErr;
      if (!updated) throw new Error('Update did not return the candidate row.');
      console.log('icw-candidate-apply: duplicate_preexisting', match.reason, updated.id);
      return json({ ok: true, outcome: 'duplicate_preexisting', match_reason: match.reason });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('icw_candidate_leads')
      .insert(input)
      .select()
      .maybeSingle();
    if (insErr) throw insErr;
    if (!inserted) throw new Error('Insert did not return the candidate row.');

    console.log('icw-candidate-apply: inserted', inserted.id);
    return json({ ok: true, outcome: 'inserted' });
  } catch (e) {
    console.error('icw-candidate-apply error', e);
    return json({ error: (e as Error).message ?? 'Unexpected error' }, 500);
  }
});
