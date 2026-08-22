import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { resolveRouting } from "../_shared/serviceRouter.ts"
import { sendSms } from "../_shared/sendSms.ts"
import { recordDispatchSuppressed } from "../_shared/dispatchOutcome.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'

// Normalize any stored phone to strict E.164 (with leading +).
// Defense-in-depth: storage may drift; Twilio outbound + inbound-match both require '+'.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits         // bare US 10-digit
  if (digits.length >= 11 && digits.length <= 15) return '+' + digits
  return null
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
    const ctx: any = { supabase, publicClient, booking, routing, serviceCategory, errors: [] as string[] }

    console.log(`tt-smart-dispatch: booking=${booking.id} slug=${routing.slug} pattern=${pattern || 'NULL→legacy'}`)

    // ====== PRE-SWITCH DECOR ADDON DETECTOR (truck-with-decor coordination) ======
    // Fires ONLY when this is a black-truck booking carrying a decor addon.
    // Side-effect: creates a SECOND tt_dispatch_requests row for the DECORATOR
    // (marketplace_direct, targeting decor_partner_id). The main switch still runs
    // the truck pattern below against the unmodified ctx.
    // Standalone truck-decor bookings DO NOT trigger this (decor_addon=false).
    // Decor failure is logged + surfaced; it does NOT abort the truck dispatch.
    const isTruckWithDecor =
      (booking.service_slug === 'black-truck' || routing.slug === 'black-truck') &&
      booking.decor_addon === true &&
      !!booking.decor_partner_id
    if (isTruckWithDecor) {
      try {
        const decorRouting = await resolveRouting(supabase, 'truck-decor')
        const decorCtx = {
          ...ctx,
          booking: { ...ctx.booking, partner_id: ctx.booking.decor_partner_id },
          routing: decorRouting,
          serviceCategory: decorRouting.service_category,
          errors: [] as string[],
        }
        console.log(`decor-addon detector: firing decor dispatch for booking=${booking.id} decorator=${booking.decor_partner_id}`)
        await selectMarketplaceDirect(decorCtx)
        if (decorCtx.errors.length) ctx.errors.push(...decorCtx.errors.map((e: string) => `decor_addon: ${e}`))
      } catch (decorErr) {
        console.error('decor-addon detector failed:', decorErr)
        ctx.errors.push(`decor_addon: ${(decorErr as Error).message}`)
        await supabase.from('tt_notifications_log').insert({
          booking_id: booking.id,
          type: 'truck_decor_addon_dispatch_failed',
          channel: 'internal', recipient: 'admin', status: 'sent',
          message: `Truck-decor addon dispatch failed for booking ${booking.booking_reference}: ${(decorErr as Error).message}`,
        })
      }
    }

    switch (pattern) {
      case 'pool_style':         return await selectPoolStyle(ctx)
      case 'asset_fallback':     return await selectAssetFallback(ctx)
      case 'hybrid':             return await selectHybrid(ctx)
      case 'quote_region':       return await selectQuoteRegion(ctx)
      case 'broadcast_hold':     return await selectBroadcastHold(ctx)
      case 'marketplace_direct': return await selectMarketplaceDirect(ctx)
      default:                   return await selectLegacyScored(ctx)
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

// Compute the inclusive date range a booking occupies (YYYY-MM-DD).
// Falls back to single-day when no duration/end fields are present.
function getBookingDateRange(booking: any): { start: string; end: string } {
  const rawStart = booking?.scheduled_at ? String(booking.scheduled_at) : new Date().toISOString()
  const start = rawStart.slice(0, 10)
  let end = start
  try {
    if (booking?.scheduled_end_at) {
      end = String(booking.scheduled_end_at).slice(0, 10)
    } else if (typeof booking?.duration_hours === 'number' && booking.duration_hours > 24) {
      const s = new Date(rawStart)
      end = new Date(s.getTime() + booking.duration_hours * 3600_000).toISOString().slice(0, 10)
    } else if (typeof booking?.duration_days === 'number' && booking.duration_days > 1) {
      const s = new Date(rawStart)
      end = new Date(s.getTime() + booking.duration_days * 86400_000).toISOString().slice(0, 10)
    } else if (typeof booking?.total_trip_duration_minutes === 'number' && booking.total_trip_duration_minutes > 1440) {
      const s = new Date(rawStart)
      end = new Date(s.getTime() + booking.total_trip_duration_minutes * 60_000).toISOString().slice(0, 10)
    }
  } catch {
    end = start
  }
  return end >= start ? { start, end } : { start, end: start }
}

async function insertDispatchAndBroadcast(
  ctx: any,
  recipients: any[],
  meta: { dispatch_pattern: string; payment_leg: string | null; status: string }
) {
  const { supabase, booking, serviceCategory, routing } = ctx

  // === BLACKOUT FILTER (multi-day overlap) ===
  // Exclude partners whose blackout range overlaps ANY portion of the booking range.
  // Safety: if the query fails, log a warning and proceed with the unfiltered pool —
  // never block a dispatch on infrastructure failure.
  try {
    const { start: bookingStart, end: bookingEnd } = getBookingDateRange(booking)
    const ids = (recipients || []).map((r: any) => r?.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: blackouts, error: bErr } = await supabase
        .from('partner_blackout_dates')
        .select('partner_id')
        .in('partner_id', ids)
        .lte('start_date', bookingEnd)   // blackout starts on/before booking ends
        .gte('end_date', bookingStart)   // blackout ends on/after booking starts
      if (bErr) {
        console.warn('[tt-smart-dispatch] blackout query failed, proceeding without filter:', bErr.message)
      } else {
        const blackedOut = new Set((blackouts || []).map((b: any) => b.partner_id))
        if (blackedOut.size > 0) {
          const before = recipients.length
          recipients = recipients.filter((r: any) => !blackedOut.has(r?.id))
          console.log(`[tt-smart-dispatch] blackout filter: ${before - recipients.length} of ${before} partners excluded for booking ${booking.id} (range ${bookingStart} → ${bookingEnd})`)
        }
      }
    }
  } catch (e: any) {
    console.warn('[tt-smart-dispatch] blackout filter error, proceeding without filter:', e?.message || e)
  }


  // Normalize recipients to a common shape with phone
  const normalized = recipients.map((r: any) => ({
    id: r.id,
    partner_name: r.business_name || r.full_name || r.name || r.partner_name || 'Unknown',
    partner_type: r.partner_type || (r.vehicle_classes ? 'driver' : 'partner'),
    partner_phone: toE164(r.phone || r.contact_phone || r.contact_info?.phone || null),
    profit_margin: r.profit_margin ?? null,
    rating: r.rating ?? null,
    red_carpet: r.red_carpet ?? r.offers_red_carpet ?? null,
    star_ceiling: r.star_ceiling ?? r.offers_star_ceiling ?? null,
    styles_offered: r.styles_offered ?? null,
    vehicle_classes: r.vehicle_classes ?? null,
    service_regions: r.service_regions ?? null,
  }))

  // === NO-MATCH ADMIN ALERT (silent-failure guard) ===
  // Fires BEFORE any downstream insert so a later throw cannot swallow it.
  // Idempotent: one alert per booking_id.
  if (normalized.length === 0) {
    const { data: prior } = await supabase
      .from('tt_notifications_log')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('type', 'no_partners_matched_alert')
      .limit(1)
      .maybeSingle()

    if (!prior) {
      const criteria = {
        partner_types: routing?.partner_types ?? [],
        pickup_state: resolvePickupState(booking),
        fulfillment_model: routing?.fulfillment_model ?? null,
      }
      const payload = {
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        service_slug: booking.service_slug || routing?.slug,
        service_type: booking.service_type,
        service_category: serviceCategory,
        customer_name: booking.client_name,
        scheduled_at: booking.scheduled_at,
        pickup_location: booking.pickup_location,
        dispatch_pattern: meta.dispatch_pattern,
        criteria,
        reason: 'Zero active partners with valid phone matched the routing criteria',
      }
      await supabase.from('tt_notifications_log').insert({
        booking_id: booking.id,
        type: 'no_partners_matched_alert',
        channel: 'internal',
        recipient: 'admin',
        message: `No partners matched for ${routing?.display_name || booking.service_type} booking ${booking.booking_reference || booking.id} — criteria=${JSON.stringify(criteria)}`,
        status: 'sent',
      })
      console.warn('[tt-smart-dispatch] no_partners_matched_alert emitted', payload)
      supabase.functions.invoke('admin-notify', {
        body: {
          event_type: 'dispatch_failure',
          related_id: booking.id,
          related_table: 'tt_bookings',
          data: {
            service_name: routing?.display_name || booking.service_type,
            booking_id_short: String(booking.id).slice(0, 8),
            reason: 'no_eligible_partners',
          },
        },
      }).catch((err: any) => console.error('admin-notify dispatch_failure failed', err));
    } else {
      console.log('[tt-smart-dispatch] no_partners_matched_alert already exists for booking', booking.id, '— skipping (idempotent)')
    }
  }

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

  // Insert one magic-link token per recipient. Map partner_id -> token for SMS.
  const tokenByPartner: Record<string, string> = {}
  if (dispatchReq?.id && meta.status === 'sent' && normalized.length > 0) {
    const tokenRows = normalized
      .filter((r) => r.id)
      .map((r) => ({
        dispatch_id: dispatchReq.id,
        partner_id: String(r.id),
        partner_name: r.partner_name,
        partner_phone: r.partner_phone,
      }))
    if (tokenRows.length) {
      const { data: insertedTokens, error: tokErr } = await supabase
        .from('tt_dispatch_tokens')
        .insert(tokenRows)
        .select('token, partner_id')
      if (tokErr) {
        console.error('[tt-smart-dispatch] token insert failed:', tokErr.message)
        ctx.errors.push(`tokens: ${tokErr.message}`)
      } else {
        for (const t of insertedTokens || []) {
          tokenByPartner[t.partner_id] = t.token
        }
      }
    }
  }

  const acceptBaseUrl =
    Deno.env.get('TT_ACCEPT_BASE_URL') || 'https://gasmask-os-nexus.lovable.app'

  // SMS via Twilio (only if status === 'sent')
  // Routing-driven template selection: tt_service_routing.sms_template_key is the
  // canonical lookup. Today we log + record the configured key for every dispatch
  // and use it to switch to the dedicated hourly template when applicable. All
  // other keys fall through to the rich default dispatch body (which contains more
  // operational detail than the generic partner_dispatch template).
  const configuredTemplateKey = (routing.sms_template_key || 'partner_dispatch').trim()
  console.log('[tt-smart-dispatch] sms_template_key resolved', {
    booking_id: booking.id,
    slug: routing.slug,
    sms_template_key: configuredTemplateKey,
  })
  let smsResults: any = {
    attempted: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    suppressed_partners: [] as any[],
    errors: [] as string[],
    sms_template_key: configuredTemplateKey,
  }
  if (meta.status === 'sent') {
    // Credentials + sender live in send-sms now; this function only needs the
    // TT sender override to pass through.
    const fromPhone = Deno.env.get('TT_PHONE_NUMBER')

    const scheduledDate = booking.scheduled_at
      ? new Date(booking.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'TBD'

    if (!fromPhone) {
      const errMsg = 'TT_PHONE_NUMBER not set, SMS not sent'
      console.error('[tt-smart-dispatch] ' + errMsg)
      smsResults.errors.push(errMsg)
    } else {
      const hoursBooked = Number((booking as any).hours_booked || (booking as any).hours || 0)
      const useHourly = configuredTemplateKey === 'partner_dispatch_hourly' && hoursBooked > 0
      for (const r of normalized) {
        if (!r.partner_phone) continue
        smsResults.attempted++
        const flagSuffix = meta.payment_leg ? `\n[FLAG: ${meta.payment_leg}]` : ''
        const tok = r.id ? tokenByPartner[String(r.id)] : undefined
        const acceptLine = tok
          ? `Accept: ${acceptBaseUrl}/tt/partner/accept/${tok}\n(or reply YES to accept / NO to decline)`
          : `Reply YES to accept or NO to decline.`
        const baseMsg = useHourly
          ? `🚨 New TopTier hourly booking\n` +
            `⏱ ${hoursBooked}h · ${serviceCategory.replace(/_/g, ' ')}\n` +
            `Pickup: ${booking.pickup_location || 'TBD'}\n` +
            `Date: ${scheduledDate}\n` +
            `Client: ${booking.client_name || 'N/A'}\n` +
            `Value: $${booking.total_price || 0}\n` +
            `Ref: ${booking.booking_reference || 'N/A'}\n\n`
          : `TopTier Dispatch: ${serviceCategory.replace(/_/g, ' ')} booking\n` +
            `Client: ${booking.client_name || 'N/A'}\n` +
            `Pickup: ${booking.pickup_location || 'TBD'}\n` +
            `Date: ${scheduledDate}\n` +
            `Value: $${booking.total_price || 0}\n` +
            `Ref: ${booking.booking_reference || 'N/A'}\n\n`
        const msg = baseMsg +
          `${acceptLine}\n` +
          `Expires in 30 minutes.${flagSuffix}`
        // Group D (workforce): contracted partner/driver dispatch offer.
        const smsRes = await sendSms({
          to: r.partner_phone,
          body: msg,
          sendClass: 'workforce',
          purpose: 'tt_dispatch_offer',
          idempotencyKey: `tt-dispatch-${dispatchReq?.id}-${r.id ?? r.partner_phone}`,
          from: fromPhone,
          skipCooldown: true,
          metadata: { booking_reference: booking.booking_reference, sms_template_key: configuredTemplateKey },
        })
        if (smsRes.blocked) {
          // Suppression-skipped, made visible: named outcome per partner in
          // the payload + a queryable tt_notifications_log row. No alert.
          smsResults.suppressed++
          smsResults.suppressed_partners.push({
            partner_id: r.id ?? null,
            partner_name: r.partner_name || r.name || r.business_name || null,
            phone: r.partner_phone,
            reason: smsRes.errorMessage || smsRes.status,
          })
          await recordDispatchSuppressed(supabase, {
            bookingId: booking.id,
            bookingReference: booking.booking_reference,
            recipientPhone: r.partner_phone,
            recipientName: r.partner_name || r.name || r.business_name || null,
            partnerId: r.id ?? null,
            sendClass: 'workforce',
            reason: smsRes.errorMessage || smsRes.status,
          })
        } else if (!smsRes.success) {
          smsResults.failed++
          smsResults.errors.push(`${r.partner_phone}: ${smsRes.status} ${(smsRes.errorMessage ?? '').slice(0, 200)}`)
          console.error('[tt-smart-dispatch] SMS failed', smsRes.status, smsRes.errorMessage)
        } else {
          smsResults.sent++
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
    sms_results: smsResults,
    selector_errors: ctx.errors ?? [],
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
  if (error) {
    console.error('pool_style query error:', error.message)
    ctx.errors.push(`pool_style: ${error.message}`)
  }
  return await insertDispatchAndBroadcast(ctx, drivers || [], {
    dispatch_pattern: 'pool_style', payment_leg: null, status: 'sent',
  })
}

// asset_fallback: exotic / party-bus / yachts — owner first, then ordered fallback
async function selectAssetFallback(ctx: any) {
  const { supabase, booking, routing } = ctx
  let primary: any = null
  if (booking.vehicle_id) {
    const { data: v, error: vErr } = await supabase
      .from('tt_vehicles').select('owner_partner_id')
      .eq('id', booking.vehicle_id).maybeSingle()
    if (vErr) { console.error('asset_fallback vehicle query error:', vErr.message); ctx.errors.push(`asset_fallback.vehicle: ${vErr.message}`) }
    if (v?.owner_partner_id) {
      const { data: op, error: opErr } = await supabase
        .from('tt_partners').select('*')
        .eq('id', v.owner_partner_id).maybeSingle()
      if (opErr) { console.error('asset_fallback owner query error:', opErr.message); ctx.errors.push(`asset_fallback.owner: ${opErr.message}`) }
      primary = op
    }
  }

  const { data: pool, error: poolErr } = await supabase
    .from('tt_partners').select('*')
    .in('partner_type', routing.partner_types)
    .eq('status', 'approved').eq('is_active', true)
    .order('profit_margin', { ascending: false })
  if (poolErr) { console.error('asset_fallback pool query error:', poolErr.message); ctx.errors.push(`asset_fallback.pool: ${poolErr.message}`) }
  console.log(`asset_fallback: types=${JSON.stringify(routing.partner_types)} pool=${(pool || []).length} primary=${primary?.id || 'none'}`)

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
    const { data, error } = await supabase
      .from('tt_vehicles').select('id')
      .eq('style', booking.requested_style)
      .not('owner_partner_id', 'is', null)
      .limit(1)
    if (error) { console.error('hybrid vehicle query error:', error.message); ctx.errors.push(`hybrid.vehicle: ${error.message}`) }
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
  const { data: regional, error: regErr } = await q
  if (regErr) { console.error('quote_region query error:', regErr.message); ctx.errors.push(`quote_region: ${regErr.message}`) }
  const list = regional || []

  const { data: dr, error: drErr } = await supabase.from('tt_dispatch_requests').insert({
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
  if (drErr) { console.error('quote_region insert error:', drErr.message); ctx.errors.push(`quote_region.insert: ${drErr.message}`) }

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
    selector_errors: ctx.errors ?? [],
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
  const { data: regional, error: regErr } = await q
  if (regErr) { console.error('broadcast_hold query error:', regErr.message); ctx.errors.push(`broadcast_hold: ${regErr.message}`) }
  return await insertDispatchAndBroadcast(ctx, regional || [], {
    dispatch_pattern: 'broadcast_hold',
    payment_leg: 'auth_hold_not_built',
    status: 'sent',
  })
}

// ===================== MARKETPLACE_DIRECT (decor) =====================
// Customer chose ONE decorator on the public site → route DIRECTLY to that decorator.
// No scoring, no broadcast, no SMS (portal-only notification for v1).
// Reads booking.partner_id (resolved by create-tt-booking from chosen_partner_id
// or chosen_decorator_id → decorators.tt_partner_id). Missing/unresolved → needs_review + alert.
async function selectMarketplaceDirect(ctx: any) {
  const { supabase, booking, serviceCategory } = ctx
  const chosenId = booking.partner_id as string | null

  const baseRow = {
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
    dispatch_pattern: 'marketplace_direct',
    payment_leg: null,
  }

  if (!chosenId) {
    const { data: dr, error: drErr } = await supabase
      .from('tt_dispatch_requests')
      .insert({ ...baseRow, status: 'needs_review', matched_partners: [], auto_matched: false })
      .select().single()
    if (drErr) { console.error('marketplace_direct insert error:', drErr.message); ctx.errors.push(`marketplace_direct.insert: ${drErr.message}`) }
    await supabase.from('tt_notifications_log').insert({
      booking_id: booking.id,
      type: 'marketplace_direct_no_chosen_partner',
      channel: 'internal', recipient: 'admin', status: 'sent',
      message: `Decor booking ${booking.booking_reference} has no chosen decorator (partner_id null) — needs review`,
    })
    ctx.errors.push('marketplace_direct: booking.partner_id is null')
    return jsonOk({
      matched: 0, dispatch_request_id: dr?.id,
      dispatch_pattern: 'marketplace_direct', status: 'needs_review',
      matched_partners: [], selector_errors: ctx.errors,
    })
  }

  const { data: partner, error: pErr } = await supabase
    .from('tt_partners').select('*').eq('id', chosenId).maybeSingle()
  if (pErr) { console.error('marketplace_direct partner query error:', pErr.message); ctx.errors.push(`marketplace_direct.partner: ${pErr.message}`); throw pErr }

  if (!partner) {
    const { data: dr } = await supabase
      .from('tt_dispatch_requests')
      .insert({ ...baseRow, status: 'needs_review', matched_partners: [], auto_matched: false })
      .select().single()
    await supabase.from('tt_notifications_log').insert({
      booking_id: booking.id,
      type: 'marketplace_direct_partner_not_found',
      channel: 'internal', recipient: 'admin', status: 'sent',
      message: `Decor booking ${booking.booking_reference}: chosen partner_id ${chosenId} not found in tt_partners`,
    })
    ctx.errors.push(`marketplace_direct: tt_partners ${chosenId} not found`)
    return jsonOk({
      matched: 0, dispatch_request_id: dr?.id,
      dispatch_pattern: 'marketplace_direct', status: 'needs_review',
      matched_partners: [], selector_errors: ctx.errors,
    })
  }

  const normalized = [{
    id: partner.id,
    partner_name: partner.business_name || partner.name || 'Decorator',
    partner_type: partner.partner_type,
    partner_phone: toE164(partner.phone || partner.contact_info?.phone || partner.contact_phone || null),
  }]

  const { data: dr, error: drErr } = await supabase
    .from('tt_dispatch_requests')
    .insert({
      ...baseRow,
      status: 'sent',
      matched_partners: normalized,
      auto_matched: true,
      accepted_partner_id: String(partner.id),   // matches existing portal RLS predicate
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select().single()
  if (drErr) { console.error('marketplace_direct insert error:', drErr.message); ctx.errors.push(`marketplace_direct.insert: ${drErr.message}`); throw drErr }

  await supabase.from('tt_bookings').update({ status: 'dispatched' }).eq('id', booking.id)

  return jsonOk({
    matched: 1,
    dispatch_request_id: dr?.id,
    dispatch_pattern: 'marketplace_direct',
    status: 'sent',
    matched_partners: normalized,
    selector_errors: ctx.errors,
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
    const phone = toE164(p.phone || p.contact_info?.phone || p.contact_phone || linkedAsset?.partner_phone || null)
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
    // No-match alert (mirrors insertDispatchAndBroadcast guard; source='legacy_scored')
    const { data: existingAlert } = await supabase
      .from('tt_notifications_log')
      .select('id')
      .eq('booking_id', booking.id)
      .eq('type', 'no_partners_matched_alert')
      .maybeSingle()
    if (!existingAlert) {
      const criteria = {
        partner_types: routing?.partner_types ?? [],
        pickup_state: resolvePickupState(booking),
        fulfillment_model: routing?.fulfillment_model ?? null,
        source: 'legacy_scored',
      }
      await supabase.from('tt_notifications_log').insert({
        booking_id: booking.id,
        type: 'no_partners_matched_alert',
        channel: 'internal',
        recipient: 'admin',
        status: 'sent',
        message: `No partners matched for ${routing?.display_name || booking.service_type} booking ${booking.booking_reference || booking.id} — legacy_scored path — criteria=${JSON.stringify(criteria)}`,
      })
      console.warn('[tt-smart-dispatch] no_partners_matched_alert emitted (legacy_scored)', { booking_id: booking.id, criteria })
      supabase.functions.invoke('admin-notify', {
        body: {
          event_type: 'dispatch_failure',
          related_id: booking.id,
          related_table: 'tt_bookings',
          data: {
            service_name: routing?.display_name || booking.service_type,
            booking_id_short: String(booking.id).slice(0, 8),
            reason: 'no_eligible_partners_legacy',
          },
        },
      }).catch((err: any) => console.error('admin-notify dispatch_failure failed', err));
    } else {
      console.log('[tt-smart-dispatch] no_partners_matched_alert already exists for booking', booking.id, '— skipping (idempotent, legacy_scored)')
    }
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

  const fromPhone = Deno.env.get('TT_PHONE_NUMBER')

  const scheduledDate = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBD'

  const smsResults: any = { attempted: 0, sent: 0, failed: 0, suppressed: 0, suppressed_partners: [] as any[], errors: [] as string[] }
  if (!fromPhone) {
    const errMsg = 'TT_PHONE_NUMBER not set, SMS not sent'
    console.error('[tt-smart-dispatch:legacy] ' + errMsg)
    smsResults.errors.push(errMsg)
  } else {
    for (const partner of top5) {
      if (!partner.partner_phone) continue
      smsResults.attempted++
      const msg = `TopTier Dispatch: ${serviceCategory.replace(/_/g, ' ')} booking\n` +
        `Client: ${booking.client_name || 'N/A'}\n` +
        `Pickup: ${booking.pickup_location || 'TBD'}\n` +
        `Date: ${scheduledDate}\n` +
        `Value: $${booking.total_price || 0}\n` +
        `Ref: ${booking.booking_reference || 'N/A'}\n\n` +
        `Reply YES to accept or NO to decline.\n` +
        `Expires in 30 minutes.`
      // Group D (workforce): contracted partner dispatch offer.
      const smsRes = await sendSms({
        to: partner.partner_phone,
        body: msg,
        sendClass: 'workforce',
        purpose: 'tt_dispatch_offer',
        idempotencyKey: `tt-dispatch-legacy-${dispatchReq?.id}-${partner.id ?? partner.partner_phone}`,
        from: fromPhone,
        skipCooldown: true,
        metadata: { booking_reference: booking.booking_reference },
      })
      if (smsRes.blocked) {
        // Suppression-skipped, made visible: named outcome, not silence.
        smsResults.suppressed++
        smsResults.suppressed_partners.push({
          partner_id: partner.id ?? null,
          partner_name: partner.partner_name || null,
          phone: partner.partner_phone,
          reason: smsRes.errorMessage || smsRes.status,
        })
        await recordDispatchSuppressed(supabase, {
          bookingId: booking.id,
          bookingReference: booking.booking_reference,
          recipientPhone: partner.partner_phone,
          recipientName: partner.partner_name || null,
          partnerId: partner.id ?? null,
          sendClass: 'workforce',
          reason: smsRes.errorMessage || smsRes.status,
        })
      } else if (!smsRes.success) {
        smsResults.failed++
        smsResults.errors.push(`${partner.partner_phone}: ${smsRes.status} ${(smsRes.errorMessage ?? '').slice(0, 200)}`)
        console.error('[tt-smart-dispatch:legacy] SMS failed', smsRes.status, smsRes.errorMessage)
      } else {
        smsResults.sent++
      }
    }
  }

  await supabase.from('tt_bookings').update({ status: 'dispatched' }).eq('id', booking.id)

  return new Response(JSON.stringify({
    success: true,
    matched: top5.length,
    dispatch_request_id: dispatchReq?.id,
    top_match: top5[0]?.partner_name || 'None',
    public_partners_found: partners.length,
    sms_results: smsResults,
    message: `Request sent to ${top5.length} partners`
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
