import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

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

    // Send SMS notification via Twilio if phone available
    if (booking?.client_phone) {
      const driverName = driver?.full_name || 'your driver';
      const eta = pickup_eta_minutes ? `${pickup_eta_minutes} minutes` : 'shortly';
      const vehicleInfo = driver?.vehicle_make ? `${driver.vehicle_make} ${driver.vehicle_model} (${driver.license_plate})` : 'Premium Vehicle';
      const message = `Your Top Tier driver ${driverName} is assigned and will arrive in ${eta}. Vehicle: ${vehicleInfo}. Ref: ${booking.booking_reference}`;

      // Log notification
      await supabase.from('tt_notifications_log').insert({
        booking_id,
        type: 'driver_assigned',
        channel: 'sms',
        recipient: booking.client_phone,
        message,
        status: 'pending',
      });

      // Attempt Twilio SMS
      try {
        const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const ttPhone = Deno.env.get('TT_PHONE_NUMBER');
        if (twilioSid && twilioToken && ttPhone) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioSid}:${twilioToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: booking.client_phone, From: ttPhone, Body: message }),
          });
        }
      } catch (smsErr) {
        console.error('SMS send failed:', smsErr);
      }
    }

    return new Response(JSON.stringify({ success: true, booking_id, driver_name: driver?.full_name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-assign-driver error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
