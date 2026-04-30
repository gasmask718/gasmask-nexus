// Public: validate a token, then (after user is authenticated) attach membership.
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
    if (invite.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Invite is ${invite.status}` }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      await admin.from('va_invites').update({ status: 'expired' }).eq('id', invite.id);
      return new Response(JSON.stringify({ error: 'Invite expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'lookup') {
      return new Response(JSON.stringify({
        email: invite.email,
        role: invite.role,
        company: invite.va_companies,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACCEPT — caller must be authenticated as the invited email
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
    if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'This invite is for a different email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Provision: user_profiles, user_roles, va_company_memberships
    await admin.from('user_profiles').upsert(
      { user_id: user.id, full_name: user.user_metadata?.full_name ?? null, primary_role: 'va' },
      { onConflict: 'user_id' },
    );

    const { data: existingRole } = await admin
      .from('user_roles').select('id').eq('user_id', user.id).eq('role', 'va').maybeSingle();
    if (!existingRole) {
      await admin.from('user_roles').insert({ user_id: user.id, role: 'va' });
    }

    const { error: memErr } = await admin
      .from('va_company_memberships')
      .upsert(
        {
          user_id: user.id,
          company_id: invite.company_id,
          role: invite.role,
          is_primary: true,
          is_active: true,
          created_by: user.id,
        },
        { onConflict: 'user_id,company_id' },
      );
    if (memErr) throw memErr;

    await admin.from('va_invites')
      .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

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
