import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Strict E.164 normalizer. Twilio sends From as '+1XXXXXXXXXX'; stored phones
// may have drifted off the '+'. Normalize both sides so matching can't break.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits
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

    let body: any = {}
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const params = new URLSearchParams(text)
      body = {
        from_phone: params.get('From'),
        message: params.get('Body'),
        source: 'twilio_webhook'
      }
    } else {
      body = await req.json()
    }

    const { from_phone, message, dispatch_request_id, partner_id, source,
            meeting_point_address, meeting_point_time } = body

    const response = (message || '').trim().toUpperCase()
    const accepted = response.startsWith('YES') || response === 'Y' || response === 'ACCEPT' || response === '1'

    let dispatchRequest: any = null
    let claimToken: string | null = null
    let resolvedPartnerId: string | null = null

    if (source === 'twilio_webhook' && from_phone) {
      // Resolve the most recent unresolved token for this phone — gives us BOTH
      // the dispatch and the per-driver token so we can use the atomic claim RPC.
      const { data: tokenRow } = await supabase
        .from('tt_dispatch_tokens')
        .select('token, partner_id, dispatch_id, declined_at, notified_taken_at, tt_dispatch_requests!inner(*)')
        .eq('partner_phone', from_phone)
        .is('declined_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tokenRow) {
        claimToken = (tokenRow as any).token
        resolvedPartnerId = (tokenRow as any).partner_id
        dispatchRequest = (tokenRow as any).tt_dispatch_requests
      } else {
        // Legacy fallback: no token row (pre-migration dispatches still in flight)
        const { data: requests } = await supabase
          .from('tt_dispatch_requests')
          .select('*')
          .eq('status', 'sent')
          .order('created_at', { ascending: false })
          .limit(20)
        dispatchRequest = requests?.find(r => {
          const partners = r.matched_partners || []
          return (partners as any[]).some((p: any) =>
            p.partner_phone === from_phone || p.phone === from_phone
          )
        })
      }
    } else if (dispatch_request_id) {
      const { data } = await supabase
        .from('tt_dispatch_requests')
        .select('*')
        .eq('id', dispatch_request_id)
        .single()
      dispatchRequest = data
      // For programmatic calls with a known partner, try to look up their token too
      if (partner_id) {
        const { data: tok } = await supabase
          .from('tt_dispatch_tokens')
          .select('token, notified_taken_at')
          .eq('dispatch_id', dispatch_request_id)
          .eq('partner_id', String(partner_id))
          .maybeSingle()
        if (tok) {
          claimToken = (tok as any).token
          resolvedPartnerId = String(partner_id)
        }
      }
    }

    if (!dispatchRequest) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No matching dispatch request found'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const partners = (dispatchRequest.matched_partners || []) as any[]
    const partner = partners.find((p: any) =>
      p.partner_phone === from_phone || p.phone === from_phone ||
      p.id === partner_id || p.id === resolvedPartnerId
    ) || partners[0]

    // Helper: courtesy "already taken" SMS, sent ONCE per token when a driver
    // actively engages (replies or taps) on a claimed dispatch.
    async function sendAlreadyTakenSms() {
      if (!claimToken) return
      const { data: tokRow } = await supabase
        .from('tt_dispatch_tokens')
        .select('notified_taken_at, partner_phone')
        .eq('token', claimToken)
        .maybeSingle()
      if (!tokRow || tokRow.notified_taken_at) return
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const tok = Deno.env.get('TWILIO_AUTH_TOKEN')
      const from = Deno.env.get('TT_PHONE_NUMBER')
      const to = tokRow.partner_phone || from_phone
      if (sid && tok && from && to) {
        try {
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              To: to, From: from,
              Body: `TopTier ${dispatchRequest.booking_reference}: this job was already claimed by another driver. No action needed.`,
            }),
          })
        } catch (e) { console.error('already-taken SMS failed:', e) }
      }
      await supabase.from('tt_dispatch_tokens')
        .update({ notified_taken_at: new Date().toISOString() })
        .eq('token', claimToken)
    }

    if (accepted) {
      // ATOMIC CLAIM via RPC when we have a token (modern path). Shared lock with
      // the magic-link page — both routes serialize through the same conditional UPDATE.
      let claimOutcome: 'won' | 'lost' | 'legacy' = 'legacy'
      if (claimToken) {
        const { data: claimRes, error: claimErr } = await supabase.rpc('tt_claim_dispatch', { p_token: claimToken })
        if (claimErr) {
          console.error('[tt-partner-response] claim RPC failed:', claimErr.message)
          claimOutcome = 'lost'
        } else if ((claimRes as any)?.outcome === 'won') {
          claimOutcome = 'won'
        } else {
          claimOutcome = 'lost'
        }
        // Re-read dispatch to reflect post-claim state
        const { data: refreshed } = await supabase
          .from('tt_dispatch_requests').select('*').eq('id', dispatchRequest.id).single()
        if (refreshed) dispatchRequest = refreshed
      }

      if (claimOutcome === 'lost') {
        await sendAlreadyTakenSms()
        if (source === 'twilio_webhook') {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry — ${dispatchRequest.booking_reference} was already claimed by another driver.</Message></Response>`,
            { headers: { 'Content-Type': 'text/xml' } }
          )
        }
        return new Response(JSON.stringify({
          success: false, action: 'already_claimed',
          booking_reference: dispatchRequest.booking_reference,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Legacy path (no token row): preserve original non-atomic update so in-flight
      // pre-migration dispatches keep working. New dispatches always have tokens.
      if (claimOutcome === 'legacy') {
        await supabase
          .from('tt_dispatch_requests')
          .update({
            status: 'accepted',
            accepted_partner_id: partner?.id || partner_id,
            accepted_partner_name: partner?.partner_name || partner?.name,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', dispatchRequest.id)

        await supabase
          .from('tt_bookings')
          .update({
            status: 'driver_assigned',
            driver_id: partner?.id || partner_id,
          })
          .eq('id', dispatchRequest.booking_id)
      }

      if (partner?.id) {
        await supabase
          .from('tt_partner_assets')
          .update({ is_available: false })
          .eq('id', partner.id)
      }

      // ====== TRUCK-WITH-DECOR MEETING-POINT (cross-row write to decor sibling) ======
      // When the accepted dispatch is a black-truck pool_style row AND the booking
      // has decor_addon=true, there is a sibling marketplace_direct row for the
      // decorator. The driver MUST submit meeting_point_address + meeting_point_time
      // on accept; we write them to the DECOR row (service_role bypasses RLS).
      // Failure path: surface needs_review + admin alert, set truck status to
      // 'accepted_meeting_point_pending', send SMS without meeting point. Driver
      // is NOT blocked from the job.
      let decorRow: any = null
      let meetingPointStatus: 'none' | 'saved' | 'failed' | 'missing' = 'none'
      const { data: booking } = await supabase
        .from('tt_bookings').select('id, decor_addon, decor_partner_id')
        .eq('id', dispatchRequest.booking_id).maybeSingle()
      const isTruckWithDecor =
        dispatchRequest.dispatch_pattern === 'pool_style' &&
        booking?.decor_addon === true &&
        !!booking?.decor_partner_id

      if (isTruckWithDecor) {
        const { data: sibling } = await supabase
          .from('tt_dispatch_requests').select('*')
          .eq('booking_id', dispatchRequest.booking_id)
          .eq('dispatch_pattern', 'marketplace_direct')
          .maybeSingle()
        decorRow = sibling

        if (!meeting_point_address || !meeting_point_time) {
          meetingPointStatus = 'missing'
          // 422 — driver MUST provide meeting point. Roll back truck accept.
          await supabase.from('tt_dispatch_requests')
            .update({ status: 'sent', accepted_partner_id: null, accepted_partner_name: null, accepted_at: null })
            .eq('id', dispatchRequest.id)
          if (partner?.id) {
            await supabase.from('tt_partner_assets').update({ is_available: true }).eq('id', partner.id)
          }
          return new Response(JSON.stringify({
            success: false,
            error: 'meeting_point_required',
            message: 'This booking includes decor — set meeting point (address + time) to accept.',
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        if (decorRow) {
          const { error: mpErr } = await supabase
            .from('tt_dispatch_requests')
            .update({
              meeting_point_address,
              meeting_point_time,
              meeting_point_set_at: new Date().toISOString(),
              meeting_point_set_by: partner?.id ?? null,
            })
            .eq('id', decorRow.id)
          if (mpErr) {
            console.error('meeting-point write failed:', mpErr.message)
            meetingPointStatus = 'failed'
            await supabase.from('tt_dispatch_requests')
              .update({ status: 'needs_review' })
              .eq('id', decorRow.id)
            await supabase.from('tt_dispatch_requests')
              .update({ status: 'accepted_meeting_point_pending' })
              .eq('id', dispatchRequest.id)
            await supabase.from('tt_notifications_log').insert({
              booking_id: dispatchRequest.booking_id,
              type: 'truck_decor_meeting_point_failed',
              channel: 'internal', recipient: 'admin', status: 'sent',
              message: `Driver accepted ${dispatchRequest.booking_reference} but meeting-point write failed: ${mpErr.message}. Ops must contact driver+decorator.`,
            })
          } else {
            meetingPointStatus = 'saved'
          }
        } else {
          // Decor sibling missing — soft fail, accept proceeds, alert ops
          meetingPointStatus = 'failed'
          await supabase.from('tt_dispatch_requests')
            .update({ status: 'accepted_meeting_point_pending' })
            .eq('id', dispatchRequest.id)
          await supabase.from('tt_notifications_log').insert({
            booking_id: dispatchRequest.booking_id,
            type: 'truck_decor_sibling_missing',
            channel: 'internal', recipient: 'admin', status: 'sent',
            message: `Truck-with-decor booking ${dispatchRequest.booking_reference}: no decor dispatch sibling found. Coordination broken.`,
          })
        }
      }

      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const fromTwilio = Deno.env.get('TT_PHONE_NUMBER')

      if (!fromTwilio) {
        console.error('[tt-partner-response] TT_PHONE_NUMBER not set, customer confirmation SMS not sent')
      } else if (twilioSid && twilioToken && dispatchRequest.customer_phone) {
        const customerMsg =
          `TopTier: Your ${(dispatchRequest.service_type || '').replace(/_/g, ' ')} booking is confirmed!` +
          ` ${partner?.partner_name || 'Your provider'} has accepted.` +
          ` Ref: ${dispatchRequest.booking_reference}.` +
          ` We'll send details shortly.`

        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: dispatchRequest.customer_phone,
              From: fromTwilio,
              Body: customerMsg,
            }),
          }
        )
        if (!resp.ok) {
          console.error('[tt-partner-response] customer SMS failed', resp.status, await resp.text())
        }
      }

      // ====== DUAL SMS for truck-with-decor when meeting point saved ======
      if (isTruckWithDecor && meetingPointStatus === 'saved' && twilioSid && twilioToken && fromTwilio) {
        const mpDate = meeting_point_time
          ? new Date(meeting_point_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
          : 'TBD'
        // Driver SMS: pickup + meeting point
        if (partner?.partner_phone || partner?.phone) {
          const driverPhone = partner.partner_phone || partner.phone
          const driverMsg =
            `TopTier ${dispatchRequest.booking_reference} CONFIRMED.\n` +
            `Pickup: ${dispatchRequest.pickup_location || 'TBD'}\n` +
            `Meet decorator first: ${meeting_point_address} @ ${mpDate}\n` +
            `Decorator will load decor for setup at venue.`
          try {
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method: 'POST',
              headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ To: driverPhone, From: fromTwilio, Body: driverMsg }),
            })
          } catch (e) { console.error('driver SMS failed:', e) }
        }
        // Decorator SMS: meeting point + driver name/phone
        if (decorRow) {
          const decorPartners = (decorRow.matched_partners || []) as any[]
          const decorContact = decorPartners[0]
          const decorPhone = decorContact?.partner_phone || decorContact?.phone
          if (decorPhone) {
            const decorMsg =
              `TopTier ${dispatchRequest.booking_reference}: Driver assigned.\n` +
              `Meet: ${meeting_point_address} @ ${mpDate}\n` +
              `Driver: ${partner?.partner_name || 'Driver'} ${partner?.partner_phone || partner?.phone || ''}\n` +
              `Load decor onto truck at meeting point for venue setup.`
            try {
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
                method: 'POST',
                headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ To: decorPhone, From: fromTwilio, Body: decorMsg }),
              })
            } catch (e) { console.error('decorator SMS failed:', e) }
          }
        }
      }

      try {
        await supabase.from('tt_notifications_log').insert({
          booking_id: dispatchRequest.booking_id,
          type: 'partner_accepted',
          channel: 'sms',
          recipient: dispatchRequest.customer_phone || 'customer',
          message: `Partner ${partner?.partner_name} accepted booking ${dispatchRequest.booking_reference}`,
          status: 'sent',
        })
      } catch (_) { /* non-critical */ }

      if (source === 'twilio_webhook') {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Confirmed! You have accepted ${dispatchRequest.booking_reference}. TopTier will send you full customer and route details shortly.</Message></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'accepted',
        booking_reference: dispatchRequest.booking_reference,
        partner: partner?.partner_name
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else {
      const updatedPartners = partners.map((p: any) => {
        if (p.partner_phone === from_phone || p.id === partner_id) {
          return { ...p, response: 'declined', declined_at: new Date().toISOString() }
        }
        return p
      })

      const remaining = updatedPartners.filter((p: any) => !p.response)

      await supabase
        .from('tt_dispatch_requests')
        .update({
          matched_partners: updatedPartners,
          status: remaining.length > 0 ? 'sent' : 'pending',
        })
        .eq('id', dispatchRequest.id)

      if (remaining.length === 0) {
        await supabase
          .from('tt_bookings')
          .update({ status: 'needs_dispatch' })
          .eq('id', dispatchRequest.booking_id)

        const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
        const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
        const fromTwilio = Deno.env.get('TT_PHONE_NUMBER')
        const davidPhone = Deno.env.get('DAVID_PHONE_NUMBER')

        if (twilioSid && twilioToken && fromTwilio && davidPhone) {
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: davidPhone,
                From: fromTwilio,
                Body: `⚠️ ALERT: All partners declined booking ${dispatchRequest.booking_reference} (${dispatchRequest.service_type}). Manual assignment needed.`,
              }),
            }
          )
        }
      }

      if (source === 'twilio_webhook') {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Got it. You have declined ${dispatchRequest.booking_reference}. No further action needed on your end.</Message></Response>`,
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'declined',
        remaining_partners: remaining.length
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (err) {
    console.error('tt-partner-response error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
