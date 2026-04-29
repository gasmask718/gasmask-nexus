import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const providedSecret = req.headers.get('x-webhook-secret')
    if (providedSecret !== Deno.env.get('DYNASTY_RECOVERY_WEBHOOK_SECRET')) {
      console.warn('Unauthorized request - invalid webhook secret')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formData = await req.json()
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const required = ['full_name', 'phone', 'email', 'property_address', 'city', 'state']
    const missing = required.filter((f) => !formData[f])
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields', missing }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nameParts = (formData.full_name || '').trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const { data: lead, error: insertError } = await supabase
      .from('surplus_funds_leads')
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: formData.phone,
        email: formData.email,
        property_address: formData.property_address,
        city: formData.city,
        state: formData.state,
        county: formData.city,
        lead_source: 'dynasty_recovery_website',
        status: 'new',
        website_consent_given: formData.consent === true,
        website_consent_timestamp: new Date().toISOString(),
        website_contact_preference: formData.contact_preference,
        website_best_time: formData.best_time,
        website_sale_type: formData.sale_type,
        website_ownership_type: formData.ownership_type,
        website_notes: formData.notes,
        foreclosure_date: formData.sale_date || null,
        utm_source: formData.utm_source,
        utm_medium: formData.utm_medium,
        utm_campaign: formData.utm_campaign,
        utm_term: formData.utm_term,
        utm_content: formData.utm_content,
        referrer: formData.referrer,
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Database error', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email via Resend
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const submittedAt = new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#0F6E56;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;">🔥 NEW WEBSITE LEAD</h1>
              <p style="margin:4px 0 0;">Dynasty Recovery Group — Floor 1</p>
            </div>
            <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
              <h2 style="margin-top:0;">${formData.full_name}</h2>
              <p style="color:#0F6E56;font-weight:bold;">⏱️ Bland AI calling within 2 minutes</p>
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px;font-weight:bold;">Phone:</td><td>${formData.phone}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Email:</td><td>${formData.email}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Property:</td><td>${formData.property_address}, ${formData.city}, ${formData.state}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Sale Type:</td><td>${formData.sale_type || '—'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Ownership:</td><td>${formData.ownership_type || '—'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Best Time:</td><td>${formData.best_time || 'Anytime'}</td></tr>
                <tr><td style="padding:6px;font-weight:bold;">Source:</td><td>${formData.utm_source || 'Direct'}</td></tr>
              </table>
              ${formData.notes ? `<p><strong>Notes:</strong><br/>${formData.notes}</p>` : ''}
              <hr/>
              <p style="font-size:12px;color:#666;">Lead ID: ${lead.id}<br/>Submitted: ${submittedAt} ET</p>
            </div>
          </div>
        `
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Dynasty Recovery <leads@dynastyrecoverygroup.com>',
            to: ['anthony@dynastyrecoverygroup.com'],
            subject: `🔥 WEBSITE LEAD: ${formData.full_name} — ${formData.state}`,
            html: emailHtml,
          }),
        })
        if (emailRes.ok) {
          await supabase
            .from('surplus_funds_leads')
            .update({ email_notification_sent: true, email_notification_sent_at: new Date().toISOString() })
            .eq('id', lead.id)
        }
      }
    } catch (e) {
      console.error('Email error:', e)
    }

    // SMS via Twilio
    try {
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const tok = Deno.env.get('TWILIO_AUTH_TOKEN')
      const from = Deno.env.get('TWILIO_FROM_NUMBER')
      const to = Deno.env.get('DAVID_PHONE_NUMBER')
      if (sid && tok && from && to) {
        const body = `🔥 WEBSITE LEAD\n${formData.full_name} — ${formData.state}\n${formData.phone}\n${formData.property_address}\nID: ${lead.id.slice(0, 8)}`
        const auth = btoa(`${sid}:${tok}`)
        const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: to, From: from, Body: body }),
        })
        if (smsRes.ok) {
          await supabase
            .from('surplus_funds_leads')
            .update({ sms_notification_sent: true, sms_notification_sent_at: new Date().toISOString() })
            .eq('id', lead.id)
        }
      }
    } catch (e) {
      console.error('SMS error:', e)
    }

    // Trigger Bland AI call
    try {
      const blandTrigger = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/bland-agent-trigger`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: Deno.env.get('SF_CLIENT_AGENT_ID'),
            phone_number: formData.phone,
            lead_id: lead.id,
            lead_table: 'surplus_funds_leads',
            request_data: {
              first_name: firstName,
              property_address: formData.property_address,
              state: formData.state,
              sale_type: formData.sale_type,
            },
          }),
        }
      )
      if (blandTrigger.ok) {
        const blandData = await blandTrigger.json().catch(() => ({}))
        await supabase
          .from('surplus_funds_leads')
          .update({
            bland_call_triggered: true,
            bland_call_triggered_at: new Date().toISOString(),
            bland_call_id: blandData.call_id || blandData.id || null,
            status: 'contacted',
          })
          .eq('id', lead.id)
      }
    } catch (e) {
      console.error('Bland trigger error:', e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        message: 'Lead received. We will contact you within 24-48 hours.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
