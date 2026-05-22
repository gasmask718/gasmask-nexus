// bulk-import-partners — admin-only CSV/array import of partners + their vehicles.
// Idempotent: matches existing partners on normalized phone or email.
// Validates and REPORTS rejects — never silent-drops.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type VehicleRow = {
  name: string;
  vehicle_class?: string | null;
  style?: string | null;
  color?: string | null;
  star_ceiling?: boolean | null;
  red_carpet?: boolean | null;
  dispatch_model?: string | null;
  partner_cost?: number | null;
  customer_price?: number | null;
  markup_pct?: number | null;
};

type PartnerRow = {
  business_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  partner_type: string;
  service_regions?: string[] | null;
  styles_offered?: string[] | null;
  default_partner_cost?: number | null;
  default_customer_price?: number | null;
  default_markup_pct?: number | null;
  vehicles?: VehicleRow[];
};

const FIXED_PRICE_PATTERNS = new Set(['asset_fallback', 'pool_style', 'hybrid']);
const normPhone = (s?: string | null) => (s ? s.replace(/\D/g, '') : null);
const normEmail = (s?: string | null) => (s ? s.trim().toLowerCase() : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const rows: PartnerRow[] = body.rows ?? [];
    const dryRun: boolean = body.dryRun ?? true;

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load valid partner_types and dispatch_pattern map
    const { data: routing } = await admin
      .from('tt_service_routing')
      .select('partner_types, dispatch_pattern');
    const validTypes = new Set<string>();
    const typeToPatterns: Record<string, Set<string>> = {};
    for (const r of routing ?? []) {
      for (const t of (r.partner_types as string[] | null) ?? []) {
        validTypes.add(t);
        if (!typeToPatterns[t]) typeToPatterns[t] = new Set();
        if (r.dispatch_pattern) typeToPatterns[t].add(r.dispatch_pattern);
      }
    }

    const rejects: { index: number; row: PartnerRow; reasons: string[] }[] = [];
    const accepts: { index: number; row: PartnerRow; mode: 'insert' | 'update'; existing_id?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const reasons: string[] = [];

      if (!r.business_name) reasons.push('missing_required:business_name');
      if (!r.phone && !r.email) reasons.push('missing_required:phone_or_email');
      if (!r.partner_type) reasons.push('missing_required:partner_type');
      else if (!validTypes.has(r.partner_type)) reasons.push(`unknown_partner_type:${r.partner_type}`);

      const patterns = typeToPatterns[r.partner_type] ?? new Set();
      const isFixedPrice = [...patterns].some((p) => FIXED_PRICE_PATTERNS.has(p));

      const vehicles = r.vehicles ?? [];
      for (let vi = 0; vi < vehicles.length; vi++) {
        const v = vehicles[vi];
        if (!v.name) reasons.push(`vehicle[${vi}]:missing_name`);
        if (isFixedPrice && v.customer_price == null && v.markup_pct == null) {
          reasons.push(`vehicle[${vi}]:missing_pricing`);
        }
        if (patterns.has('asset_fallback') && !v.dispatch_model) {
          reasons.push(`vehicle[${vi}]:missing_dispatch_model`);
        }
      }

      if (reasons.length > 0) {
        rejects.push({ index: i, row: r, reasons });
        continue;
      }

      // Idempotency lookup
      const phoneN = normPhone(r.phone);
      const emailN = normEmail(r.email);
      let existing_id: string | undefined;
      if (emailN || phoneN) {
        const orParts: string[] = [];
        if (emailN) orParts.push(`email.eq.${emailN}`);
        if (phoneN) orParts.push(`phone.eq.${phoneN}`);
        const { data: existing } = await admin
          .from('tt_partners')
          .select('id')
          .or(orParts.join(','))
          .maybeSingle();
        if (existing?.id) existing_id = existing.id;
      }

      accepts.push({ index: i, row: r, mode: existing_id ? 'update' : 'insert', existing_id });
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          would_insert: accepts.filter((a) => a.mode === 'insert').length,
          would_update: accepts.filter((a) => a.mode === 'update').length,
          rejected: rejects.length,
          accepts,
          rejects,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // COMMIT — every write is error-checked; failures surface to rejects.
    const results: {
      partner_id?: string;
      mode: string;
      partner_name: string;
      vehicles_attempted: number;
      vehicles_landed: number;
      vehicle_errors: string[];
    }[] = [];

    for (const a of accepts) {
      const r = a.row;
      const partnerPayload = {
        name: r.business_name,
        business_name: r.business_name,
        email: normEmail(r.email),
        phone: normPhone(r.phone),
        partner_type: r.partner_type,
        service_regions: r.service_regions ?? [],
        styles_offered: r.styles_offered ?? [],
        default_partner_cost: r.default_partner_cost ?? null,
        default_customer_price: r.default_customer_price ?? null,
        default_markup_pct: r.default_markup_pct ?? null,
        is_active: true,
        status: 'active',
        portal_status: 'seeded',
      };

      let partnerId = a.existing_id;
      if (partnerId) {
        const { error: updErr } = await admin
          .from('tt_partners')
          .update(partnerPayload)
          .eq('id', partnerId);
        if (updErr) {
          rejects.push({ index: a.index, row: r, reasons: [`partner_update_failed:${updErr.message}`] });
          continue;
        }
      } else {
        const { data: ins, error } = await admin
          .from('tt_partners')
          .insert(partnerPayload)
          .select('id')
          .single();
        if (error) {
          rejects.push({ index: a.index, row: r, reasons: [`partner_insert_failed:${error.message}`] });
          continue;
        }
        partnerId = ins!.id;
      }

      // Vehicles
      const vehicleErrors: string[] = [];
      let landed = 0;
      const attempted = (r.vehicles ?? []).length;

      for (let vi = 0; vi < attempted; vi++) {
        const v = r.vehicles![vi];
        const vehiclePayload = {
          owner_partner_id: partnerId,
          name: v.name,
          vehicle_class: v.vehicle_class ?? null,
          style: v.style ?? null,
          color: v.color ?? null,
          star_ceiling: v.star_ceiling ?? false,
          red_carpet: v.red_carpet ?? false,
          dispatch_model: v.dispatch_model ?? null,
          partner_cost: v.partner_cost ?? null,
          customer_price: v.customer_price ?? null,
          markup_pct: v.markup_pct ?? null,
          is_active: true,
        };
        const { data: existingV, error: lookupErr } = await admin
          .from('tt_vehicles')
          .select('id')
          .eq('owner_partner_id', partnerId!)
          .eq('name', v.name)
          .maybeSingle();
        if (lookupErr) {
          vehicleErrors.push(`vehicle[${vi}]:lookup_failed:${lookupErr.message}`);
          continue;
        }
        if (existingV?.id) {
          const { error: updErr } = await admin
            .from('tt_vehicles')
            .update(vehiclePayload)
            .eq('id', existingV.id);
          if (updErr) {
            vehicleErrors.push(`vehicle[${vi}]:update_failed:${updErr.message}`);
            continue;
          }
        } else {
          const { error: insErr } = await admin.from('tt_vehicles').insert(vehiclePayload);
          if (insErr) {
            vehicleErrors.push(`vehicle[${vi}]:insert_failed:${insErr.message}`);
            continue;
          }
        }
        landed++;
      }

      // Reconcile reported vs actual rows in DB for this partner
      const { count: actualCount, error: countErr } = await admin
        .from('tt_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('owner_partner_id', partnerId!);

      if (vehicleErrors.length > 0 || countErr || (actualCount ?? -1) < landed) {
        rejects.push({
          index: a.index,
          row: r,
          reasons: [
            ...vehicleErrors,
            ...(countErr ? [`reconcile_failed:${countErr.message}`] : []),
            `vehicles_attempted=${attempted} landed_in_loop=${landed} actual_in_db=${actualCount ?? 'unknown'}`,
          ],
        });
      }

      results.push({
        partner_id: partnerId!,
        mode: a.mode,
        partner_name: r.business_name,
        vehicles_attempted: attempted,
        vehicles_landed: landed,
        vehicle_errors: vehicleErrors,
      });
    }

    return new Response(
      JSON.stringify({
        dryRun: false,
        committed: results.length,
        rejected: rejects.length,
        results,
        rejects,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
