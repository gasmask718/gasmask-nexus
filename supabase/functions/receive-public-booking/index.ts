import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { resolveRouting } from "../_shared/serviceRouter.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const webhookSecret = req.headers.get('x-webhook-secret')
    const expectedSecret = Deno.env.get('PUBLIC_SITE_WEBHOOK_SECRET')

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      local_booking_id,
      customer_name,
      customer_email,
      customer_phone,
      service_type,
      service_name,
      pickup_location,
      dropoff_location,
      scheduled_at,
      total_price,
      special_requests,
      metadata
    } = body

    const booking_reference = 'TT-' + (local_booking_id || '').slice(0, 8).toUpperCase()
    const routing = await resolveRouting(supabase, service_type)
    const status = routing._unrouted ? 'needs_review' : 'pending'

    const { data: osBooking, error } = await supabase
      .from('tt_bookings')
      .insert({
        client_name: customer_name || 'Website Inquiry',
        client_email: customer_email || null,
        client_phone: customer_phone || null,
        service_type: routing.service_category,
        service_name: service_name || routing.display_name,
        service_slug: routing.slug,
        pickup_location: pickup_location || null,
        dropoff_location: dropoff_location || null,
        scheduled_at: scheduled_at || null,
        total_price: total_price || 0,
        status,
        payment_status: 'unpaid',
        booking_reference: booking_reference,
        fulfillment_model: routing.fulfillment_model,
        special_requests: special_requests || null,
        source: 'public_website',
        notes: metadata ? JSON.stringify(metadata) : null,
      })
      .select('id')
      .single()

    if (error) throw error

    if (routing._unrouted) {
      await supabase.from('tt_notifications_log').insert({
        booking_id: osBooking.id,
        type: 'unrouted_booking_alert',
        channel: 'internal',
        recipient: 'admin',
        message: `Unrouted public service "${service_type}" — ${booking_reference} needs review`,
        status: 'sent',
      })
    }

    await supabase.from('tt_dispatches').insert({
      booking_id: osBooking.id,
      status: 'pending',
    })

    await supabase.from('tt_notifications_log').insert({
      booking_id: osBooking.id,
      type: 'new_booking_from_website',
      channel: 'internal',
      recipient: 'dispatch',
      message: `New ${routing.display_name} booking from ${customer_name} — ${booking_reference}`,
      status: 'sent',
    })

    // Auto-trigger smart dispatch only for auto_dispatch / quote_then_dispatch
    const shouldDispatch = !routing._unrouted &&
      (routing.fulfillment_model === 'auto_dispatch' ||
       routing.fulfillment_model === 'quote_then_dispatch')

    if (shouldDispatch) {
      try {
        const dispatchRes = await supabase.functions.invoke(
          'tt-smart-dispatch',
          { body: { booking_id: osBooking.id } }
        )
        console.log('Auto-dispatch result:', dispatchRes.data)
      } catch (dispatchErr) {
        console.error('Auto-dispatch failed (non-critical):', dispatchErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        os_booking_id: osBooking.id,
        booking_reference,
        service_category: routing.service_category,
        fulfillment_model: routing.fulfillment_model,
        unrouted: !!routing._unrouted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('receive-public-booking error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
