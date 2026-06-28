// Public: validate a token (lookup), then (after user is authenticated) provision membership atomically.
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
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const token = (body.token ?? '').toString();
    const action = (body.action ?? 'lookup').toString(); // 'lookup' | 'accept'

    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Lookup is read-only and public (token-gated): unchanged behavior.
    const { data: invite, error: invErr } = await admin
      .from('va_invites')
      .select('id, email, company_id, role, status, expires_at, va_companies:company_id (id, name, slug, brand_color)')
      .eq('token', token)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invalid invite' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'lookup') {
      // Still surface stale states so the UI can react, but don't mutate here —
      // expire transitions belong to the cron + atomic RPC.
      if (invite.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Invite is ${invite.status}` }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Invite expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        email: invite.email,
        role: invite.role,
        company: invite.va_companies,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACCEPT — caller must be authenticated as the invited email.
    // JWT verification + email-match enforcement preserved here on purpose
    // (defense-in-depth before the RPC also re-checks the email).
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sign in first' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = ures.user;
    const userEmail = (user.email ?? '').toLowerCase();
    if (userEmail !== invite.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'This invite is for a different email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Atomic provisioning — function performs all 4 writes in one transaction.
    const { data: rpcData, error: rpcErr } = await admin.rpc('accept_va_invite_atomic', {
      p_token: token,
      p_accepting_user_id: user.id,
      p_accepting_email: userEmail,
    });

    if (rpcErr) {
      console.error('accept_va_invite_atomic rpc error', rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = (rpcData ?? {}) as { success?: boolean; error?: string };
    if (!result.success) {
      const code = result.error ?? 'accept_failed';
      const status =
        code === 'invite_not_found' ? 404 :
        code === 'invite_expired' || code.startsWith('invite_') ? 410 :
        code === 'email_mismatch' ? 403 :
        500;
      return new Response(JSON.stringify({ error: code }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      company: invite.va_companies,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('accept-va-invite error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
