import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Dynasty OS client for local tables
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Public site client for partners table
    const publicServiceKey = Deno.env.get('PUBLIC_SITE_SERVICE_ROLE_KEY')
    const publicAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWhreXZ3dGZwZnZpd252aG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM3MzAsImV4cCI6MjA3NzY4OTczMH0.XqD-w-e-tOYnF87rpxvspwdyhk63hBm4WNErwpXq5iE'
    const publicClient = createClient(PUBLIC_URL, publicServiceKey || publicAnonKey)

    const { booking_id } = await req.json()

    const { data: booking } = await supabase
      .from('tt_bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (!booking) throw new Error('Booking not found')

    const serviceCategory = booking.service_type || 'luxury_transport'

    // Map booking service types to partner_type values on public site
    const partnerTypeMap: Record<string, string[]> = {
      luxury_transport: ['luxury_transport', 'chauffeur', 'transportation'],
      exotic_rental: ['exotic_rental', 'vehicle_rental', 'transportation'],
      helicopter: ['helicopter', 'aviation', 'aircraft'],
      private_jet: ['private_jet', 'aviation', 'aircraft'],
      yacht_charter: ['yacht_charter', 'marine', 'vessel'],
      jetski: ['jetski', 'marine', 'vessel'],
      private_chef: ['private_chef', 'culinary', 'dining'],
      restaurant_experience: ['restaurant', 'culinary', 'dining'],
      nightlife_vip: ['nightlife', 'entertainment', 'vip'],
      wellness_massage: ['wellness', 'spa', 'massage'],
      beauty_services: ['beauty', 'styling'],
      spa_wellness: ['spa', 'wellness'],
      media_production: ['media', 'photography', 'videography'],
      security_detail: ['security', 'protection'],
      event_space: ['events', 'venue'],
      corporate_experience: ['corporate', 'events'],
    }

    const matchTypes = partnerTypeMap[serviceCategory] || [serviceCategory]

    // Query active partners from the PUBLIC site database
    console.log(`Querying public site partners for types: ${matchTypes.join(', ')}`)
    
    let publicPartners: any[] = []
    for (const pType of matchTypes) {
      const { data, error } = await publicClient
        .from('partners')
        .select('id, user_id, partner_type, business_name, status, service_types')
        .eq('status', 'active')
        .eq('partner_type', pType)

      if (error) {
        console.error(`Public partner query error for type ${pType}:`, error.message)
      }
      if (data && data.length > 0) {
        publicPartners.push(...data)
      }
    }

    // Deduplicate by id
    const seen = new Set<string>()
    publicPartners = publicPartners.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    console.log(`Found ${publicPartners.length} active partners from public site`)

    // Also get local tt_partner_assets for scoring enrichment
    const assetCategoryMap: Record<string, string[]> = {
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

    const assetTypes = assetCategoryMap[serviceCategory] || ['individual', 'team']

    const { data: localAssets } = await supabase
      .from('tt_partner_assets')
      .select('*')
      .eq('is_available', true)
      .in('asset_type', assetTypes)

    // Merge: combine public partners with local asset enrichment
    const candidates = publicPartners.map(partner => {
      // Find matching local asset for this partner
      const linkedAsset = (localAssets || []).find(
        (a: any) => a.partner_id === partner.id || a.partner_id === partner.user_id
      )

      return {
        id: partner.id,
        partner_name: partner.business_name || 'Unknown Partner',
        partner_type: partner.partner_type,
        partner_phone: linkedAsset?.partner_phone || null,
        asset_name: linkedAsset?.asset_name || partner.business_name,
        asset_type: linkedAsset?.asset_type || 'individual',
        rating: linkedAsset ? Number(linkedAsset.rating) || 5 : 5,
        response_time_minutes: linkedAsset?.response_time_minutes || 60,
        total_jobs: linkedAsset?.total_jobs || 0,
        base_rate: linkedAsset ? Number(linkedAsset.base_rate) || 0 : 0,
        markets: linkedAsset?.markets || [],
        service_types: partner.service_types || [],
      }
    })

    // Also include local-only assets not linked to public partners
    const publicIds = new Set(publicPartners.map(p => p.id))
    const localOnly = (localAssets || []).filter(
      (a: any) => !publicIds.has(a.partner_id)
    ).map((asset: any) => ({
      id: asset.id,
      partner_name: asset.partner_name || 'Local Partner',
      partner_type: asset.partner_type || 'individual',
      partner_phone: asset.partner_phone || null,
      asset_name: asset.asset_name,
      asset_type: asset.asset_type,
      rating: Number(asset.rating) || 5,
      response_time_minutes: asset.response_time_minutes || 60,
      total_jobs: asset.total_jobs || 0,
      base_rate: Number(asset.base_rate) || 0,
      markets: asset.markets || [],
      service_types: [],
    }))

    const allCandidates = [...candidates, ...localOnly]

    if (allCandidates.length === 0) {
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

    // Score each candidate
    const scored = allCandidates.map(c => {
      let score = 0
      score += (c.rating || 5) * 20
      if ((c.response_time_minutes || 60) < 60) score += 20
      if ((c.total_jobs || 0) > 10) score += 10

      const bookingLocation = (booking.pickup_location || '').toLowerCase()
      const markets = c.markets || []
      const marketMatch = markets.some((m: string) =>
        bookingLocation.includes(m.toLowerCase())
      )
      if (marketMatch) score += 30

      if (c.base_rate <= (booking.total_price || 9999)) score += 20

      return { ...c, match_score: score }
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
      public_partners_found: publicPartners.length,
      local_assets_found: (localAssets || []).length,
      message: `Request sent to ${top5.length} partners (${publicPartners.length} from public site)`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('tt-smart-dispatch error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
