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

type DecoratorProfile = {
  name?: string | null;
  city: string;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  service_radius_miles?: number | null;
  specialties?: string[] | null;
  bio?: string | null;
  portfolio_images?: string[] | null;
  base_price_min?: number | null;
  base_price_max?: number | null;
};

type PackageInput = {
  category: string;
  name: string;
  description?: string | null;
  price: number;
  platform_fee_pct?: number | null;
  is_published?: boolean | null;
  inclusions?: unknown;
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
  decorator_profile?: DecoratorProfile | null;
  packages?: PackageInput[];
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

      if (r.partner_type === 'decorator') {
        const dp = r.decorator_profile;
        if (!dp) reasons.push('decorator_profile:missing');
        else {
          if (!dp.city) reasons.push('decorator_profile:missing_city');
          if (dp.service_radius_miles == null) reasons.push('decorator_profile:missing_service_radius_miles');
        }
      }

      if (r.packages && r.packages.length > 0) {
        if (r.partner_type !== 'decorator') {
          reasons.push('packages:only_allowed_for_decorator');
        } else {
          const validCats = new Set(['hotel-decor', 'truck-decor']);
          r.packages.forEach((pkg, pi) => {
            if (!pkg?.name) reasons.push(`packages[${pi}]:missing_name`);
            if (!pkg?.category) reasons.push(`packages[${pi}]:missing_category`);
            else if (!validCats.has(pkg.category)) reasons.push(`packages[${pi}]:invalid_category:${pkg.category}`);
            const price = Number(pkg?.price);
            if (!Number.isFinite(price) || price <= 0) reasons.push(`packages[${pi}]:price_must_be_gt_0`);
            const fee = pkg?.platform_fee_pct;
            if (fee != null && (Number(fee) < 0 || Number(fee) > 100)) reasons.push(`packages[${pi}]:fee_out_of_range`);
          });
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

      // Decorator profile (paired row in `decorators`, linked by tt_partner_id)
      if (r.partner_type === 'decorator' && r.decorator_profile) {
        const dp = r.decorator_profile;
        const decoratorPayload = {
          tt_partner_id: partnerId!,
          name: dp.name ?? r.business_name,
          city: dp.city,
          state: dp.state ?? null,
          lat: dp.lat ?? null,
          lng: dp.lng ?? null,
          service_radius_miles: dp.service_radius_miles ?? 25,
          specialties: dp.specialties ?? [],
          bio: dp.bio ?? null,
          portfolio_images: dp.portfolio_images ?? [],
          base_price_min: dp.base_price_min ?? null,
          base_price_max: dp.base_price_max ?? null,
          is_active: true,
        };
        const { data: existingDec, error: decLookupErr } = await admin
          .from('decorators')
          .select('id')
          .eq('tt_partner_id', partnerId!)
          .maybeSingle();
        if (decLookupErr) {
          rejects.push({ index: a.index, row: r, reasons: [`decorator_lookup_failed:${decLookupErr.message}`] });
          continue;
        }
        if (existingDec?.id) {
          const { error: decUpdErr } = await admin
            .from('decorators')
            .update(decoratorPayload)
            .eq('id', existingDec.id);
          if (decUpdErr) {
            rejects.push({ index: a.index, row: r, reasons: [`decorator_update_failed:${decUpdErr.message}`] });
            continue;
          }
        } else {
          const { error: decInsErr } = await admin.from('decorators').insert(decoratorPayload);
          if (decInsErr) {
            rejects.push({ index: a.index, row: r, reasons: [`decorator_insert_failed:${decInsErr.message}`] });
            continue;
          }
        }
      }

      // Decorator packages — idempotent on (tt_partner_id, name).
      // Only runs for decorators; validation already gated this above.
      const packageErrors: string[] = [];
      if (r.partner_type === 'decorator' && r.packages && r.packages.length > 0) {
        for (let pi = 0; pi < r.packages.length; pi++) {
          const pkg = r.packages[pi];
          const pkgPayload = {
            tt_partner_id: partnerId!,
            provider_id: null,
            category: pkg.category,
            name: pkg.name,
            description: pkg.description ?? null,
            price: pkg.price,
            platform_fee_pct: pkg.platform_fee_pct ?? 15,
            inclusions: pkg.inclusions ?? [],
            is_published: pkg.is_published ?? false,
            is_active: true,
          };
          const { data: existingPkg, error: pkgLookupErr } = await admin
            .from('provider_packages')
            .select('id')
            .eq('tt_partner_id', partnerId!)
            .eq('name', pkg.name)
            .maybeSingle();
          if (pkgLookupErr) {
            packageErrors.push(`packages[${pi}]:lookup_failed:${pkgLookupErr.message}`);
            continue;
          }
          if (existingPkg?.id) {
            const { error: pkgUpdErr } = await admin
              .from('provider_packages')
              .update(pkgPayload)
              .eq('id', existingPkg.id);
            if (pkgUpdErr) packageErrors.push(`packages[${pi}]:update_failed:${pkgUpdErr.message}`);
          } else {
            const { error: pkgInsErr } = await admin.from('provider_packages').insert(pkgPayload);
            if (pkgInsErr) packageErrors.push(`packages[${pi}]:insert_failed:${pkgInsErr.message}`);
          }
        }
        if (packageErrors.length > 0) {
          rejects.push({ index: a.index, row: r, reasons: packageErrors });
        }
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
