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

const RATE_LIMIT_PER_IP_PER_HOUR = 5

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
      return fakeSuccessResponse('inquiry')
    }

    // Layer 3: Rate limit per IP
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count: recentCount } = await supabase
      .from('surplus_funds_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo)

    if (recentCount && recentCount >= RATE_LIMIT_PER_IP_PER_HOUR) {
      console.warn(`Inquiry rate limit exceeded for IP ${ipAddress}: ${recentCount}/hr`)
      return jsonResponse(
        { error: 'Too many submissions. Please try again later.' },
        429,
      )
    }

    // Layer 4: Webhook secret
    const secretBlocked = webhookSecretCheck(req)
    if (secretBlocked) return secretBlocked

    if (!formData.name || !formData.email || !formData.message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inquiry, error } = await supabase
      .from('surplus_funds_inquiries')
      .insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        source: 'dynasty_recovery_website',
        utm_source: formData.utm_source,
        utm_medium: formData.utm_medium,
        utm_campaign: formData.utm_campaign,
        user_agent: req.headers.get('user-agent'),
        ip_address: ipAddress,
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
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Dynasty Recovery <info@dynastyrecoverygroup.com>',
            to: ['anthony@dynastyrecoverygroup.com'],
            reply_to: inquiry.email,
            subject: `📨 ${inquiry.subject || 'General Inquiry'} — ${inquiry.name}`,
            html: `
              <h2>New Inquiry from ${inquiry.name}</h2>
              <p><strong>Email:</strong> ${inquiry.email}</p>
              ${inquiry.phone ? `<p><strong>Phone:</strong> ${inquiry.phone}</p>` : ''}
              <p><strong>Subject:</strong> ${inquiry.subject || '—'}</p>
              <div style="background:#f9f9f9;padding:12px;border-left:4px solid #0F6E56;">
                <strong>Message:</strong><br/>${(inquiry.message || '').replace(/\n/g, '<br/>')}
              </div>
              <p style="font-size:12px;color:#666;">Reply directly to this email to respond.</p>
            `,
          }),
        })
        await supabase
          .from('surplus_funds_inquiries')
          .update({ email_notification_sent: true, email_notification_sent_at: new Date().toISOString() })
          .eq('id', inquiry.id)
      }
    } catch (e) {
      console.error('Email error:', e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        inquiry_id: inquiry.id,
        message: 'Message received. We will respond within 1 business day.',
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
