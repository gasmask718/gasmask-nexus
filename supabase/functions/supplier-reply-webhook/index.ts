const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let from = '';
    let subject = '';
    let text = '';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      from = (formData.get('from') as string) || '';
      subject = (formData.get('subject') as string) || '';
      text = (formData.get('text') as string) || (formData.get('html') as string) || '';
    } else {
      const body = await req.json();
      from = body.from || body.sender || '';
      subject = body.subject || '';
      text = body.text || body.body || '';
    }

    // Extract email from "Name <email>" format
    const emailMatch = from.match(/<(.+?)>/) || [null, from];
    const senderEmail = emailMatch[1]?.trim() || from.trim();

    // Find supplier by email
    const { data: suppliers } = await supabase
      .from('ut_suppliers')
      .select('id, name')
      .ilike('contact_email', senderEmail)
      .limit(1);

    const supplier = suppliers?.[0];

    // Find most recent thread for this supplier
    const { data: threads } = await supabase
      .from('ut_supplier_threads')
      .select('*')
      .ilike('supplier_email', senderEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    const thread = threads?.[0];

    // Save inbound message
    await supabase.from('ut_supplier_messages').insert({
      supplier_id: supplier?.id || null,
      supplier_name: supplier?.name || senderEmail,
      supplier_email: senderEmail,
      direction: 'inbound',
      channel: 'email',
      subject: subject || null,
      body: text || '(empty)',
      thread_id: thread?.id || null,
      is_read: false,
    });

    // Update thread if exists
    if (thread) {
      await supabase.from('ut_supplier_threads').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (text || '').substring(0, 100),
        unread_count: (thread.unread_count || 0) + 1,
      }).eq('id', thread.id);
    }

    // SMS alert
    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_FROM = Deno.env.get('TWILIO_PHONE_NUMBER') || Deno.env.get('TWILIO_FROM_NUMBER');
    const DAVID_PHONE = Deno.env.get('DAVID_PHONE_NUMBER') || Deno.env.get('YOUR_PHONE_NUMBER');

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && DAVID_PHONE) {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: DAVID_PHONE,
          Body: `📧 SUPPLIER REPLY: ${supplier?.name || senderEmail} responded. Check Supplier Inbox in Dynasty OS.`,
        }),
      });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('supplier-reply-webhook error:', err);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});
