import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  drCorsHeaders as corsHeaders,
  originCheck,
  isHoneypotTriggered,
  fakeSuccessResponse,
  webhookSecretCheck,
  getClientIp,
  jsonResponse,
} from '../_shared/dynastyRecoverySecurity.ts'

const RATE_LIMIT_PER_IP_PER_HOUR = 3

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Layer 1: Origin
    const originBlocked = originCheck(req)
    if (originBlocked) return originBlocked

    const formData = await req.json()
    const ipAddress = getClientIp(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Layer 2: Honeypot
    if (isHoneypotTriggered(formData)) {
      console.warn('Bot detected via honeypot from IP:', ipAddress)
      return fakeSuccessResponse('application')
    }

    // Layer 3: Rate limit (by website source within 1h, no ip column on attorneys)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count: recentCount } = await supabase
      .from('surplus_funds_attorneys')
      .select('id', { count: 'exact', head: true })
      .eq('application_source', 'dynasty_recovery_website')
      .gte('created_at', oneHourAgo)

    if (recentCount && recentCount >= RATE_LIMIT_PER_IP_PER_HOUR) {
      console.warn(`Attorney intake rate limit exceeded: ${recentCount}/hr`)
      return jsonResponse(
        { error: 'Too many applications recently. Please try again later.' },
        429,
      )
    }

    // Layer 4: Webhook secret
    const secretBlocked = webhookSecretCheck(req)
    if (secretBlocked) return secretBlocked

    if (
      !formData.full_name ||
      !formData.firm_name ||
      !formData.bar_admissions ||
      !formData.bar_number ||
      !formData.email ||
      !formData.phone
    ) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
      !formData.full_name ||
      !formData.firm_name ||
      !formData.bar_admissions ||
      !formData.bar_number ||
      !formData.email ||
      !formData.phone
    ) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!formData.malpractice_confirmed || !formData.iolta_confirmed) {
      return new Response(
        JSON.stringify({ error: 'Insurance and IOLTA confirmation required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: app, error } = await supabase
      .from('surplus_funds_attorneys')
      .insert({
        name: formData.full_name,
        firm: formData.firm_name,
        phone: formData.phone,
        email: formData.email,
        states: formData.bar_admissions,
        status: 'pending_review',
        application_status: 'application_received',
        bar_number: formData.bar_number,
        years_practice: formData.years_practice ? parseInt(formData.years_practice) : null,
        practice_areas: formData.practice_areas,
        interest_reason: formData.interest_reason,
        malpractice_confirmed: formData.malpractice_confirmed,
        iolta_confirmed: formData.iolta_confirmed,
        application_source: 'dynasty_recovery_website',
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#7C2D12;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;">⚖️ NEW ATTORNEY APPLICATION</h1>
            </div>
            <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
              <h2 style="margin-top:0;">${formData.full_name}</h2>
              <p style="color:#7C2D12;font-weight:bold;">${formData.firm_name}</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px;font-weight:bold;">States:</td><td>${(formData.bar_admissions || []).join(', ')}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Bar #:</td><td>${formData.bar_number}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Years:</td><td>${formData.years_practice || '—'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Email:</td><td>${formData.email}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Phone:</td><td>${formData.phone}</td></tr>
              </table>
              ${formData.interest_reason ? `<p><strong>Interest:</strong><br/>${formData.interest_reason}</p>` : ''}
              <div style="background:#fff;padding:12px;border-left:4px solid #7C2D12;margin-top:16px;">
                <strong>NEXT STEPS:</strong>
                <ol>
                  <li>Verify bar status</li>
                  <li>Verify malpractice insurance</li>
                  <li>Verify IOLTA account</li>
                  <li>Send Attorney Referral Agreement</li>
                </ol>
              </div>
            </div>
          </div>
        `
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Dynasty Recovery <attorneys@dynastyrecoverygroup.com>',
            to: ['anthony@dynastyrecoverygroup.com'],
            subject: `⚖️ Attorney Application: ${formData.full_name} — ${(formData.bar_admissions || []).join(',')}`,
            html,
          }),
        })
      }
    } catch (e) {
      console.error('Email error:', e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        application_id: app.id,
        message: 'Application received. David will reach out within 2 business days.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
