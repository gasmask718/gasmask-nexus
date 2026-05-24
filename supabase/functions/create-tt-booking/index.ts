import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'
import { resolveRouting } from '../_shared/serviceRouter.ts'

function generateBookingRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'TT-';
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const {
      customer_name, customer_email, customer_phone,
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      pickup_datetime, vehicle_id, passenger_count,
      add_ons, special_requests, stripe_payment_intent_id, total_price,
      service_slug, service_type: incomingServiceType,
      chosen_partner_id,        // tt_partners.id (preferred)
      chosen_decorator_id,      // decorators.id (legacy public-site id) — resolved via Phase-1 link
      // Truck-decor addon (black-truck + decor coordinated)
      decor_addon,              // boolean
      decor_partner_id: incomingDecorPartnerId,  // tt_partners.id (preferred)
      decor_decorator_id,       // decorators.id (legacy) — resolved via decorators.tt_partner_id
      decor_package_slug,
      // Auth-then-capture payment flow (slingshot/jetski/helicopter)
      payment_mode,             // 'auth_hold' | 'paid' (default 'paid' for back-compat)
    } = body;

    if (!customer_name || !pickup_address || !pickup_datetime || !total_price) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const booking_reference = generateBookingRef();

    // Resolve routing from slug / legacy service_type (defaults to black-truck for back-compat)
    const routing = await resolveRouting(supabase, service_slug || incomingServiceType || 'black-truck');

    // Auth-then-capture flow detection. Public site sends payment_mode='auth_hold' for
    // slingshot/jetski/helicopter when it creates a manual-capture PaymentIntent.
    const isAuthHold = payment_mode === 'auth_hold';
    if (isAuthHold && !stripe_payment_intent_id) {
      return new Response(JSON.stringify({
        error: 'payment_mode=auth_hold requires stripe_payment_intent_id',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const initialStatus = routing._unrouted
      ? 'needs_review'
      : (isAuthHold ? 'authorized_pending_confirmation' : 'confirmed');
    const initialPaymentStatus = isAuthHold ? 'authorized' : 'paid';
    const initialHoldStatus = isAuthHold ? 'hold_placed' : 'none';
    const holdWindowMinutes = (routing as any).auth_hold_window_minutes ?? 120;
    const authExpiresAt = isAuthHold
      ? new Date(Date.now() + holdWindowMinutes * 60_000).toISOString()
      : null;

    // Resolve chosen decorator → tt_partners.id (for marketplace_direct dispatch)
    let resolvedPartnerId: string | null = chosen_partner_id ?? null;
    if (!resolvedPartnerId && chosen_decorator_id) {
      const { data: dec, error: decErr } = await supabase
        .from('decorators').select('tt_partner_id')
        .eq('id', chosen_decorator_id).maybeSingle();
      if (decErr) throw decErr;  // surface, never swallow
      resolvedPartnerId = dec?.tt_partner_id ?? null;
      if (!resolvedPartnerId) {
        return new Response(JSON.stringify({
          error: `chosen_decorator_id ${chosen_decorator_id} has no linked tt_partner_id`,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Truck-decor addon — resolve & validate decor partner when decor_addon=true
    let resolvedDecorPartnerId: string | null = incomingDecorPartnerId ?? null;
    if (decor_addon === true) {
      if (!resolvedDecorPartnerId && decor_decorator_id) {
        const { data: dec, error: decErr } = await supabase
          .from('decorators').select('tt_partner_id')
          .eq('id', decor_decorator_id).maybeSingle();
        if (decErr) throw decErr;
        resolvedDecorPartnerId = dec?.tt_partner_id ?? null;
      }
      if (!resolvedDecorPartnerId) {
        return new Response(JSON.stringify({
          error: 'decor_addon=true requires decor_partner_id (or resolvable decor_decorator_id)',
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: dp, error: dpErr } = await supabase
        .from('tt_partners').select('id')
        .eq('id', resolvedDecorPartnerId).maybeSingle();
      if (dpErr) throw dpErr;
      if (!dp) {
        return new Response(JSON.stringify({
          error: `decor_partner_id ${resolvedDecorPartnerId} not found in tt_partners`,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: booking, error: bookingErr } = await supabase.from('tt_bookings').insert({
      client_name: customer_name,
      client_email: customer_email,
      client_phone: customer_phone,
      service_type: routing.service_category,
      service_name: routing.display_name,
      service_slug: routing.slug,
      fulfillment_model: routing.fulfillment_model,
    const { data: booking, error: bookingErr } = await supabase.from('tt_bookings').insert({
      client_name: customer_name,
      client_email: customer_email,
      client_phone: customer_phone,
      service_type: routing.service_category,
      service_name: routing.display_name,
      service_slug: routing.slug,
      fulfillment_model: routing.fulfillment_model,
      total_price,
      status: initialStatus,
      payment_status: initialPaymentStatus,
      payment_hold_status: initialHoldStatus,
      stripe_payment_intent_id: stripe_payment_intent_id ?? null,
      auth_expires_at: authExpiresAt,
      booking_reference,
      pickup_location: pickup_address,
      dropoff_location: dropoff_address,
      pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
      scheduled_at: pickup_datetime,
      vehicle_id,
      passenger_count,
      special_requests,
      notes: add_ons ? JSON.stringify(add_ons) : null,
      partner_id: resolvedPartnerId,
      decor_addon: decor_addon === true,
      decor_partner_id: decor_addon === true ? resolvedDecorPartnerId : null,
      decor_package_slug: decor_addon === true ? (decor_package_slug ?? null) : null,
    }).select().single();


    if (bookingErr) throw bookingErr;

    if (routing._unrouted) {
      await supabase.from('tt_notifications_log').insert({
        booking_id: booking.id,
        type: 'unrouted_booking_alert',
        channel: 'internal',
        recipient: 'admin',
        message: `Unrouted service "${service_slug || incomingServiceType}" — booking ${booking_reference} needs review`,
        status: 'sent',
      });
    }

    await supabase.from('tt_dispatches').insert({
      booking_id: booking.id,
      vehicle_id,
      status: 'pending',
    });

    // Auto-fire smart dispatch when this is an auth-hold flow — we need partners to
    // accept so we can capture the PaymentIntent. Black-truck dispatch is triggered
    // by the existing fulfillment pipeline; don't double-fire there.
    if (isAuthHold && !routing._unrouted) {
      try {
        await supabase.functions.invoke('tt-smart-dispatch', {
          body: { booking_id: booking.id },
        });
      } catch (e) {
        console.error('[create-tt-booking] smart-dispatch invoke failed:', e);
        await supabase.from('tt_notifications_log').insert({
          booking_id: booking.id,
          type: 'dispatch_invoke_failed',
          channel: 'internal',
          recipient: 'admin',
          message: `Auth-hold booking ${booking_reference} created but tt-smart-dispatch failed: ${(e as any)?.message ?? e}`,
          status: 'sent',
        });
      }
    }

    if (customer_phone) {
      await supabase.from('tt_notifications_log').insert({
        booking_id: booking.id,
        type: 'booking_confirmation',
        channel: 'sms',
        recipient: customer_phone,
        message: `Your TopTier booking ${booking_reference} is confirmed for ${pickup_datetime}. Total: $${total_price}`,
        status: 'pending',
      });
    }

    return new Response(JSON.stringify({
      booking_id: booking.id,
      booking_reference,
      status: initialStatus,
      service_category: routing.service_category,
      fulfillment_model: routing.fulfillment_model,
      unrouted: !!routing._unrouted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-tt-booking error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
