import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { booking_id } = await req.json()

    const { data: booking } = await supabase
      .from('tt_bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (!booking) throw new Error('Booking not found')

    const serviceCategory = booking.service_type || 'luxury_transport'

    const categoryMap: Record<string, string[]> = {
      luxury_transport: ['vehicle', 'individual'],
      exotic_rental: ['vehicle'],
      helicopter: ['aircraft'],
      private_jet: ['aircraft'],
      yacht_charter: ['vessel'],
      jetski: ['vessel'],
      private_chef: ['individual', 'team'],
      restaurant_experience: ['individual', 'team'],
      nightlife_vip: ['individual', 'team'],
      wellness_massage: ['individual'],
      beauty_services: ['individual'],
      spa_wellness: ['individual', 'team'],
      media_production: ['individual', 'team'],
      security_detail: ['individual', 'team'],
      event_space: ['team'],
      corporate_experience: ['team'],
    }

    const assetTypes = categoryMap[serviceCategory] || ['individual', 'team']

    const { data: assets } = await supabase
      .from('tt_partner_assets')
      .select('*')
      .eq('is_available', true)
      .in('asset_type', assetTypes)

    if (!assets || assets.length === 0) {
      await supabase.from('tt_dispatch_requests').insert({
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        service_type: booking.service_type,
        service_category: serviceCategory,
        pickup_location: booking.pickup_location,
        dropoff_location: booking.dropoff_location,
        scheduled_at: booking.scheduled_at,
        customer_name: booking.client_name,
        customer_phone: booking.client_phone,
        special_requests: booking.special_requests,
        total_price: booking.total_price,
        status: 'pending',
        matched_partners: [],
        auto_matched: false,
      })

      return new Response(JSON.stringify({
        success: true,
        matched: 0,
        message: 'No partners found — flagged for manual dispatch'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const scored = assets.map(asset => {
      let score = 0
      score += (Number(asset.rating) || 5) * 20
      if ((asset.response_time_minutes || 60) < 60) score += 20
      if ((asset.total_jobs || 0) > 10) score += 10

      const bookingLocation = (booking.pickup_location || '').toLowerCase()
      const markets = asset.markets || []
      const marketMatch = markets.some((m: string) =>
        bookingLocation.includes(m.toLowerCase())
      )
      if (marketMatch) score += 30

      if (Number(asset.base_rate) <= (booking.total_price || 9999)) score += 20

      return { ...asset, match_score: score }
    })

    const top5 = scored
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data: dispatchReq } = await supabase
      .from('tt_dispatch_requests')
      .insert({
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        service_type: booking.service_type,
        service_category: serviceCategory,
        pickup_location: booking.pickup_location,
        dropoff_location: booking.dropoff_location,
        scheduled_at: booking.scheduled_at,
        customer_name: booking.client_name,
        customer_phone: booking.client_phone,
        special_requests: booking.special_requests,
        total_price: booking.total_price,
        status: 'sent',
        matched_partners: top5,
        auto_matched: true,
        match_score: top5[0]?.match_score || 0,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select()
      .single()

    // Send SMS to each matched partner via Twilio
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromPhone = Deno.env.get('TT_PHONE_NUMBER')

    for (const partner of top5) {
      if (!partner.partner_phone) continue
      if (!twilioSid || !twilioToken || !fromPhone) break

      const msg = `TopTier Request: ${serviceCategory.replace(/_/g, ' ')} booking` +
        `\nClient: ${booking.client_name}` +
        `\nPickup: ${booking.pickup_location || 'TBD'}` +
        `\nDate: ${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString() : 'TBD'}` +
        `\nValue: $${booking.total_price || 0}` +
        `\nRef: ${booking.booking_reference}` +
        `\nReply YES to accept or NO to decline. Expires in 30 min.`

      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: partner.partner_phone,
              From: fromPhone,
              Body: msg,
            }),
          }
        )
      } catch (smsErr) {
        console.error('SMS to partner failed:', smsErr)
      }
    }

    await supabase
      .from('tt_bookings')
      .update({ status: 'dispatched' })
      .eq('id', booking_id)

    return new Response(JSON.stringify({
      success: true,
      matched: top5.length,
      dispatch_request_id: dispatchReq?.id,
      top_match: top5[0]?.partner_name || 'None',
      message: `Request sent to ${top5.length} partners`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('tt-smart-dispatch error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
