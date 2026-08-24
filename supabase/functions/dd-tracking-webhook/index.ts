import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// EasyPost tracker status → dd_shipments.status
// dd_shipments.status enum:
//   pending | label_created | picked_up | in_transit | out_for_delivery |
//   delivered | exception | returned
const STATUS_MAP: Record<string, string> = {
  unknown: 'label_created',
  pre_transit: 'label_created',
  in_transit: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  available_for_pickup: 'out_for_delivery',
  delivered: 'delivered',
  return_to_sender: 'returned',
  cancelled: 'exception',
  failure: 'exception',
  error: 'exception',
};

async function verifySignature(rawBody: string, headerSig: string | null, secret: string): Promise<boolean> {
  if (!headerSig) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sigBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // EasyPost sends 'hmac-sha256-hex=...'
  const provided = headerSig.replace(/^hmac-sha256-hex=/i, '').trim().toLowerCase();
  return provided === hex;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. POST only.' }, 200);
  }

  try {
    const rawBody = await req.text();

    // Optional signature verification (only if secret configured)
    const webhookSecret = Deno.env.get('EASYPOST_WEBHOOK_SECRET');
    if (webhookSecret) {
      const sigHeader =
        req.headers.get('X-Hmac-Signature') ||
        req.headers.get('x-hmac-signature') ||
        req.headers.get('X-EasyPost-Hmac-Signature');
      const ok = await verifySignature(rawBody, sigHeader, webhookSecret);
      if (!ok) return json({ error: 'Invalid webhook signature' });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Invalid JSON body' });
    }

    // EasyPost event shape: { description, mode, previous_attributes, result: {...tracker...}, ... }
    // Accept either the full event or a bare tracker object (for manual tests)
    const tracker = event?.result ?? event?.tracker ?? event;
    if (!tracker || typeof tracker !== 'object') {
      return json({ error: 'No tracker payload found in event' });
    }

    const trackingCode: string | null = tracker.tracking_code ?? null;
    const shipmentId: string | null = tracker.shipment_id ?? null;
    const trackerId: string | null = tracker.id ?? null;
    const carrier: string | null = tracker.carrier ?? null;
    const rawStatus: string = (tracker.status ?? '').toString().toLowerCase();
    const mappedStatus = STATUS_MAP[rawStatus];

    if (!trackingCode && !shipmentId && !trackerId) {
      return json({ error: 'Event missing tracking_code, shipment_id, and tracker id — cannot match a shipment' });
    }
    if (!mappedStatus) {
      return json({
        warning: `Unrecognized tracker status "${rawStatus}" — no update applied`,
        tracking_code: trackingCode,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Match dd_shipments — prefer easypost_shipment_id, fall back to tracking_number
    let query = supabase.from('dd_shipments').select('id, status, tracking_number, easypost_shipment_id, order_id, wholesaler_id, billable_weight_oz, rate_selected');
    if (shipmentId) {
      query = query.eq('easypost_shipment_id', shipmentId);
    } else if (trackingCode) {
      query = query.eq('tracking_number', trackingCode);
    } else {
      // last resort: by tracker id stored as easypost_shipment_id (rare)
      query = query.eq('easypost_shipment_id', trackerId!);
    }

    const { data: matches, error: findErr } = await query;
    if (findErr) return json({ error: `Lookup failed: ${findErr.message}` });
    if (!matches || matches.length === 0) {
      return json({
        warning: 'No matching dd_shipments row found for this tracker',
        tracking_code: trackingCode,
        easypost_shipment_id: shipmentId,
      });
    }

    // Compute estimated / actual delivery from tracker payload
    const estDelivery = tracker.est_delivery_date ?? null;
    let actualDelivery: string | null = null;
    if (mappedStatus === 'delivered') {
      const details: any[] = Array.isArray(tracker.tracking_details) ? tracker.tracking_details : [];
      const deliveredDetail = [...details].reverse().find((d) => (d.status || '').toLowerCase() === 'delivered');
      actualDelivery = deliveredDetail?.datetime ?? tracker.updated_at ?? new Date().toISOString();
    }

    const updated: any[] = [];
    for (const row of matches) {
      const patch: Record<string, unknown> = { status: mappedStatus };
      if (!row.tracking_number && trackingCode) patch.tracking_number = trackingCode;
      if (carrier) patch.carrier = carrier.toLowerCase();
      if (estDelivery) patch.estimated_delivery = estDelivery;
      if (actualDelivery) patch.actual_delivery = actualDelivery;

      const { data: upd, error: updErr } = await supabase
        .from('dd_shipments')
        .update(patch)
        .eq('id', row.id)
        .select('id, status')
        .single();
      if (updErr) {
        updated.push({ id: row.id, error: updErr.message });
      } else {
        updated.push(upd);
      }
    }

    // Carrier re-weigh / dimension adjustment.
    // The carrier measures the parcel at the depot; if it is heavier or bulkier
    // than the numbers we rated on, an adjustment lands on Dynasty's account
    // weeks later and is invisible until the invoice. Flag it against the
    // supplier whose dimensions were wrong so a repeat offender can be corrected.
    const billedWeightOz = Number(tracker.weight ?? event?.result?.weight ?? NaN); // EasyPost reports oz
    const adjustmentAmount = Number(
      event?.result?.adjustment ?? event?.adjustment ?? tracker.adjustment ?? NaN,
    );
    for (const row of matches) {
      const rated = Number((row as any).billable_weight_oz ?? 0);
      const hasWeightVariance =
        Number.isFinite(billedWeightOz) && billedWeightOz > 0 && rated > 0 &&
        billedWeightOz > rated * 1.1 && billedWeightOz - rated >= 4;
      const hasCharge = Number.isFinite(adjustmentAmount) && adjustmentAmount !== 0;
      if (!hasWeightVariance && !hasCharge) continue;
      const { error: adjErr } = await supabase.rpc('dd_record_carrier_adjustment', {
        _shipment_id: (row as any).id,
        _billed_weight_oz: Number.isFinite(billedWeightOz) ? billedWeightOz : null,
        _adjustment_amount: Number.isFinite(adjustmentAmount) ? adjustmentAmount : 0,
        _detail: { rated_billable_oz: rated, carrier, source_event: event?.description ?? 'tracker', tracking_code: trackingCode },
      });
      if (adjErr) console.error('[dd-tracking-webhook] adjustment record failed:', adjErr.message);
      else console.log(`[dd-tracking-webhook] carrier adjustment flagged shipment=${(row as any).id} rated=${rated}oz billed=${billedWeightOz}oz`);
    }

    // Propagate to the order pipeline so the customer + portals see movement:
    // marketplace_fulfillments tracks the wholesaler's leg; the order flips to
    // 'shipped' when any leg moves and 'delivered' only when every leg is delivered.
    const ffStatus =
      mappedStatus === 'delivered' ? 'delivered'
      : (mappedStatus === 'in_transit' || mappedStatus === 'out_for_delivery') ? 'shipped'
      : null;
    if (ffStatus) {
      for (const row of matches) {
        const oid = (row as any).order_id;
        if (!oid) continue;
        let ffQ = supabase
          .from('marketplace_fulfillments')
          .update({ status: ffStatus, updated_at: new Date().toISOString() })
          .eq('order_id', oid);
        ffQ = (row as any).wholesaler_id ? ffQ.eq('wholesaler_id', (row as any).wholesaler_id) : ffQ;
        const { error: ffErr } = await ffQ;
        if (ffErr) console.error('[dd-tracking-webhook] fulfillment propagate failed:', ffErr.message);
      }
    }
    const orderIds = Array.from(new Set(matches.map((m: any) => m.order_id).filter(Boolean)));
    for (const oid of orderIds) {
      const { data: legs } = await supabase.from('dd_shipments').select('status').eq('order_id', oid as string);
      const all = legs ?? [];
      if (all.length === 0) continue;
      if (all.every((s: any) => s.status === 'delivered')) {
        await supabase.from('marketplace_orders').update({ fulfillment_status: 'delivered' }).eq('id', oid as string);
      } else if (all.some((s: any) => s.status === 'in_transit' || s.status === 'out_for_delivery' || s.status === 'delivered')) {
        await supabase.from('marketplace_orders').update({ fulfillment_status: 'shipped' }).eq('id', oid as string);
      }
    }

    return json({
      ok: true,
      matched: matches.length,
      updated,
      tracker: {
        tracking_code: trackingCode,
        easypost_shipment_id: shipmentId,
        raw_status: rawStatus,
        mapped_status: mappedStatus,
        carrier,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
