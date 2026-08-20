// Twilio outbound call status callback for dc-outbound-call pool.
// T7b.1: now writes answered_by + derives outcome so recompute_answer_rates
// has a real composite signal to work with. Mirrors twilio-call-status mapping.
// 2026-08-20: X-Twilio-Signature verification added (fails closed, 403).
import { readForm, verifyTwilio } from '../_shared/dialer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twilio-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read the body ONCE — the same params feed verification and the logic below.
    const formData = await readForm(req)

    // ── SIGNATURE VERIFICATION — fails closed ──
    // Brandaro sub-account token included: some pool numbers dial from that
    // account and Twilio signs the callback with THAT account's auth token.
    const v = verifyTwilio(req, formData, {
      extraTokenEnvVars: ['BRANDARO_TWILIO_AUTH_TOKEN'],
    })
    if (!v.ok) {
      console.error(`[dc-call-status] signature invalid: ${v.reason}`)
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const callSid = String(formData.CallSid || '')
    const callStatus = String(formData.CallStatus || '')
    const callDuration = String(formData.CallDuration || '0')
    const answeredBy = String(formData.AnsweredBy || '')
    const recordingUrl = String(formData.RecordingUrl || '')


    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const updates: Record<string, unknown> = {
      status: callStatus,
      duration_seconds: parseInt(callDuration || '0', 10) || 0,
      updated_at: new Date().toISOString(),
    }
    if (answeredBy) updates.answered_by = answeredBy
    if (recordingUrl) updates.recording_url = `${recordingUrl}.mp3`

    // Derive outcome from terminal Twilio statuses. Non-terminal statuses
    // (ringing/in-progress/queued/initiated) leave outcome untouched.
    if (callStatus === 'completed') {
      if (answeredBy.startsWith('machine') || answeredBy === 'fax') {
        updates.outcome = 'voicemail'
      } else if (answeredBy === 'human') {
        updates.outcome = 'answered'
      } else {
        // AMD not run or inconclusive — infer from duration.
        updates.outcome = (parseInt(callDuration || '0', 10) || 0) > 0 ? 'answered' : 'no_answer'
      }
    } else if (callStatus === 'no-answer') {
      updates.outcome = 'no_answer'
    } else if (callStatus === 'busy') {
      updates.outcome = 'busy'
    } else if (callStatus === 'failed' || callStatus === 'canceled') {
      updates.outcome = 'failed'
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/dc_call_logs?call_sid=eq.${callSid}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    )

    return new Response('OK', { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('dc-call-status error:', err)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})
