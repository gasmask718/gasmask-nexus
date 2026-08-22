import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sendSms } from '../_shared/sendSms.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function shortHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

// Approval notices (UT staff / venue approvals). Outbound SMS routes through
// send-sms: suppression (dnc_list + opt_out_events + legal STOP), idempotency,
// and an outbound_messages audit row. A suppressed recipient returns 403 with
// `suppressed: true` so the caller knows the notice did NOT go out — the
// approval itself is unaffected and the client treats SMS failure as
// non-blocking.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, message } = await req.json()

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing "to" or "message"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sender parity: previously TWILIO_FROM_NUMBER || TWILIO_PHONE_NUMBER.
    const from = Deno.env.get('TWILIO_FROM_NUMBER') || Deno.env.get('TWILIO_PHONE_NUMBER') || null
    const last10 = String(to).replace(/\D/g, '').slice(-10)
    const dayBucket = new Date().toISOString().slice(0, 10)

    const result = await sendSms({
      to: String(to),
      from,
      body: String(message),
      sendClass: 'transactional',
      idempotencyKey: `approval-${last10}-${dayBucket}-${shortHash(String(message))}`,
      skipCooldown: true, // one approval = one notice
      purpose: 'approval_notice',
    })

    if (result.blocked) {
      console.warn(`[send-approval-sms] BLOCKED ${to} — ${result.errorMessage}`)
      return new Response(
        JSON.stringify({
          success: false,
          suppressed: true,
          error: `Recipient has opted out of SMS (${result.errorMessage}). Notice not sent — inform them another way.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!result.success) {
      console.error('[send-approval-sms] send failed:', result.errorMessage)
      return new Response(
        JSON.stringify({ success: false, error: result.errorMessage || 'SMS send failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, sid: result.providerMessageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('SMS error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
