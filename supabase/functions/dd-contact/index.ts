import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(5000),
  source: z.string().trim().max(100).optional(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const CONTACT_NOTIFY_TO = Deno.env.get('CONTACT_NOTIFY_TO') ?? 'david@dynastydirect.com';
const CONTACT_FROM = Deno.env.get('CONTACT_FROM') ?? 'Dynasty Direct <onboarding@resend.dev>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { name, email, message, source } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const ip =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      null;
    const ua = req.headers.get('user-agent') ?? null;

    const { data, error } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email,
        message,
        source: source ?? 'public_site',
        ip_address: ip,
        user_agent: ua,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[dd-contact] insert failed', error);
      return new Response(JSON.stringify({ error: 'insert_failed', detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Optional email relay (only when RESEND_API_KEY is configured)
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: CONTACT_FROM,
            to: [CONTACT_NOTIFY_TO],
            reply_to: email,
            subject: `New contact: ${name}`,
            html: `<h2>New contact message</h2>
              <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
              <p><strong>Source:</strong> ${source ?? 'public_site'}</p>
              <pre style="white-space:pre-wrap;font-family:inherit">${message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</pre>`,
          }),
        });
      } catch (e) {
        console.error('[dd-contact] resend relay failed (non-fatal)', e);
      }
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[dd-contact] unhandled', e);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
