import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

const STATUS_MESSAGES: Record<string, string> = {
  driver_assigned: 'Your TopTier driver has been assigned to your ride.',
  en_route: 'Your TopTier driver is on the way!',
  arrived: 'Your TopTier driver has arrived at the pickup location.',
  completed: 'Thank you for riding with TopTier Experience! We hope you enjoyed the journey.',
  cancelled: 'Your TopTier booking has been cancelled. If a refund is due, it will be processed within 3-5 business days.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { booking_id, new_status, notes } = await req.json();

    if (!booking_id || !new_status) {
      return new Response(JSON.stringify({ error: 'booking_id and new_status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validStatuses = ['pending', 'confirmed', 'driver_assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(new_status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update booking
    const updateData: any = { status: new_status };
    if (notes) updateData.notes = notes;
    if (new_status === 'cancelled') updateData.payment_status = 'refunded';
    
    await supabase.from('tt_bookings').update(updateData).eq('id', booking_id);

    // Map booking status to dispatch status
    const dispatchStatusMap: Record<string, string> = {
      driver_assigned: 'assigned',
      en_route: 'en_route',
      arrived: 'arrived',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
    };

    const dispatchStatus = dispatchStatusMap[new_status];
    if (dispatchStatus) {
      const dispatchUpdate: any = { status: dispatchStatus };
      if (new_status === 'en_route') dispatchUpdate.driver_en_route_at = new Date().toISOString();
      if (new_status === 'arrived') dispatchUpdate.driver_arrived_at = new Date().toISOString();
      if (new_status === 'in_progress') dispatchUpdate.ride_started_at = new Date().toISOString();
      if (new_status === 'completed') dispatchUpdate.ride_completed_at = new Date().toISOString();
      
      await supabase.from('tt_dispatches').update(dispatchUpdate).eq('booking_id', booking_id);
    }

    // If completed, free the driver
    if (new_status === 'completed' || new_status === 'cancelled') {
      const { data: booking } = await supabase.from('tt_bookings').select('driver_id').eq('id', booking_id).single();
      if (booking?.driver_id) {
        await supabase.from('tt_drivers').update({ status: 'available' }).eq('id', booking.driver_id);
      }
    }

    // Send SMS notification
    const smsMessage = STATUS_MESSAGES[new_status];
    if (smsMessage) {
      const { data: booking } = await supabase.from('tt_bookings').select('client_phone,booking_reference').eq('id', booking_id).single();
      if (booking?.client_phone) {
        await supabase.from('tt_notifications_log').insert({
          booking_id,
          type: `status_${new_status}`,
          channel: 'sms',
          recipient: booking.client_phone,
          message: `${smsMessage} Ref: ${booking.booking_reference}`,
          status: 'pending',
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-update-booking-status error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
