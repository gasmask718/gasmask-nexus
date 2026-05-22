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

    if (source === 'twilio_webhook' && from_phone) {
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
    } else if (dispatch_request_id) {
      const { data } = await supabase
        .from('tt_dispatch_requests')
        .select('*')
        .eq('id', dispatch_request_id)
        .single()
      dispatchRequest = data
    }

    if (!dispatchRequest) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No matching dispatch request found'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const partners = (dispatchRequest.matched_partners || []) as any[]
    const partner = partners.find((p: any) =>
      p.partner_phone === from_phone || p.phone === from_phone || p.id === partner_id
    ) || partners[0]

    if (accepted) {
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

      if (twilioSid && twilioToken && fromTwilio && dispatchRequest.customer_phone) {
        const customerMsg =
          `TopTier: Your ${(dispatchRequest.service_type || '').replace(/_/g, ' ')} booking is confirmed!` +
          ` ${partner?.partner_name || 'Your provider'} has accepted.` +
          ` Ref: ${dispatchRequest.booking_reference}.` +
          ` We'll send details shortly.`

        await fetch(
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
