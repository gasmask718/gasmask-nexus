import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface PickupRequest {
  wholesaler_id: string;
  carrier: 'ups' | 'fedex' | 'usps' | 'ontrac' | 'lso';
  pickup_date: string; // YYYY-MM-DD
  window_start?: string; // HH:MM (24h)
  window_end?: string;   // HH:MM (24h)
  shipment_ids?: string[]; // dd_shipments.id[]
  instructions?: string;
  pickup_address?: {
    name?: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
    email?: string;
  };
}

const REQUIRED = ['street1', 'city', 'state', 'zip'] as const;

function normalizeAddress(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = {
    name: raw.name || raw.contact_name || raw.company || raw.company_name || '',
    company: raw.company || raw.company_name || '',
    street1: raw.street1 || raw.address_line_1 || raw.line1 || raw.street || '',
    street2: raw.street2 || raw.address_line_2 || raw.line2 || '',
    city: raw.city || '',
    state: raw.state || raw.region || '',
    zip: raw.zip || raw.postal_code || raw.postcode || '',
    country: raw.country || 'US',
    phone: raw.phone || '',
    email: raw.email || '',
  };
  for (const f of REQUIRED) if (!a[f as keyof typeof a]) return null;
  if (!a.name && !a.company) return null;
  return a;
}

function randomDemoConf(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `DEMO-${out}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = (await req.json().catch(() => null)) as PickupRequest | null;
    if (!body || !body.wholesaler_id || !body.carrier || !body.pickup_date) {
      return json({ error: 'wholesaler_id, carrier, and pickup_date are required' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Resolve pickup address — request body first, then wholesaler sources
    let pickupAddress = normalizeAddress(body.pickup_address);
    const addressSourceWarnings: string[] = [];

    if (!pickupAddress) {
      const { data: accts } = await supabase
        .from('dd_shipping_accounts')
        .select('carrier, pickup_address, is_active')
        .eq('wholesaler_id', body.wholesaler_id)
        .eq('is_active', true);
      const preferred = (accts ?? []).find((a: any) => a.carrier === body.carrier);
      const chosen = preferred ?? (accts ?? [])[0];
      if (chosen) {
        const addr = normalizeAddress(chosen.pickup_address);
        if (addr) pickupAddress = addr;
        else addressSourceWarnings.push(`dd_shipping_accounts (${chosen.carrier}) pickup_address incomplete`);
      }
    }

    if (!pickupAddress) {
      const { data: pickups } = await supabase
        .from('dd_pickup_schedules')
        .select('pickup_address, created_at')
        .eq('wholesaler_id', body.wholesaler_id)
        .order('created_at', { ascending: false })
        .limit(5);
      for (const p of pickups ?? []) {
        const addr = normalizeAddress(p.pickup_address);
        if (addr) { pickupAddress = addr; break; }
      }
    }

    if (!pickupAddress) {
      const { data: wp } = await supabase
        .from('wholesaler_profiles')
        .select('company_name, contact_name, phone, email, shipping_preferences')
        .eq('id', body.wholesaler_id)
        .maybeSingle();
      const prefs = wp?.shipping_preferences as any;
      const candidate = prefs?.origin_address ?? prefs?.pickup_address ?? prefs?.address ?? null;
      const addr = normalizeAddress({
        name: wp?.contact_name,
        company: wp?.company_name,
        phone: wp?.phone,
        email: wp?.email,
        ...(candidate || {}),
      });
      if (addr) pickupAddress = addr;
    }

    if (!pickupAddress) {
      return json({
        error:
          'Pickup address not found for wholesaler. Provide pickup_address in the request, or configure dd_shipping_accounts.pickup_address / dd_pickup_schedules.pickup_address / wholesaler_profiles.shipping_preferences.origin_address (street1, city, state, zip, name).',
        address_source_warnings: addressSourceWarnings,
        wholesaler_id: body.wholesaler_id,
      });
    }

    // 2) Time windows — default 10:00–16:00 local
    const windowStart = body.window_start ?? '10:00';
    const windowEnd = body.window_end ?? '16:00';

    // EasyPost key loaded from dd_ai_config (env-var propagation workaround)
    const { data: epCfg } = await supabase
      .from('dd_ai_config')
      .select('easypost_api_key, easypost_mode')
      .eq('id', 1)
      .maybeSingle();
    const easypostKey = epCfg?.easypost_api_key ?? null;
    const easypostMode = epCfg?.easypost_mode ?? 'test';

    if (!easypostKey) {
      // DEMO MODE
      const demoConfirmation = randomDemoConf();
      const { data: row, error: insErr } = await supabase
        .from('dd_pickup_schedules')
        .insert({
          wholesaler_id: body.wholesaler_id,
          carrier: body.carrier,
          easypost_pickup_id: demoConfirmation,
          pickup_date: body.pickup_date,
          pickup_window_start: windowStart,
          pickup_window_end: windowEnd,
          pickup_address: pickupAddress,
          shipment_ids: body.shipment_ids ?? [],
          status: 'scheduled',
          instructions: body.instructions ?? null,
        })
        .select()
        .single();

      return json({
        demo_mode: true,
        demo_confirmation: demoConfirmation,
        confirmation_number: demoConfirmation,
        pickup_schedule_id: row?.id ?? null,
        pickup_address: pickupAddress,
        insert_error: insErr?.message ?? null,
      });
    }

    // 3) REAL MODE — EasyPost pickup
    // If shipment_ids provided, resolve their EasyPost shipment ids
    let easypostShipmentIds: string[] = [];
    if (body.shipment_ids?.length) {
      const { data: shipRows } = await supabase
        .from('dd_shipments')
        .select('id, easypost_shipment_id')
        .in('id', body.shipment_ids);
      easypostShipmentIds = (shipRows ?? [])
        .map((s: any) => s.easypost_shipment_id)
        .filter((v: string | null) => !!v);
    }

    const authHeader = 'Basic ' + btoa(easypostKey + ':');
    // EasyPost expects ISO datetimes for min/max
    const minDT = `${body.pickup_date}T${windowStart}:00`;
    const maxDT = `${body.pickup_date}T${windowEnd}:00`;

    const pickupPayload: any = {
      pickup: {
        address: {
          name: pickupAddress.name,
          company: pickupAddress.company,
          street1: pickupAddress.street1,
          street2: pickupAddress.street2,
          city: pickupAddress.city,
          state: pickupAddress.state,
          zip: pickupAddress.zip,
          country: pickupAddress.country || 'US',
          phone: pickupAddress.phone,
          email: pickupAddress.email,
        },
        min_datetime: minDT,
        max_datetime: maxDT,
        is_account_address: false,
        instructions: body.instructions ?? '',
        reference: `wh_${body.wholesaler_id.slice(0, 8)}_${body.pickup_date}`,
      },
    };
    if (easypostShipmentIds.length === 1) {
      pickupPayload.pickup.shipment = { id: easypostShipmentIds[0] };
    } else if (easypostShipmentIds.length > 1) {
      pickupPayload.pickup.shipments = easypostShipmentIds.map((id) => ({ id }));
    }

    const createRes = await fetch('https://api.easypost.com/v2/pickups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(pickupPayload),
    });
    const created = await createRes.json().catch(() => null);
    if (!createRes.ok || !created || created.error) {
      return json({ error: created?.error?.message ?? `EasyPost pickup create failed (${createRes.status})`, easypost_response: created });
    }

    // Pick a rate for the requested carrier (cheapest match); if none, skip buy
    const rates: any[] = created.pickup_rates ?? [];
    let confirmationNumber: string | null = null;
    let boughtPickup: any = created;

    const carrierRates = rates.filter((r) => (r.carrier || '').toLowerCase() === body.carrier.toLowerCase());
    const chosen = (carrierRates.length ? carrierRates : rates).reduce(
      (a: any, b: any) => (a && Number(a.rate) < Number(b.rate) ? a : b),
      null,
    );

    if (chosen) {
      const buyRes = await fetch(`https://api.easypost.com/v2/pickups/${created.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ carrier: chosen.carrier, service: chosen.service }),
      });
      const bought = await buyRes.json().catch(() => null);
      if (buyRes.ok && bought && !bought.error) {
        boughtPickup = bought;
        confirmationNumber = bought.confirmation ?? null;
      } else {
        // record the create anyway, just note the buy failure
        addressSourceWarnings.push(`EasyPost pickup buy failed: ${bought?.error?.message ?? buyRes.status}`);
      }
    }

    const status = confirmationNumber ? 'confirmed' : 'scheduled';

    const { data: row, error: insErr } = await supabase
      .from('dd_pickup_schedules')
      .insert({
        wholesaler_id: body.wholesaler_id,
        carrier: body.carrier,
        easypost_pickup_id: boughtPickup.id ?? created.id,
        pickup_date: body.pickup_date,
        pickup_window_start: windowStart,
        pickup_window_end: windowEnd,
        pickup_address: pickupAddress,
        shipment_ids: body.shipment_ids ?? [],
        status,
        instructions: body.instructions ?? null,
      })
      .select()
      .single();

    return json({
      demo_mode: false,
      confirmation_number: confirmationNumber,
      easypost_pickup_id: boughtPickup.id ?? created.id,
      status,
      pickup_schedule_id: row?.id ?? null,
      pickup_address: pickupAddress,
      pickup_rates: rates,
      chosen_rate: chosen,
      address_source_warnings: addressSourceWarnings,
      insert_error: insErr?.message ?? null,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
