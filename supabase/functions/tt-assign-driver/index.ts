import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'
import { sendSms } from '../_shared/sendSms.ts'
import { recordDispatchSuppressed } from '../_shared/dispatchOutcome.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { booking_id, driver_id, vehicle_id, pickup_eta_minutes } = await req.json();

    if (!booking_id || !driver_id) {
      return new Response(JSON.stringify({ error: 'booking_id and driver_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get driver info
    const { data: driver } = await supabase.from('tt_drivers').select('full_name,phone,vehicle_make,vehicle_model,license_plate').eq('id', driver_id).single();

    // Update booking
    await supabase.from('tt_bookings').update({ driver_id, status: 'driver_assigned' }).eq('id', booking_id);

    // Update dispatch
    await supabase.from('tt_dispatches').update({
      driver_id,
      vehicle_id: vehicle_id || null,
      assigned_at: new Date().toISOString(),
      status: 'assigned',
      pickup_eta_minutes: pickup_eta_minutes || null,
    }).eq('booking_id', booking_id);

    // Update driver status
    await supabase.from('tt_drivers').update({ status: 'on_assignment' }).eq('id', driver_id);

    // Get booking for customer phone
    const { data: booking } = await supabase.from('tt_bookings').select('client_phone,booking_reference').eq('id', booking_id).single();

    // Send SMS notification via the canonical chokepoint if phone available
    let customerSmsStatus = 'no_phone'
    if (booking?.client_phone) {
      const driverName = driver?.full_name || 'your driver';
      const eta = pickup_eta_minutes ? `${pickup_eta_minutes} minutes` : 'shortly';
      const vehicleInfo = driver?.vehicle_make ? `${driver.vehicle_make} ${driver.vehicle_model} (${driver.license_plate})` : 'Premium Vehicle';
      const message = `Your Top Tier driver ${driverName} is assigned and will arrive in ${eta}. Vehicle: ${vehicleInfo}. Ref: ${booking.booking_reference}`;

      // Group C (transactional): driver-assignment notice to the booking's own
      // customer, sent to the number captured on that booking.
      const sms = await sendSms({
        to: booking.client_phone,
        body: message,
        sendClass: 'transactional',
        purpose: 'tt_driver_assigned',
        idempotencyKey: `tt-assign-driver-${booking_id}`,
        from: Deno.env.get('TT_PHONE_NUMBER'),
        skipCooldown: true,
        metadata: { booking_reference: booking.booking_reference, driver_id },
      });

      if (sms.blocked) {
        customerSmsStatus = 'blocked'
        // Suppression-skipped, made visible: the customer never sees the
        // driver assignment. Row in tt_notifications_log, not an alert.
        await recordDispatchSuppressed(supabase, {
          bookingId: booking_id,
          bookingReference: booking.booking_reference,
          recipientPhone: booking.client_phone,
          recipientName: 'customer',
          sendClass: 'transactional',
          reason: sms.errorMessage || sms.status,
        });
      } else if (!sms.success) {
        customerSmsStatus = 'failed'
        console.error('SMS send failed:', sms.status, sms.errorMessage);
      } else {
        customerSmsStatus = 'sent'
      }

      // Log notification with the final outcome (was: inserted as 'pending'
      // and never resolved).
      await supabase.from('tt_notifications_log').insert({
        booking_id,
        type: 'driver_assigned',
        channel: 'sms',
        recipient: booking.client_phone,
        message,
        status: customerSmsStatus,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      booking_id,
      driver_name: driver?.full_name,
      customer_sms: customerSmsStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-assign-driver error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
