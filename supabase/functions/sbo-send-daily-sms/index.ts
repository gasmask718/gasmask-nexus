import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSms } from '../_shared/sendSms.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];
    const phoneOverride = body.phone_number;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get today's briefing
    let { data: briefing } = await supabase
      .from('sbo_daily_briefings')
      .select('*')
      .eq('briefing_date', date)
      .maybeSingle();

    if (!briefing) {
      // Generate it first
      await supabase.functions.invoke('sbo-generate-daily-briefing', {
        body: { date },
      });

      const { data: newBriefing } = await supabase
        .from('sbo_daily_briefings')
        .select('*')
        .eq('briefing_date', date)
        .maybeSingle();

      briefing = newBriefing;
    }

    if (!briefing?.full_message) throw new Error('No briefing found');

    const phone = phoneOverride || briefing.phone_number || Deno.env.get('YOUR_PHONE_NUMBER')!;

    // SMS has 1600 char limit — split if needed
    const messages: string[] = [];
    const fullMsg = briefing.full_message;

    if (fullMsg.length <= 1500) {
      messages.push(fullMsg);
    } else {
      const sections = fullMsg.split('\n\n');
      let current = '';
      for (const section of sections) {
        if ((current + section).length > 1400) {
          if (current) messages.push(current.trim());
          current = section + '\n\n';
        } else {
          current += section + '\n\n';
        }
      }
      if (current.trim()) messages.push(current.trim());
    }

    // Send each message part
    const sids: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      let msgBody = messages[i];
      if (messages.length > 1) {
        msgBody = `(${i + 1}/${messages.length}) ` + msgBody;
      }

      const result = await sendSms({
        to: phone,
        body: msgBody,
        idempotencyKey: `sbo-brief-${briefing.id}-${i}`,
        sendClass: "campaign",
        from: Deno.env.get('TWILIO_PHONE_NUMBER') || undefined,
        purpose: 'sbo_daily_briefing',
        skipCooldown: true,
        metadata: { briefing_id: briefing.id, part: i + 1, parts: messages.length },
      });

      if (!result.success) {
        throw new Error(`SMS send failed (${result.status}): ${result.errorMessage || result.errorCode || 'unknown'}`);
      }

      sids.push(result.providerMessageId ?? '');

      await supabase.from('sbo_sms_log').insert({
        direction: 'outbound',
        phone_number: phone,
        message_body: msgBody,
        twilio_sid: result.providerMessageId,
        briefing_id: briefing.id,
      });

      if (i < messages.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Update briefing status
    await supabase
      .from('sbo_daily_briefings')
      .update({
        sent_at: new Date().toISOString(),
        status: 'sent',
      })
      .eq('id', briefing.id);

    return new Response(JSON.stringify({
      success: true,
      messages_sent: messages.length,
      twilio_sids: sids,
      phone,
      briefing_date: date,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('SMS send error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
