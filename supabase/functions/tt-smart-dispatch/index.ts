import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { resolveRouting } from "../_shared/serviceRouter.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'

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

    const routing = await resolveRouting(supabase, booking.service_slug || booking.service_type)
    const serviceCategory = routing.service_category
    const matchServiceTypes = routing.partner_types

    // Manual or unrouted: do not broadcast. Create routed lead + admin alert.
    if (routing._unrouted || routing.fulfillment_model === 'manual' || matchServiceTypes.length === 0) {
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
        status: routing._unrouted ? 'needs_review' : 'manual_queue',
        matched_partners: [],
        auto_matched: false,
      })
      await supabase.from('tt_notifications_log').insert({
        booking_id: booking.id,
        type: routing._unrouted ? 'unrouted_booking_alert' : 'manual_dispatch_required',
        channel: 'internal',
        recipient: 'admin',
        message: `${routing.display_name} booking ${booking.booking_reference} requires manual handling`,
        status: 'sent',
      })
      return new Response(JSON.stringify({
        success: true, matched: 0,
        fulfillment_model: routing.fulfillment_model,
        unrouted: !!routing._unrouted,
        message: 'Routed to manual queue',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ====== PATTERN DISPATCHER ======
    const pattern = (routing as any).dispatch_pattern as string | null
    const ctx = { supabase, publicClient, booking, routing, serviceCategory }

    console.log(`tt-smart-dispatch: booking=${booking.id} slug=${routing.slug} pattern=${pattern || 'NULL→legacy'}`)

    switch (pattern) {
      case 'pool_style':     return await selectPoolStyle(ctx)
      case 'asset_fallback': return await selectAssetFallback(ctx)
      case 'hybrid':         return await selectHybrid(ctx)
      case 'quote_region':   return await selectQuoteRegion(ctx)
      case 'broadcast_hold': return await selectBroadcastHold(ctx)
      default:               return await selectLegacyScored(ctx)
    }
  } catch (err) {
    console.error('tt-smart-dispatch error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ===================== HELPERS =====================

function jsonOk(body: any) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function resolvePickupState(b: any): string | null {
  if (b.pickup_state) return String(b.pickup_state).toUpperCase()
  const loc = b.pickup_location || ''
  const matches = loc.match(/\b[A-Z]{2}\b/g)
  return matches ? matches[matches.length - 1] : null
}

async function insertDispatchAndBroadcast(
  ctx: any,
  recipients: any[],
  meta: { dispatch_pattern: string; payment_leg: string | null; status: string }
) {
  const { supabase, booking, serviceCategory } = ctx

  // Normalize recipients to a common shape with phone
  const normalized = recipients.map((r: any) => ({
    id: r.id,
    partner_name: r.business_name || r.full_name || r.name || r.partner_name || 'Unknown',
    partner_type: r.partner_type || (r.vehicle_classes ? 'driver' : 'partner'),
    partner_phone: r.phone || r.contact_phone || r.contact_info?.phone || null,
    profit_margin: r.profit_margin ?? null,
    rating: r.rating ?? null,
    red_carpet: r.red_carpet ?? r.offers_red_carpet ?? null,
    star_ceiling: r.star_ceiling ?? r.offers_star_ceiling ?? null,
    styles_offered: r.styles_offered ?? null,
    vehicle_classes: r.vehicle_classes ?? null,
    service_regions: r.service_regions ?? null,
  }))

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
      status: meta.status,
      matched_partners: normalized,
      auto_matched: true,
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      dispatch_pattern: meta.dispatch_pattern,
      payment_leg: meta.payment_leg,
    })
    .select()
    .single()

  // SMS via Twilio gateway (only if status === 'sent')
  if (meta.status === 'sent') {
    const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')
    const fromPhone = Deno.env.get('TT_PHONE_NUMBER')

    const scheduledDate = booking.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'TBD'

    if (LOVABLE_API_KEY && TWILIO_API_KEY && fromPhone) {
      for (const r of normalized) {
        if (!r.partner_phone) continue
        const flagSuffix = meta.payment_leg ? `\n[FLAG: ${meta.payment_leg}]` : ''
        const msg = `TopTier Dispatch: ${serviceCategory.replace(/_/g, ' ')} booking\n` +
          `Client: ${booking.client_name || 'N/A'}\n` +
          `Pickup: ${booking.pickup_location || 'TBD'}\n` +
          `Date: ${scheduledDate}\n` +
          `Value: $${booking.total_price || 0}\n` +
          `Ref: ${booking.booking_reference || 'N/A'}\n\n` +
          `Reply YES to accept or NO to decline.\n` +
          `Expires in 30 minutes.${flagSuffix}`
        try {
          await fetch(`${GATEWAY_URL}/Messages.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TWILIO_API_KEY,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: r.partner_phone, From: fromPhone, Body: msg }),
          })
        } catch (smsErr) {
          console.error('SMS to partner failed:', smsErr)
        }
      }
    }

    await supabase.from('tt_bookings').update({ status: 'dispatched' }).eq('id', booking.id)
  }

  return jsonOk({
    matched: normalized.length,
    dispatch_request_id: dispatchReq?.id,
    dispatch_pattern: meta.dispatch_pattern,
    payment_leg: meta.payment_leg,
    status: meta.status,
    matched_partners: normalized,
  })
}

// ===================== SELECTORS =====================

// pool_style: black-truck → tt_drivers, vehicle_classes + styles_offered + amenity
async function selectPoolStyle(ctx: any) {
  const { supabase, booking, routing } = ctx
  // Drivers may be seeded with vehicle_classes containing either the routing slug
  // (e.g. 'black_truck') OR the canonical partner_types (chauffeur/sedan/suv).
  // Accept both. Status accepted: approved OR active (seed inconsistency).
  const classMatch = Array.from(new Set([
    routing.slug,
    routing.slug?.replace(/-/g, '_'),
    routing.slug?.replace(/_/g, '-'),
    ...routing.partner_types,
  ].filter(Boolean)))
  let q = supabase
    .from('tt_drivers')
    .select('id, owner_partner_id, full_name, phone, vehicle_classes, styles_offered, red_carpet, star_ceiling, rating, status')
    .in('status', ['approved', 'active'])
    .overlaps('vehicle_classes', classMatch)

  if (booking.requested_style)         q = q.contains('styles_offered', [booking.requested_style])
  if (booking.requested_red_carpet)    q = q.eq('red_carpet', true)
  if (booking.requested_star_ceiling)  q = q.eq('star_ceiling', true)

  const { data: drivers, error } = await q
  if (error) console.error('pool_style query error:', error.message)
  return await insertDispatchAndBroadcast(ctx, drivers || [], {
    dispatch_pattern: 'pool_style', payment_leg: null, status: 'sent',
  })
}

// asset_fallback: exotic / party-bus / yachts — owner first, then ordered fallback
async function selectAssetFallback(ctx: any) {
  const { supabase, booking, routing } = ctx
  let primary: any = null
  if (booking.vehicle_id) {
    const { data: v } = await supabase
      .from('tt_vehicles').select('owner_partner_id')
      .eq('id', booking.vehicle_id).maybeSingle()
    if (v?.owner_partner_id) {
      const { data: op } = await supabase
        .from('tt_partners').select('*')
        .eq('id', v.owner_partner_id).maybeSingle()
      primary = op
    }
  }

  const { data: pool } = await supabase
    .from('tt_partners').select('*')
    .in('partner_type', routing.partner_types)
    .eq('status', 'approved').eq('is_active', true)
    .order('profit_margin', { ascending: false, nullsFirst: false })
    .order('rating', { ascending: false, nullsFirst: false })

  const fallback = (pool || []).filter((p: any) => p.id !== primary?.id)
  let ordered = [primary, ...fallback].filter(Boolean)

  // Amenity filter for exotics only
  if (routing.partner_types.includes('exotic_supplier')) {
    ordered = ordered.filter((p: any) =>
      (!booking.requested_red_carpet   || p.offers_red_carpet === true) &&
      (!booking.requested_star_ceiling || p.offers_star_ceiling === true)
    )
  }

  return await insertDispatchAndBroadcast(ctx, ordered, {
    dispatch_pattern: 'asset_fallback', payment_leg: null, status: 'sent',
  })
}

// hybrid: sprinters — asset path if specialized vehicle exists, else pool path
async function selectHybrid(ctx: any) {
  const { supabase, booking } = ctx
  let hasAsset = false
  if (booking.requested_style) {
    const { data } = await supabase
      .from('tt_vehicles').select('id')
      .eq('style', booking.requested_style)
      .not('owner_partner_id', 'is', null)
      .limit(1)
    hasAsset = (data || []).length > 0
  }
  console.log(`hybrid branch: requested_style=${booking.requested_style} → ${hasAsset ? 'ASSET' : 'POOL'}`)
  return hasAsset ? await selectAssetFallback(ctx) : await selectPoolStyle(ctx)
}

// quote_region: private-jet / coach-bus — selection only, NO SMS, defer to cb-dispatch-engine
async function selectQuoteRegion(ctx: any) {
  const { supabase, booking, routing, serviceCategory } = ctx
  const state = resolvePickupState(booking)
  let q = supabase
    .from('tt_partners').select('*')
    .in('partner_type', routing.partner_types)
    .eq('status', 'approved').eq('is_active', true)
  if (state) q = q.overlaps('service_regions', [state])
  const { data: regional } = await q
  const list = regional || []

  const { data: dr } = await supabase.from('tt_dispatch_requests').insert({
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
    status: 'awaiting_quote',
    matched_partners: list,
    auto_matched: true,
    dispatch_pattern: 'quote_region',
    payment_leg: 'pay_after_quote_not_built',
  }).select().single()

  // NO SMS — cb-dispatch-engine owns the quote workflow
  return jsonOk({
    matched: list.length,
    dispatch_request_id: dr?.id,
    dispatch_pattern: 'quote_region',
    engine: 'cb-dispatch-engine',
    payment_leg: 'pay_after_quote_not_built',
    status: 'awaiting_quote',
    resolved_pickup_state: state,
    matched_partners: list,
  })
}

// broadcast_hold: helicopter / jetski / slingshot — region broadcast, payment leg parked
async function selectBroadcastHold(ctx: any) {
  const { supabase, booking, routing } = ctx
  const state = resolvePickupState(booking)
  let q = supabase
    .from('tt_partners').select('*')
    .in('partner_type', routing.partner_types)
    .eq('status', 'approved').eq('is_active', true)
  if (state) q = q.overlaps('service_regions', [state])
  const { data: regional } = await q
  return await insertDispatchAndBroadcast(ctx, regional || [], {
    dispatch_pattern: 'broadcast_hold',
    payment_leg: 'auth_hold_not_built',
    status: 'sent',
  })
}

// ===================== LEGACY (NULL pattern) — VERBATIM PRESERVED =====================
// All NULL-pattern services (beauty, chef, roses, media, security, massage, spa, club,
// corporate, art-gallery, custom-experience, art-commission, etc.) hit this path unchanged.
async function selectLegacyScored(ctx: any) {
  const { supabase, publicClient, booking, routing, serviceCategory } = ctx
  const matchServiceTypes = routing.partner_types

  console.log(`Querying public site partners with service_types overlapping: ${matchServiceTypes.join(', ')}`)

  const { data: publicPartners, error: partnerErr } = await publicClient
    .from('partners')
    .select('id, user_id, partner_type, business_name, status, service_types, markets, rating, average_response_minutes, is_active, capabilities, phone, contact_info, contact_phone, trust_score')
    .eq('status', 'approved')
    .eq('is_active', true)
    .overlaps('service_types', matchServiceTypes)

  if (partnerErr) console.error('Public partner query error:', partnerErr.message)
  const partners = publicPartners || []
  console.log(`Found ${partners.length} approved+active partners from public site`)

  const { data: localAssets } = await supabase
    .from('tt_partner_assets').select('*').eq('is_available', true)

  const candidates = partners.map((p: any) => {
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

  const publicIds = new Set(partners.map((p: any) => p.id))
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

  const bookingLocation = (booking.pickup_location || '').toLowerCase()
  const scored = allCandidates.map((c: any) => {
    let score = 0
    score += Math.min((c.rating || 0) * 4, 20)
    const resp = c.average_response_minutes || 120
    if (resp < 30) score += 30
    else if (resp < 60) score += 20
    else if (resp < 120) score += 10
    score += Math.min((c.trust_score || 0) / 10, 10)
    const marketMatch = (c.markets || []).some((m: string) =>
      bookingLocation.includes(m.toLowerCase()) || m.toLowerCase().includes(bookingLocation)
    )
    if (marketMatch) score += 30
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
      dispatch_pattern: null,
      payment_leg: null,
    })
    .select()
    .single()

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
        body: new URLSearchParams({ To: partner.partner_phone, From: fromPhone, Body: msg }),
      })
    } catch (smsErr) {
      console.error('SMS to partner failed:', smsErr)
    }
  }

  await supabase.from('tt_bookings').update({ status: 'dispatched' }).eq('id', booking.id)

  return new Response(JSON.stringify({
    success: true,
    matched: top5.length,
    dispatch_request_id: dispatchReq?.id,
    top_match: top5[0]?.partner_name || 'None',
    public_partners_found: partners.length,
    message: `Request sent to ${top5.length} partners`
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
