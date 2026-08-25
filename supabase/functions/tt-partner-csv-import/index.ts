// tt-partner-csv-import — TopTier Experience only.
// Server-side CSV ingest into public.crm_partners.
// 200-row batches, per-row validation, ON CONFLICT (google_place_id) DO NOTHING.
// Owner/admin/staff only. Never silent-drops: every reject is reported with a reason.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BATCH_SIZE = 200;

const CATEGORIES = new Set([
  'chauffeur', 'exotic car rental', 'party bus', 'helicopter', 'yacht charter',
  'powersports rental', 'nightlife venue', 'rooftop venue', 'event hall',
  'decorator', 'decor rental', 'florist', 'private chef', 'photographer',
  'beauty-hair-makeup', 'security-exec protection', 'rose-gifting supplier', 'authenticator',
]);

const STAGES = new Set(['identified', 'contacted', 'interested', 'applied', 'activated', 'declined']);

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const dateOnly = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleRows, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (roleErr) return json({ error: 'role_lookup_failed', details: roleErr.message }, 500);
    const roles = new Set((roleRows ?? []).map((r) => r.role as string));
    if (!['owner', 'admin', 'staff'].some((r) => roles.has(r))) {
      return json({ error: 'forbidden', message: 'owner/admin/staff only' }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.rows)) return json({ error: 'rows array required' }, 400);
    const rows: Row[] = body.rows;
    const dryRun: boolean = body.dryRun === true;
    if (rows.length === 0) return json({ error: 'rows array is empty' }, 400);
    if (rows.length > 20000) return json({ error: 'too_many_rows', max: 20000 }, 400);

    const rejects: { index: number; reasons: string[]; company_name?: string | null }[] = [];
    const accepted: Record<string, unknown>[] = [];
    const seenPlaceIds = new Set<string>();

    rows.forEach((raw, i) => {
      const reasons: string[] = [];
      const company_name = str(raw.company_name ?? raw.name ?? raw.business_name);
      if (!company_name) reasons.push('missing_required:company_name');

      const category = str(raw.category)?.toLowerCase() ?? null;
      if (category && !CATEGORIES.has(category)) reasons.push(`unknown_category:${category}`);

      const stage = str(raw.stage)?.toLowerCase() ?? 'identified';
      if (!STAGES.has(stage)) reasons.push(`unknown_stage:${stage}`);

      const google_place_id = str(raw.google_place_id ?? raw.place_id);
      if (google_place_id && seenPlaceIds.has(google_place_id)) {
        reasons.push('duplicate_google_place_id_in_file');
      }

      if (reasons.length) {
        rejects.push({ index: i, reasons, company_name });
        return;
      }
      if (google_place_id) seenPlaceIds.add(google_place_id);

      accepted.push({
        company_name,
        business: 'toptier',
        business_slug: 'toptier-experience',
        partner_category: category ?? str(raw.partner_category) ?? 'other',
        category,
        contact_name: str(raw.contact_name),
        phone: str(raw.phone),
        email: str(raw.email)?.toLowerCase() ?? null,
        website: str(raw.website),
        office_address: str(raw.office_address ?? raw.address),
        city: str(raw.city),
        state: str(raw.state),
        specialty: str(raw.specialty),
        coverage_areas: str(raw.coverage_areas),
        google_place_id,
        source: str(raw.source) ?? 'csv_import',
        source_ref: str(raw.source_ref) ?? google_place_id,
        stage,
        licence_number: str(raw.licence_number ?? raw.license_number),
        licence_state: str(raw.licence_state ?? raw.license_state),
        licence_status: str(raw.licence_status ?? raw.license_status),
        insurance_expiry: dateOnly(raw.insurance_expiry),
        insurance_status: str(raw.insurance_status),
        lat: num(raw.lat ?? raw.latitude),
        lng: num(raw.lng ?? raw.longitude),
        notes: str(raw.notes),
        is_simulation: false,
        created_by: user.id,
      });
    });

    if (dryRun) {
      return json({
        dryRun: true,
        received: rows.length,
        would_insert: accepted.length,
        rejected: rejects.length,
        rejects: rejects.slice(0, 100),
        batches: Math.ceil(accepted.length / BATCH_SIZE),
      });
    }

    let inserted = 0;
    let skippedDuplicate = 0;
    const batchErrors: { batch: number; error: string }[] = [];

    for (let b = 0; b < accepted.length; b += BATCH_SIZE) {
      const chunk = accepted.slice(b, b + BATCH_SIZE);
      const withPlace = chunk.filter((r) => r.google_place_id);
      const withoutPlace = chunk.filter((r) => !r.google_place_id);
      const batchNo = Math.floor(b / BATCH_SIZE) + 1;

      if (withPlace.length) {
        // ON CONFLICT (google_place_id) DO NOTHING
        const { data, error } = await admin
          .from('crm_partners')
          .upsert(withPlace, { onConflict: 'google_place_id', ignoreDuplicates: true })
          .select('id');
        if (error) {
          batchErrors.push({ batch: batchNo, error: error.message });
        } else {
          inserted += data?.length ?? 0;
          skippedDuplicate += withPlace.length - (data?.length ?? 0);
        }
      }

      if (withoutPlace.length) {
        const { data, error } = await admin
          .from('crm_partners')
          .insert(withoutPlace)
          .select('id');
        if (error) {
          batchErrors.push({ batch: batchNo, error: error.message });
        } else {
          inserted += data?.length ?? 0;
        }
      }
    }

    return json({
      dryRun: false,
      received: rows.length,
      inserted,
      skipped_duplicate_place_id: skippedDuplicate,
      rejected: rejects.length,
      rejects: rejects.slice(0, 100),
      batch_errors: batchErrors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('tt-partner-csv-import failed:', msg);
    return json({ error: 'unhandled', details: msg }, 500);
  }
});
