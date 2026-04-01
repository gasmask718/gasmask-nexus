import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channel, to, subject, body, supplier_id, supplier_name, rfq_id, thread_id, product_name } = await req.json();

    if (!channel || !to || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let success = false;

    if (channel === 'email') {
      const SENDGRID_KEY = Deno.env.get('SENDGRID_API_KEY');
      if (!SENDGRID_KEY) {
        return new Response(JSON.stringify({ error: 'SENDGRID_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: 'suppliers@unforgettabletimes.com', name: 'Unforgettable Times Sourcing' },
          reply_to: { email: 'suppliers@unforgettabletimes.com' },
          personalizations: [{ to: [{ email: to }], subject: subject || 'Sourcing Inquiry - Unforgettable Times' }],
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      success = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.error('SendGrid error:', errText);
      }
    }

    if (channel === 'whatsapp') {
      const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
      const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
      const TWILIO_WA = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || Deno.env.get('TWILIO_FROM_NUMBER');

      if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WA) {
        return new Response(JSON.stringify({ error: 'Twilio not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${TWILIO_WA}`,
          To: `whatsapp:${to}`,
          Body: body,
        }),
      });
      success = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.error('Twilio error:', errText);
      }
    }

    if (success) {
      // Save message
      await supabase.from('ut_supplier_messages').insert({
        supplier_id: supplier_id || null,
        supplier_name: supplier_name || 'Unknown',
        supplier_email: channel === 'email' ? to : null,
        supplier_whatsapp: channel === 'whatsapp' ? to : null,
        direction: 'outbound',
        channel,
        subject: subject || null,
        body,
        thread_id: thread_id || null,
        rfq_id: rfq_id || null,
        is_read: true,
      });

      // Update thread
      if (thread_id) {
        await supabase.from('ut_supplier_threads').update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.substring(0, 100),
          message_count: undefined, // handled by increment if needed
        }).eq('id', thread_id);
      }
    }

    return new Response(JSON.stringify({ success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('supplier-send error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
