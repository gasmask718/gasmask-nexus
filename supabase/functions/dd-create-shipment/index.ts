import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { hydrateItems, loadBoxes, packItems } from '../_shared/ddBoxing.ts';

interface ShipmentRequest {
  order_id: string;
  wholesaler_id: string;
  store_id?: string;
  to_address: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  items: Array<{
    product_id: string;
    quantity: number;
    // Dimensions are OPTIONAL on the request — when omitted they are hydrated
    // from products_all so callers (e.g. dd-order-fulfillment-kickoff) never
    // have to carry them. A parcel is never rated on guessed numbers silently:
    // any hydrated fallback is reported in packing_warnings.
    length_in?: number;
    width_in?: number;
    height_in?: number;
    weight_oz?: number;
    is_fragile?: boolean;
    stackable?: boolean;
  }>;
  carrier_preference?: 'any' | 'ups' | 'fedex' | 'usps';
  prefer_flat_rate?: boolean;
  service_level?: string; // e.g. 'Priority', 'Ground'
}

const REQUIRED_ADDR_FIELDS = ['street1', 'city', 'state', 'zip'] as const;

function normalizeAddress(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = {
    name: raw.name || raw.company || raw.contact_name || '',
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
  for (const f of REQUIRED_ADDR_FIELDS) {
    if (!a[f as keyof typeof a]) return null;
  }
  if (!a.name && !a.company) return null;
  return a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = (await req.json().catch(() => null)) as ShipmentRequest | null;
    if (!body || !body.order_id || !body.wholesaler_id || !body.to_address || !Array.isArray(body.items)) {
      return json({ error: 'order_id, wholesaler_id, to_address, and items are required' });
    }

    const toAddress = normalizeAddress(body.to_address);
    if (!toAddress) {
      return json({ error: 'to_address is missing required fields (street1, city, state, zip, name)' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) MANDATORY: pack first — never label without box selection + billable weight.
    //    Dimensions come from products_all when the caller didn't supply them.
    const hydrated = await hydrateItems(supabase, body.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
    const packItemsInput = hydrated.map((h, idx) => {
      const supplied = body.items[idx] ?? {};
      return {
        ...h,
        length_in: Number(supplied.length_in) > 0 ? Number(supplied.length_in) : h.length_in,
        width_in: Number(supplied.width_in) > 0 ? Number(supplied.width_in) : h.width_in,
        height_in: Number(supplied.height_in) > 0 ? Number(supplied.height_in) : h.height_in,
        weight_oz: Number(supplied.weight_oz) > 0 ? Number(supplied.weight_oz) : h.weight_oz,
        is_fragile: supplied.is_fragile ?? h.is_fragile,
        stackable: supplied.stackable ?? h.stackable,
      };
    });

    const boxes = await loadBoxes(supabase, body.carrier_preference ?? 'any');
    if (boxes.length === 0) {
      return json({ error: 'No active boxes configured in dd_box_sizes — cannot select a box or rate a parcel' });
    }
    const packing = packItems(packItemsInput, boxes, { preferFlatRate: body.prefer_flat_rate ?? false });
    const dimensionWarnings = hydrated
      .filter((h, idx) => h.missing_dimensions && !(Number(body.items[idx]?.length_in) > 0))
      .map((h) => `Product ${h.product_id} has no weight/dimensions on file — rated on a conservative fallback parcel. Carrier may re-weigh and bill an adjustment.`);
    packing.warnings.push(...dimensionWarnings);

    if (!packing.boxes || packing.boxes.length === 0) {
      return json({ error: 'Packing calculation returned no boxes', packing_result: packing });
    }

    // 2) Resolve wholesaler origin address (wholesaler, not central warehouse)
    const carrier = body.carrier_preference && body.carrier_preference !== 'any' ? body.carrier_preference : null;

    let fromAddress: any = null;
    const addressSourceWarnings: string[] = [];

    // Preferred: dd_shipping_accounts.pickup_address (carrier-specific if provided)
    let saQuery = supabase
      .from('dd_shipping_accounts')
      .select('carrier, pickup_address, is_active')
      .eq('wholesaler_id', body.wholesaler_id)
      .eq('is_active', true);
    if (carrier) saQuery = saQuery.eq('carrier', carrier);
    const { data: shippingAccts } = await saQuery;
    for (const sa of shippingAccts ?? []) {
      const addr = normalizeAddress(sa.pickup_address);
      if (addr) { fromAddress = addr; break; }
      addressSourceWarnings.push(`dd_shipping_accounts (${sa.carrier}) pickup_address incomplete`);
    }

    // Fallback 1: most recent dd_pickup_schedules.pickup_address
    if (!fromAddress) {
      const { data: pickups } = await supabase
        .from('dd_pickup_schedules')
        .select('pickup_address, carrier, created_at')
        .eq('wholesaler_id', body.wholesaler_id)
        .order('created_at', { ascending: false })
        .limit(5);
      for (const p of pickups ?? []) {
        const addr = normalizeAddress(p.pickup_address);
        if (addr) { fromAddress = addr; break; }
      }
      if (!fromAddress && pickups && pickups.length > 0) {
        addressSourceWarnings.push('dd_pickup_schedules rows exist but none had a complete pickup_address');
      }
    }

    // Fallback 2: wholesaler_profiles.shipping_preferences.origin_address
    if (!fromAddress) {
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
      if (addr) fromAddress = addr;
    }

    if (!fromAddress) {
      return json({
        error:
          'Wholesaler origin address not found. Add a complete mailing address (street1, city, state, zip, name) to dd_shipping_accounts.pickup_address, dd_pickup_schedules.pickup_address, or wholesaler_profiles.shipping_preferences.origin_address.',
        address_source_warnings: addressSourceWarnings,
        wholesaler_id: body.wholesaler_id,
      });
    }

    // 3) Rate + label — EasyPost key loaded from dd_ai_config (env-var propagation workaround)
    const { data: epCfg } = await supabase
      .from('dd_ai_config')
      .select('easypost_api_key, easypost_mode')
      .eq('id', 1)
      .maybeSingle();
    const easypostKey = epCfg?.easypost_api_key ?? null;
    const easypostMode = epCfg?.easypost_mode ?? 'test';
    const primaryBox = packing.boxes[0];

    // Sum billable weight across all boxes for a quick shipment-level number stored on row
    const totalBillableOz = packing.boxes.reduce((s: number, b: any) => s + Number(b.billable_weight_oz || 0), 0);

    if (!easypostKey) {
      // DEMO MODE — no key configured
      const demoRates = packing.boxes.flatMap((b: any) => [
        { carrier: 'USPS', service: 'Priority', rate: (5.0 + b.billable_weight_oz * 0.08).toFixed(2), currency: 'USD', box_id: b.box_id, demo: true },
        { carrier: 'UPS', service: 'Ground', rate: (7.5 + b.billable_weight_oz * 0.06).toFixed(2), currency: 'USD', box_id: b.box_id, demo: true },
        { carrier: 'FedEx', service: 'Ground', rate: (7.9 + b.billable_weight_oz * 0.055).toFixed(2), currency: 'USD', box_id: b.box_id, demo: true },
      ]);

      // Persist a demo shipment row for audit trail
      const { data: shipRow, error: shipErr } = await supabase
        .from('dd_shipments')
        .insert({
          order_id: body.order_id,
          wholesaler_id: body.wholesaler_id,
          store_id: body.store_id ?? null,
          carrier: 'demo',
          service_level: body.service_level ?? 'demo',
          status: 'pending',
          weight_oz: totalBillableOz,
          length_in: primaryBox.dimensions.length_in,
          width_in: primaryBox.dimensions.width_in,
          height_in: primaryBox.dimensions.height_in,
          rates_compared: demoRates,
          from_address: fromAddress,
          to_address: toAddress,
          packing_result: packing,
          box_count: packing.box_count,
          label_status: 'demo',
          box_id: primaryBox.box_id,
          box_name: primaryBox.box_name,
          rated_weight_oz: primaryBox.actual_weight_oz,
          dim_weight_oz: primaryBox.dim_weight_oz,
          billable_weight_oz: totalBillableOz,
        })
        .select()
        .single();

      return json({
        demo_mode: true,
        demo_rates: demoRates,
        packing_result: packing,
        packing_warnings: packing.warnings,
        box_instructions: packing.boxes.map((b: any) => `Use ${b.box_name}`),
        shipment_id: shipRow?.id ?? null,
        from_address: fromAddress,
        to_address: toAddress,
        address_source_warnings: addressSourceWarnings,
        shipment_insert_error: shipErr?.message ?? null,
      });
    }

    // 4) REAL MODE — EasyPost
    // NOTE: we create ONE EasyPost shipment per box; return list.
    const authHeader = 'Basic ' + btoa(easypostKey + ':');
    const results: any[] = [];

    for (const box of packing.boxes) {
      const epBody = {
        shipment: {
          to_address: {
            name: toAddress.name,
            company: toAddress.company,
            street1: toAddress.street1,
            street2: toAddress.street2,
            city: toAddress.city,
            state: toAddress.state,
            zip: toAddress.zip,
            country: toAddress.country || 'US',
            phone: toAddress.phone,
            email: toAddress.email,
          },
          from_address: {
            name: fromAddress.name,
            company: fromAddress.company,
            street1: fromAddress.street1,
            street2: fromAddress.street2,
            city: fromAddress.city,
            state: fromAddress.state,
            zip: fromAddress.zip,
            country: fromAddress.country || 'US',
            phone: fromAddress.phone,
            email: fromAddress.email,
          },
          parcel: {
            length: Number(box.dimensions.length_in),
            width: Number(box.dimensions.width_in),
            height: Number(box.dimensions.height_in),
            weight: Number(box.billable_weight_oz), // ounces
          },
        },
      };

      const rateRes = await fetch('https://api.easypost.com/v2/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify(epBody),
      });
      const epShipment = await rateRes.json().catch(() => null);
      if (!rateRes.ok || !epShipment || epShipment.error) {
        results.push({ box_id: box.box_id, error: epShipment?.error?.message ?? `EasyPost rate error (${rateRes.status})` });
        continue;
      }

      // pick rate: match carrier_preference/service_level, else cheapest
      const rates: any[] = epShipment.rates ?? [];
      let chosen = rates[0];
      if (carrier) {
        const filtered = rates.filter((r) => (r.carrier || '').toLowerCase() === carrier.toLowerCase());
        if (filtered.length) chosen = filtered.reduce((a, b) => (Number(a.rate) < Number(b.rate) ? a : b));
      } else if (rates.length) {
        chosen = rates.reduce((a, b) => (Number(a.rate) < Number(b.rate) ? a : b));
      }
      if (body.service_level && rates.length) {
        const match = rates.find((r) => (r.service || '').toLowerCase() === body.service_level!.toLowerCase());
        if (match) chosen = match;
      }
      if (!chosen) {
        results.push({ box_id: box.box_id, error: 'No rates returned', easypost_shipment_id: epShipment.id, rates_compared: rates });
        continue;
      }

      // buy label
      const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${epShipment.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ rate: { id: chosen.id } }),
      });
      const bought = await buyRes.json().catch(() => null);
      if (!buyRes.ok || !bought || bought.error) {
        results.push({
          box_id: box.box_id,
          easypost_shipment_id: epShipment.id,
          rates_compared: rates,
          error: bought?.error?.message ?? `EasyPost buy error (${buyRes.status})`,
        });
        continue;
      }

      // insert dd_shipments row
      const { data: shipRow, error: shipErr } = await supabase
        .from('dd_shipments')
        .insert({
          order_id: body.order_id,
          wholesaler_id: body.wholesaler_id,
          store_id: body.store_id ?? null,
          carrier: (chosen.carrier || '').toLowerCase(),
          service_level: chosen.service || null,
          tracking_number: bought.tracking_code ?? null,
          label_url: bought.postage_label?.label_url ?? null,
          label_pdf_url: bought.postage_label?.label_pdf_url ?? null,
          easypost_shipment_id: bought.id,
          status: 'label_created',
          weight_oz: Number(box.billable_weight_oz),
          length_in: Number(box.dimensions.length_in),
          width_in: Number(box.dimensions.width_in),
          height_in: Number(box.dimensions.height_in),
          rate_selected: Number(chosen.rate),
          rates_compared: rates,
          from_address: fromAddress,
          to_address: toAddress,
          packing_result: { ...packing, this_box: box },
          box_count: 1,
          label_status: 'purchased',
          box_id: box.box_id,
          box_name: box.box_name,
          rated_weight_oz: box.actual_weight_oz,
          dim_weight_oz: box.dim_weight_oz,
          billable_weight_oz: box.billable_weight_oz,
        })
        .select()
        .single();

      results.push({
        box_id: box.box_id,
        box_name: box.box_name,
        billable_weight_oz: box.billable_weight_oz,
        shipment_id: shipRow?.id ?? null,
        easypost_shipment_id: bought.id,
        tracking_number: bought.tracking_code,
        label_url: bought.postage_label?.label_url,
        rate: chosen.rate,
        carrier: chosen.carrier,
        service: chosen.service,
        shipment_insert_error: shipErr?.message ?? null,
      });
    }

    const purchased = results.filter((r: any) => r.tracking_number);
    const first = purchased[0] ?? null;

    if (purchased.length === 0) {
      return json({
        error: `No label purchased: ${results.map((r: any) => r.error).filter(Boolean).join('; ') || 'unknown'}`,
        shipments: results,
        packing_result: packing,
      });
    }

    return json({
      demo_mode: false,
      // Flat summary fields — dd-order-fulfillment-kickoff reads these.
      shipment_id: first?.shipment_id ?? null,
      easypost_shipment_id: first?.easypost_shipment_id ?? null,
      tracking_number: first?.tracking_number ?? null,
      label_url: first?.label_url ?? null,
      carrier: first?.carrier ?? null,
      box_instructions: purchased.map((r: any) => `Use ${r.box_name}`),
      packing_warnings: packing.warnings,
      shipments: results,
      box_count: packing.box_count,
      packing_result: packing,
      from_address: fromAddress,
      to_address: toAddress,
      address_source_warnings: addressSourceWarnings,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
