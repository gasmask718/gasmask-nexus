import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendSms } from "../_shared/sendSms.ts"
import { sendTwilioSms } from "../_shared/twilioSend.ts"
import { recordDispatchSuppressed } from "../_shared/dispatchOutcome.ts"

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

    const { from_phone: from_phone_raw, message, dispatch_request_id, partner_id, source,
            meeting_point_address, meeting_point_time } = body
    const from_phone = toE164(from_phone_raw)

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
      const from = Deno.env.get('TT_PHONE_NUMBER')
      const to = tokRow.partner_phone || from_phone
      if (from && to) {
        // Group D (workforce): contracted driver, dispatch outcome notice.
        const r = await sendSms({
          to,
          body: `TopTier ${dispatchRequest.booking_reference}: this job was already claimed by another driver. No action needed.`,
          sendClass: 'workforce',
          purpose: 'tt_dispatch_taken',
          idempotencyKey: `tt-taken-${claimToken}`,
          from,
          skipCooldown: true,
          metadata: { booking_reference: dispatchRequest.booking_reference },
        })
        if (r.blocked) {
          // Suppression-skipped, made visible: driver thinks he was told.
          await recordDispatchSuppressed(supabase, {
            bookingId: dispatchRequest.booking_id,
            bookingReference: dispatchRequest.booking_reference,
            recipientPhone: to,
            recipientName: partner?.partner_name || partner?.name || null,
            partnerId: resolvedPartnerId,
            sendClass: 'workforce',
            reason: r.errorMessage || r.status,
          })
        } else if (!r.success) {
          console.error('already-taken SMS failed:', r.status, r.errorMessage)
        }
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

      // ====== UNIFIED FINALIZATION ======
      // All post-claim side effects (partner asset lock, Stripe capture,
      // truck-with-decor meeting point, customer SMS, admin SMS, dual decor SMS,
      // notification log) live in tt-finalize-accept and run for BOTH accept
      // paths (YES-reply here, link-tap via tt-claim-via-link).
      let finalizeData: any = null
      let finalizeError: any = null
      try {
        const fr = await supabase.functions.invoke('tt-finalize-accept', {
          body: {
            dispatch_id: dispatchRequest.id,
            trigger_source: 'yes_reply',
            meeting_point_address,
            meeting_point_time,
          },
        })
        finalizeData = fr.data
        finalizeError = fr.error
      } catch (invErr) {
        console.error('[tt-partner-response] finalize invoke threw:', invErr)
        finalizeError = invErr
      }

      if (finalizeError || (finalizeData && finalizeData.success === false)) {
        console.error('[tt-partner-response] finalize failed:', finalizeError, finalizeData)
        // Surface meeting-point rollback (422) to caller transparently
        if (finalizeData && finalizeData.error === 'meeting_point_required') {
          return new Response(JSON.stringify(finalizeData), {
            status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // For other finalize failures: claim already succeeded so we MUST NOT
        // tell partner "no" — log loudly, let downstream ops reconcile, and
        // still confirm the accept to the partner.
        try {
          await supabase.from('tt_notifications_log').insert({
            booking_id: dispatchRequest.booking_id,
            type: 'finalize_invoke_failed',
            channel: 'internal', recipient: 'admin', status: 'sent',
            message: `Finalize invoke failed for ${dispatchRequest.booking_reference} (YES-reply path): ${finalizeError?.message || JSON.stringify(finalizeData)}`,
          })
        } catch (_) {}
      }

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

        const fromTwilio = Deno.env.get('TT_PHONE_NUMBER')
        const davidPhone = Deno.env.get('DAVID_PHONE_NUMBER')

        if (davidPhone) {
          // Group A (internal): all-declined is an ops escalation to a staff
          // handset — twilioSend in-process, never queued behind campaigns.
          const alert = await sendTwilioSms({
            to: davidPhone,
            body: `⚠️ ALERT: All partners declined booking ${dispatchRequest.booking_reference} (${dispatchRequest.service_type}). Manual assignment needed.`,
            suppressionClass: 'internal',
            source: 'tt-partner-response',
            from: fromTwilio,
            metadata: { booking_reference: dispatchRequest.booking_reference },
          })
          if (!alert.success) {
            console.error('[tt-partner-response] all-declined alert failed:', alert.status, alert.errorMessage)
          }
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
