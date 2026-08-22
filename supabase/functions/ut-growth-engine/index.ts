import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errText } from "../_shared/errText.ts";
import { sendSms } from "../_shared/sendSms.ts";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.json()
  const { action, audience_type, channel, campaign_id, limit = 50 } = body

  const twilioFrom = Deno.env.get('TWILIO_FROM_NUMBER') || Deno.env.get('TWILIO_PHONE_NUMBER')
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  // ─── ACTION: run_sms_outreach ───
  // Recruitment cold outreach → campaign class. Routes through send-sms:
  // suppression + legal-STOP gate, idempotency, campaign cap, cooldown.
  if (action === 'run_sms_outreach') {

    const { data: campaign } = await supabase
      .from('ut_campaigns')
      .select('*')
      .eq('audience_type', audience_type)
      .eq('channel', 'sms')
      .eq('status', 'active')
      .single()

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'No active SMS campaign found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: leads } = await supabase
      .from('ut_leads')
      .select('*')
      .eq('lead_type', audience_type)
      .in('grade', ['A', 'B'])
      .not('phone', 'is', null)
      .is('outreach_sent_at', null)
      .limit(limit)

    if (!leads?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No uncontacted leads found', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sent = 0
    let failed = 0
    const logs: any[] = []

    for (const lead of leads) {
      try {
        let message = (campaign.message_template || '')
          .replace('[name]', lead.contact_name || lead.business_name || 'there')
          .replace('[business]', lead.business_name || 'your venue')
          .replace('[city]', lead.city || 'your city')
          .replace('[LINK]', 'https://unforgettable-times.com/join')

        if (anthropicKey && lead.business_name) {
          try {
            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 200,
                messages: [{
                  role: 'user',
                  content: `Write a personalized SMS under 160 chars for ${lead.business_name} in ${lead.city} inviting them to join Unforgettable Times event platform as a ${audience_type}. End with: unforgettable-times.com/join. Be direct, friendly, specific. No quotes, just the message.`
                }]
              })
            })
            const aiData = await aiRes.json()
            if (aiData.content?.[0]?.text) message = aiData.content[0].text.trim()
          } catch (_e) { console.log('AI personalization failed, using template') }
        }

        const sms = await sendSms({
          to: lead.phone,
          body: message,
          from: twilioFrom,
          idempotencyKey: `ut-growth-sms-${campaign.id}-${lead.id}`,
          sendClass: 'campaign',
          campaignId: campaign.id,
          campaignMaxSends: leads.length,
          purpose: 'ut_growth_outreach',
          metadata: { campaign_id: campaign.id, lead_id: lead.id, audience_type },
        })

        if (sms.success) {
          sent++
          logs.push({
            campaign_id: campaign.id, prospect_id: lead.id, prospect_table: 'ut_leads',
            channel: 'sms', to_number: lead.phone, message_sent: message,
            status: 'sent', twilio_sid: sms.providerMessageId
          })
          await supabase.from('ut_leads').update({
            status: 'contacted', outreach_channel: 'sms',
            outreach_sent_at: new Date().toISOString()
          }).eq('id', lead.id)
        } else {
          // Suppressed/blocked is a named outcome, not a failure — and the
          // lead is NOT marked contacted, so a lifted suppression (START) can
          // still be reached on a later run.
          if (sms.blocked) blocked++; else failed++
          logs.push({
            campaign_id: campaign.id, prospect_id: lead.id, prospect_table: 'ut_leads',
            channel: 'sms', to_number: lead.phone, message_sent: message,
            status: sms.blocked ? 'blocked' : 'failed',
            error_message: `${sms.status}: ${sms.errorMessage ?? ''}`
          })
        }
        await new Promise(r => setTimeout(r, 1000))
      } catch (_err) { failed++ }
    }

    if (logs.length) await supabase.from('ut_outreach_log').insert(logs)
    await supabase.from('ut_campaigns').update({
      total_sent: (campaign.total_sent || 0) + sent, last_run_at: new Date().toISOString()
    }).eq('id', campaign.id)

    return new Response(
      JSON.stringify({ success: true, sent, failed, blocked }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ─── ACTION: run_email_outreach ───
  if (action === 'run_email_outreach') {
    if (!sendgridKey) {
      return new Response(
        JSON.stringify({ error: 'SENDGRID_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: campaign } = await supabase
      .from('ut_campaigns').select('*')
      .eq('audience_type', audience_type).eq('channel', 'email').eq('status', 'active').single()

    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'No active email campaign' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: leads } = await supabase
      .from('ut_leads').select('*')
      .eq('lead_type', audience_type).in('grade', ['A', 'B'])
      .not('email', 'is', null).is('outreach_sent_at', null).limit(limit)

    if (!leads?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No uncontacted email leads', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sent = 0, failed = 0

    for (const lead of leads) {
      try {
        let subject = (campaign.email_subject || '')
          .replace('[city]', lead.city || 'your city')
          .replace('[name]', lead.contact_name || 'there')

        let emailBody = (campaign.email_template || '')
          .replace('[name]', lead.contact_name || 'there')
          .replace('[city]', lead.city || 'your city')
          .replace('[business]', lead.business_name || 'your business')
          .replace('[LINK]', 'https://unforgettable-times.com/join')

        if (anthropicKey && lead.business_name) {
          try {
            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-20250514', max_tokens: 500,
                messages: [{ role: 'user', content: `Write a short personalized cold email for ${lead.business_name} in ${lead.city} about joining Unforgettable Times as a ${audience_type} partner. 3 paragraphs max. Professional but warm. End with CTA link: unforgettable-times.com/join. Return only the email body.` }]
              })
            })
            const aiData = await aiRes.json()
            if (aiData.content?.[0]?.text) emailBody = aiData.content[0].text.trim()
          } catch (_e) { console.log('AI email personalization failed') }
        }

        const emailRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: lead.email }], subject }],
            from: { email: 'hello@unforgettable-times.com', name: 'Unforgettable Times' },
            content: [{ type: 'text/plain', value: emailBody }]
          })
        })

        if (emailRes.ok || emailRes.status === 202) {
          sent++
          await supabase.from('ut_leads').update({
            status: 'contacted', outreach_channel: 'email',
            outreach_sent_at: new Date().toISOString()
          }).eq('id', lead.id)
          await supabase.from('ut_outreach_log').insert({
            campaign_id: campaign.id, prospect_id: lead.id, prospect_table: 'ut_leads',
            channel: 'email', to_email: lead.email, message_sent: emailBody,
            subject_sent: subject, status: 'sent'
          })
        } else { failed++ }
        await new Promise(r => setTimeout(r, 500))
      } catch (_err) { failed++ }
    }

    await supabase.from('ut_campaigns').update({
      total_sent: (campaign.total_sent || 0) + sent, last_run_at: new Date().toISOString()
    }).eq('id', campaign.id)

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ─── ACTION: send_daily_report ───
  if (action === 'send_daily_report') {
    const today = new Date().toISOString().split('T')[0]

    const { data: todayLeads } = await supabase
      .from('ut_leads').select('lead_type, grade').gte('created_at', today)
    const { data: todayOutreach } = await supabase
      .from('ut_outreach_log').select('channel, status').gte('created_at', today)

    const venues = todayLeads?.filter(l => l.lead_type === 'venue').length || 0
    const staff = todayLeads?.filter(l => l.lead_type === 'staff').length || 0
    const ambassadors = todayLeads?.filter(l => l.lead_type === 'ambassador').length || 0
    const aGrade = todayLeads?.filter(l => l.grade === 'A').length || 0
    const smsSent = todayOutreach?.filter(o => o.channel === 'sms').length || 0
    const emailsSent = todayOutreach?.filter(o => o.channel === 'email').length || 0

    await supabase.from('ut_growth_reports').upsert({
      report_date: today, venues_found: venues, staff_found: staff,
      ambassadors_found: ambassadors, sms_sent: smsSent, emails_sent: emailsSent
    }, { onConflict: 'report_date' })

    if (twilioSid && twilioAuth && twilioFrom) {
      const reportMsg = `🔥 UT DAILY GROWTH REPORT\nDate: ${today}\n━━━━━━━━━━━━━━\nLEADS: Venues ${venues} | Staff ${staff} | Ambassadors ${ambassadors} | A-Grade ${aGrade}\nOUTREACH: SMS ${smsSent} | Emails ${emailsSent}\n━━━━━━━━━━━━━━\nCheck OS for details`

      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: '+19295007046', From: twilioFrom, Body: reportMsg })
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, report: { venues, staff, ambassadors, smsSent, emailsSent } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ─── ACTION: queue_instagram_dms ───
  if (action === 'queue_instagram_dms') {
    const { data: prospects } = await supabase
      .from('ut_ambassador_prospects').select('*')
      .eq('platform', 'instagram').eq('grade', 'A').eq('status', 'prospect').limit(50)

    if (!prospects?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No prospects to DM', queued: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let dmList: any[] = []
    if (anthropicKey) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514', max_tokens: 3000,
            messages: [{ role: 'user', content: `Write personalized Instagram DMs under 150 chars each for these ambassador prospects. Each DM should mention their content style and city naturally. End each with: unforgettable-times.com/ambassador\n\nReturn JSON array: [{"username": "x", "dm": "message"}]\n\nProspects:\n${JSON.stringify(prospects.map(p => ({ username: p.username, name: p.full_name, city: p.city, followers: p.followers_count, bio: p.bio })))}` }]
          })
        })
        const aiData = await aiRes.json()
        dmList = JSON.parse(aiData.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
      } catch (e) { console.error('DM parse error:', errText(e)) }
    }

    for (const dm of dmList) {
      await supabase.from('ut_ambassador_prospects')
        .update({ ai_dm_message: dm.dm }).eq('username', dm.username)
    }

    await supabase.from('ut_ambassador_prospects')
      .update({ status: 'dm_sent', dm_sent_at: new Date().toISOString() })
      .in('username', prospects.map(p => p.username))

    const logs = prospects.map(p => ({
      channel: 'instagram_dm', to_instagram: p.username,
      message_sent: dmList.find((d: any) => d.username === p.username)?.dm || '',
      status: 'sent', prospect_id: p.id, prospect_table: 'ut_ambassador_prospects'
    }))
    if (logs.length) await supabase.from('ut_outreach_log').insert(logs)

    return new Response(
      JSON.stringify({ success: true, queued: prospects.length, dms: dmList }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Unknown action' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
