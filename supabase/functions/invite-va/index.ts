// Admin-triggered: create a VA invite + (best-effort) send invite email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate the caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRow, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleErr) throw roleErr;
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const company_id = (body.company_id ?? '').toString();
    const role = (body.role ?? 'va').toString();

    if (!email || !email.includes('@') || !company_id) {
      return new Response(JSON.stringify({ error: 'email and company_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify company exists
    const { data: company, error: cErr } = await admin
      .from('va_companies').select('id, name, slug').eq('id', company_id).maybeSingle();
    if (cErr) throw cErr;
    if (!company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    const { data: invite, error: insErr } = await admin
      .from('va_invites')
      .insert({
        email, company_id, role, token, invited_by: callerId,
      })
      .select('id, token, expires_at')
      .single();
    if (insErr) throw insErr;

    // Always send invitees to the production VA auth page so the link works
    // regardless of which preview/origin generated it.
    const baseUrl = 'https://gasmask-os-nexus.lovable.app';
    const acceptUrl = `${baseUrl}/va/auth?invite=${token}`;

    // Best-effort email — only attempt if transactional email infra is wired.
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { data: mailData, error: mailErr } = await admin.functions.invoke('va-send-email', {
        body: {
          to: email,
          subject: `You're invited to join ${company.name} as a VA`,
          from_name: company.name,
          html: `
            <div style="font-family:sans-serif;padding:24px;max-width:560px;margin:auto">
              <h2>You've been invited to ${company.name}</h2>
              <p>You've been invited to join <strong>${company.name}</strong> as a Virtual Assistant.</p>
              <p>Click the button below to set up your account. This link expires in 14 days.</p>
              <p><a href="${acceptUrl}" style="display:inline-block;background:#06b6d4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Accept invite</a></p>
              <p style="color:#64748b;font-size:12px;word-break:break-all">${acceptUrl}</p>
            </div>
          `,
          text: `You've been invited to ${company.name} as a VA. Accept your invite: ${acceptUrl}`,
        },
      });
      if (mailErr) emailError = mailErr.message ?? String(mailErr);
      else if ((mailData as any)?.error) emailError = (mailData as any).error;
      else emailSent = true;
    } catch (e) {
      emailError = (e as Error).message;
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: invite.id,
        accept_url: acceptUrl,
        expires_at: invite.expires_at,
        email_sent: emailSent,
        email_error: emailError,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('invite-va error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
