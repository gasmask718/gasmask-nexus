import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'

// Maps booking service_type to values found in partner service_types array
const serviceTypeMap: Record<string, string[]> = {
  luxury_transport: ['chauffeur', 'sprinter', 'sedan', 'suv', 'limo'],
  exotic_rental: ['exotic', 'rental', 'supercar'],
  helicopter: ['helicopter', 'aviation'],
  private_jet: ['jet', 'aviation', 'private_jet'],
  yacht_charter: ['yacht', 'marine', 'vessel'],
  private_chef: ['chef', 'culinary', 'catering'],
  nightlife_vip: ['nightlife', 'vip', 'bottle'],
  wellness_massage: ['massage', 'wellness', 'spa'],
  beauty_services: ['beauty', 'styling', 'glam'],
  media_production: ['photographer', 'videographer', 'media', 'photography'],
  security_detail: ['security', 'protection'],
  event_space: ['venue', 'events', 'space'],
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
    const matchServiceTypes = serviceTypeMap[serviceCategory] || [serviceCategory]

    // Query partners: status = 'approved' AND is_active = true
    // Use overlaps to match service_types array
    console.log(`Querying public site partners with service_types overlapping: ${matchServiceTypes.join(', ')}`)

    const { data: publicPartners, error: partnerErr } = await publicClient
      .from('partners')
      .select('id, user_id, partner_type, business_name, status, service_types, markets, rating, average_response_minutes, is_active, capabilities, phone, contact_info, contact_phone, trust_score')
      .eq('status', 'approved')
      .eq('is_active', true)
      .overlaps('service_types', matchServiceTypes)

    if (partnerErr) {
      console.error('Public partner query error:', partnerErr.message)
    }

    const partners = publicPartners || []
    console.log(`Found ${partners.length} approved+active partners from public site`)

    // Get local tt_partner_assets for enrichment
    const { data: localAssets } = await supabase
      .from('tt_partner_assets')
      .select('*')
      .eq('is_available', true)

    // Build candidates from public partners
    const candidates = partners.map(p => {
      const linkedAsset = (localAssets || []).find(
        (a: any) => a.partner_id === p.id || a.partner_id === p.user_id
      )
      const phone = p.phone || p.contact_info?.phone || p.contact_phone || linkedAsset?.partner_phone || null
      const caps = p.capabilities || {}

      return {
        id: p.id,
        partner_name: p.business_name || 'Unknown Partner',
        partner_type: p.partner_type,
        partner_phone: phone,
        service_types: p.service_types || [],
        markets: p.markets || [],
        rating: Number(p.rating) || 0,
        average_response_minutes: Number(p.average_response_minutes) || 120,
        trust_score: Number(p.trust_score) || 0,
        capabilities: caps,
        base_rate: linkedAsset ? Number(linkedAsset.base_rate) || 0 : 0,
        asset_name: linkedAsset?.asset_name || p.business_name,
      }
    })

    // Include local-only assets
    const publicIds = new Set(partners.map(p => p.id))
    const localOnly = (localAssets || []).filter(
      (a: any) => !publicIds.has(a.partner_id)
    ).map((a: any) => ({
      id: a.id,
      partner_name: a.partner_name || 'Local Partner',
      partner_type: a.partner_type || 'individual',
      partner_phone: a.partner_phone || null,
      service_types: [],
      markets: a.markets || [],
      rating: Number(a.rating) || 0,
      average_response_minutes: 60,
      trust_score: 0,
      capabilities: {},
      base_rate: Number(a.base_rate) || 0,
      asset_name: a.asset_name,
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
        success: true, matched: 0,
        message: 'No partners found — flagged for manual dispatch'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Score candidates
    const bookingLocation = (booking.pickup_location || '').toLowerCase()

    const scored = allCandidates.map(c => {
      let score = 0

      // Rating: 0-5 scale × 20 = max 100 → capped contribution ~20
      score += Math.min((c.rating || 0) * 4, 20)

      // Response speed
      const resp = c.average_response_minutes || 120
      if (resp < 30) score += 30
      else if (resp < 60) score += 20
      else if (resp < 120) score += 10

      // Trust score (0-100 scale, /10 → max 10)
      score += Math.min((c.trust_score || 0) / 10, 10)

      // Market/location match (+30)
      const marketMatch = (c.markets || []).some((m: string) =>
        bookingLocation.includes(m.toLowerCase()) || m.toLowerCase().includes(bookingLocation)
      )
      if (marketMatch) score += 30

      // Capabilities bonuses
      if (c.capabilities?.vip_handling) score += 15
      if (c.capabilities?.last_minute) score += 10

      return { ...c, match_score: score }
    })

    const top5 = scored.sort((a, b) => b.match_score - a.match_score).slice(0, 5)
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

    // SMS via Twilio gateway
    const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
    const fromPhone = Deno.env.get('TT_PHONE_NUMBER')

    const scheduledDate = booking.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'TBD'

    for (const partner of top5) {
      if (!partner.partner_phone) continue
      if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !fromPhone) break

      const msg = `TopTier Dispatch: ${serviceCategory.replace(/_/g, ' ')} booking\n` +
        `Client: ${booking.client_name || 'N/A'}\n` +
        `Pickup: ${booking.pickup_location || 'TBD'}\n` +
        `Date: ${scheduledDate}\n` +
        `Value: $${booking.total_price || 0}\n` +
        `Ref: ${booking.booking_reference || 'N/A'}\n\n` +
        `Reply YES to accept or NO to decline.\n` +
        `Expires in 30 minutes.`

      try {
        await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TWILIO_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: partner.partner_phone,
            From: fromPhone,
            Body: msg,
          }),
        })
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
      public_partners_found: partners.length,
      message: `Request sent to ${top5.length} partners`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('tt-smart-dispatch error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
