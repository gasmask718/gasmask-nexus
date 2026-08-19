// tt-finalize-accept
// Shared post-claim finalization for BOTH accept paths:
//   - YES-reply (tt-partner-response)
//   - link-tap (tt-claim-via-link)
//
// This function assumes tt_dispatch_requests.status is ALREADY 'accepted' and
// accepted_partner_id is set (the atomic claim has been performed by either
// tt_claim_dispatch RPC or legacy inline update). It performs every side
// effect that historically lived inline in tt-partner-response lines 209-519:
//   1. Partner asset is_available = false
//   2. Stripe capture-on-accept (manual-capture PI flow)
//   3. Truck-with-decor meeting-point handling (cross-row write to decor sibling)
//   4. Customer confirmation SMS
//   5. Admin/founder alert SMS (DAVID_PHONE_NUMBER)
//   6. Dual SMS for truck+decor when meeting point saved
//   7. partner_accepted notification_log entry
//
// Behavior preserved verbatim. trigger_source is for logging only.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { sendSms as sendCanonicalSms } from '../_shared/sendSms.ts'
import { sendOpsAlert } from '../_shared/opsAlert.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const errors: string[] = []
  let captured = false
  let customer_sms_sent = false
  let admin_sms_sent = false
  let meeting_point_status: 'none' | 'saved' | 'failed' | 'missing' | 'rolled_back' = 'none'

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      dispatch_id,
      trigger_source = 'unknown',
      meeting_point_address,
      meeting_point_time,
    } = body || {}

    if (!dispatch_id) {
      return new Response(JSON.stringify({ success: false, error: 'dispatch_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[tt-finalize-accept] start dispatch_id=${dispatch_id} trigger=${trigger_source}`)

    // Load dispatch (must be already-accepted)
    const { data: dispatchRequest, error: dErr } = await supabase
      .from('tt_dispatch_requests')
      .select('*')
      .eq('id', dispatch_id)
      .maybeSingle()

    if (dErr || !dispatchRequest) {
      return new Response(JSON.stringify({
        success: false, error: 'dispatch not found', detail: dErr?.message,
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (dispatchRequest.status !== 'accepted' || !dispatchRequest.accepted_partner_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'dispatch not in accepted state',
        dispatch_status: dispatchRequest.status,
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const partners = (dispatchRequest.matched_partners || []) as any[]
    const partner = partners.find((p: any) =>
      String(p.id) === String(dispatchRequest.accepted_partner_id)
    ) || partners[0] || {
      id: dispatchRequest.accepted_partner_id,
      partner_name: dispatchRequest.accepted_partner_name,
    }

    // ====== 1. Mark partner asset unavailable ======
    if (partner?.id) {
      const { error } = await supabase
        .from('tt_partner_assets')
        .update({ is_available: false })
        .eq('id', partner.id)
      if (error) errors.push(`asset_update: ${error.message}`)
    }

    // ====== 2. CAPTURE-ON-ACCEPT (Stripe manual-capture flow) ======
    try {
      const { data: bk } = await supabase
        .from('tt_bookings')
        .select('id, stripe_payment_intent_id, payment_hold_status, booking_reference, client_phone, total_price')
        .eq('id', dispatchRequest.booking_id)
        .maybeSingle()

      if (bk && bk.payment_hold_status === 'hold_placed' && bk.stripe_payment_intent_id) {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (!stripeKey) {
          console.error('[tt-finalize-accept] STRIPE_SECRET_KEY missing — cannot capture')
          await supabase.from('tt_bookings').update({
            status: 'capture_failed', payment_hold_status: 'capture_failed',
          }).eq('id', bk.id)
          await supabase.from('tt_notifications_log').insert({
            booking_id: bk.id, type: 'capture_failure_alert', channel: 'internal',
            recipient: 'admin', status: 'sent',
            message: `Capture failed for ${bk.booking_reference}: STRIPE_SECRET_KEY not configured. Partner already won — manual reconciliation required.`,
          })
          errors.push('stripe_key_missing')
        } else {
          const capRes = await fetch(
            `https://api.stripe.com/v1/payment_intents/${bk.stripe_payment_intent_id}/capture`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          )
          const capJson: any = await capRes.json().catch(() => ({}))
          if (capRes.ok && capJson?.status === 'succeeded') {
            await supabase.from('tt_bookings').update({
              status: 'confirmed',
              payment_status: 'captured',
              payment_hold_status: 'charged',
            }).eq('id', bk.id)
            await supabase.from('tt_notifications_log').insert({
              booking_id: bk.id, type: 'payment_captured', channel: 'internal',
              recipient: 'system', status: 'sent',
              message: `Captured $${bk.total_price} for ${bk.booking_reference} (PI ${bk.stripe_payment_intent_id}) on partner accept.`,
            })
            captured = true
          } else {
            const errMsg = capJson?.error?.message || `HTTP ${capRes.status}`
            console.error('[tt-finalize-accept] capture failed:', errMsg, capJson)
            await supabase.from('tt_bookings').update({
              status: 'capture_failed', payment_hold_status: 'capture_failed',
            }).eq('id', bk.id)
            await supabase.from('tt_notifications_log').insert({
              booking_id: bk.id, type: 'capture_failure_alert', channel: 'internal',
              recipient: 'admin', status: 'sent',
              message: `Capture FAILED for ${bk.booking_reference} (PI ${bk.stripe_payment_intent_id}): ${errMsg}. Partner ${partner?.partner_name || partner?.name} already won — ops must contact customer for new card or release partner.`,
            })
            errors.push(`capture: ${errMsg}`)
            // Real-time admin alert via consolidated admin-notify
            supabase.functions.invoke('admin-notify', {
              body: {
                event_type: 'payment_failed',
                related_id: bk.id,
                related_table: 'tt_bookings',
                data: {
                  customer_name: (bk as any).client_name || 'TopTier customer',
                  amount: bk.total_price || 0,
                  booking_id_short: String(bk.id).slice(0, 8),
                  reason: errMsg,
                },
              },
            }).catch((err: any) => console.error('admin-notify payment_failed failed', err));
            // Group A (internal): capture failure is an ops escalation, so it
            // goes to the ops distribution list, not one founder handset.
            await sendOpsAlert({
              source: 'tt-finalize-accept',
              severity: 'critical',
              subject: `CAPTURE FAILED: ${bk.booking_reference}`,
              message: `⚠️ CAPTURE FAILED: ${bk.booking_reference} — partner accepted but card capture failed (${errMsg}). Manual action needed.`,
              context: { booking_id: bk.id, booking_reference: bk.booking_reference },
            })
          }
        }
      }
    } catch (capErr) {
      console.error('[tt-finalize-accept] capture pipeline error:', capErr)
      errors.push(`capture_pipeline: ${(capErr as any)?.message ?? capErr}`)
      try {
        await supabase.from('tt_notifications_log').insert({
          booking_id: dispatchRequest.booking_id,
          type: 'capture_failure_alert', channel: 'internal',
          recipient: 'admin', status: 'sent',
          message: `Capture pipeline error for ${dispatchRequest.booking_reference}: ${(capErr as any)?.message ?? capErr}`,
        })
      } catch (_) {}
    }

    // ====== 3. TRUCK-WITH-DECOR MEETING-POINT (cross-row write to decor sibling) ======
    let decorRow: any = null
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
        meeting_point_status = 'missing'
        // 422 — driver MUST provide meeting point. Roll back truck accept.
        await supabase.from('tt_dispatch_requests')
          .update({ status: 'sent', accepted_partner_id: null, accepted_partner_name: null, accepted_at: null })
          .eq('id', dispatchRequest.id)
        if (partner?.id) {
          await supabase.from('tt_partner_assets').update({ is_available: true }).eq('id', partner.id)
        }
        meeting_point_status = 'rolled_back'
        return new Response(JSON.stringify({
          success: false,
          error: 'meeting_point_required',
          message: 'This booking includes decor — set meeting point (address + time) to accept.',
          rolled_back: true,
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
          meeting_point_status = 'failed'
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
          errors.push(`meeting_point: ${mpErr.message}`)
        } else {
          meeting_point_status = 'saved'
        }
      } else {
        // Decor sibling missing — soft fail, accept proceeds, alert ops
        meeting_point_status = 'failed'
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

    // ====== 4 + 5. CUSTOMER + ADMIN SMS ======
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromTwilio = Deno.env.get('TT_PHONE_NUMBER')

    if (!fromTwilio) {
      console.error('[tt-finalize-accept] TT_PHONE_NUMBER not set, customer confirmation SMS not sent')
      errors.push('tt_phone_number_missing')
    } else if (twilioSid && twilioToken && dispatchRequest.customer_phone) {
      const customerMsg =
        `TopTier: Your ${(dispatchRequest.service_type || '').replace(/_/g, ' ')} booking is confirmed!` +
        ` ${partner?.partner_name || 'Your provider'} has accepted.` +
        ` Ref: ${dispatchRequest.booking_reference}.` +
        ` We'll send details shortly.`

      // Group C (transactional): the customer's own booking confirmation,
      // sent to the number captured on that dispatch request.
      const sent = await sendCanonicalSms({
        to: dispatchRequest.customer_phone,
        body: customerMsg,
        sendClass: 'transactional',
        purpose: 'tt_booking_confirmed',
        idempotencyKey: `tt-accept-customer-${dispatchRequest.id}`,
        from: fromTwilio,
        skipCooldown: true,
        metadata: { booking_reference: dispatchRequest.booking_reference },
      })
      if (!sent.success) {
        console.error('[tt-finalize-accept] customer SMS failed', sent.status, sent.errorMessage ?? sent.status)
        errors.push(`customer_sms: ${sent.status} ${(sent.errorMessage ?? sent.status ?? '').slice(0, 200)}`)
      } else {
        customer_sms_sent = true
      }

      // ====== ADMIN/FOUNDER OPERATIONAL ALERT ON ACCEPT ======
      try {
        const adminPhone = Deno.env.get('DAVID_PHONE_NUMBER')
        if (adminPhone) {
          const adminMsg =
            `TopTier: Partner accepted booking.` +
            ` Ref: ${dispatchRequest.booking_reference}.` +
            ` Service: ${(dispatchRequest.service_type || '').replace(/_/g, ' ')}.` +
            ` Customer: ${dispatchRequest.customer_name || 'N/A'}.` +
            ` Partner: ${partner?.partner_name || 'N/A'}.`
          const adminAlert = await sendOpsAlert({
            source: 'tt-finalize-accept',
            severity: 'info',
            subject: `Partner accepted ${dispatchRequest.booking_reference}`,
            message: adminMsg,
            context: { booking_reference: dispatchRequest.booking_reference },
          })
          const adminResp = { ok: adminAlert.emailSent || adminAlert.smsSent, text: async () => adminAlert.errors.join('; '), status: 0 }
          if (!adminResp.ok) {
            const t = await adminResp.text()
            console.error('[tt-finalize-accept] admin SMS failed', adminResp.status, t)
            errors.push(`admin_sms: ${adminResp.status} ${t.slice(0, 200)}`)
          } else {
            admin_sms_sent = true
            await supabase.from('tt_notifications_log').insert({
              booking_id: dispatchRequest.booking_id,
              type: 'partner_accepted_admin_alert',
              channel: 'sms', recipient: adminPhone, status: 'sent',
              message: adminMsg,
            })
          }
        } else {
          console.warn('[tt-finalize-accept] DAVID_PHONE_NUMBER not set, admin alert skipped')
        }
      } catch (adminErr) {
        console.error('[tt-finalize-accept] admin SMS exception (non-critical):', adminErr)
        errors.push(`admin_sms_exception: ${(adminErr as any)?.message ?? adminErr}`)
      }
    }

    // ====== 6. DUAL SMS for truck-with-decor when meeting point saved ======
    if (isTruckWithDecor && meeting_point_status === 'saved' && twilioSid && twilioToken && fromTwilio) {
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
        // Group D (workforce): contracted driver, dispatch instruction.
        const dr = await sendCanonicalSms({
          to: driverPhone,
          body: driverMsg,
          sendClass: 'workforce',
          purpose: 'tt_driver_dispatch',
          idempotencyKey: `tt-accept-driver-${dispatchRequest.id}`,
          from: fromTwilio,
          skipCooldown: true,
          metadata: { booking_reference: dispatchRequest.booking_reference },
        })
        if (!dr.success) console.error('driver SMS failed:', dr.errorMessage ?? dr.status)
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
          // Group D (workforce): contracted decorator, dispatch instruction.
          const dc = await sendCanonicalSms({
            to: decorPhone,
            body: decorMsg,
            sendClass: 'workforce',
            purpose: 'tt_decorator_dispatch',
            idempotencyKey: `tt-accept-decorator-${dispatchRequest.id}`,
            from: fromTwilio,
            skipCooldown: true,
            metadata: { booking_reference: dispatchRequest.booking_reference },
          })
          if (!dc.success) console.error('decorator SMS failed:', dc.errorMessage ?? dc.status)
        }
      }
    }

    // ====== 7. partner_accepted log ======
    try {
      await supabase.from('tt_notifications_log').insert({
        booking_id: dispatchRequest.booking_id,
        type: 'partner_accepted',
        channel: 'sms',
        recipient: dispatchRequest.customer_phone || 'customer',
        message: `Partner ${partner?.partner_name} accepted booking ${dispatchRequest.booking_reference} (via ${trigger_source})`,
        status: 'sent',
      })
    } catch (_) { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      trigger_source,
      captured,
      customer_sms_sent,
      admin_sms_sent,
      meeting_point_status,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('tt-finalize-accept fatal:', err)
    return new Response(JSON.stringify({
      success: false, error: (err as any)?.message ?? String(err), errors,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
