// Public: validate a token (lookup), create pre-confirmed invited users, then provision membership atomically.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InviteResult = {
  success?: boolean;
  error?: string;
  va_user_id?: string;
  company_id?: string;
  role?: string;
};

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const token = (body.token ?? '').toString();
    const action = (body.action ?? 'lookup').toString(); // 'lookup' | 'complete_signup' | 'accept'

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

    if (action === 'complete_signup') {
      const password = (body.password ?? '').toString();
      const fullName = (body.fullName ?? '').toString().trim();

      if (invite.status !== 'pending') {
        return new Response(JSON.stringify({ error: `Invite is ${invite.status}` }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Invite expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const userMetadata = fullName ? { full_name: fullName } : {};
      let createdUserId: string | undefined;

      // Role is derived from a server-verified invite row and passed as
      // app_metadata.provisioned_role — handle_new_user() trusts nothing else.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invite.email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: { provisioned_role: 'va' },
      });

      if (createErr) {
        const maybeExisting = await findUserByEmail(admin, invite.email);
        if (!maybeExisting) {
          console.error('admin createUser failed', createErr);
          return new Response(JSON.stringify({ error: createErr.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (maybeExisting.email_confirmed_at) {
          return new Response(JSON.stringify({ error: 'Account already exists. Please sign in, then accept the invite.' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { error: updateErr } = await admin.auth.admin.updateUserById(maybeExisting.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(maybeExisting.user_metadata ?? {}),
            ...userMetadata,
          },
          app_metadata: {
            ...((maybeExisting as any).app_metadata ?? {}),
            provisioned_role: 'va',
          },
        });

        if (updateErr) {
          console.error('admin updateUserById failed', updateErr);
          return new Response(JSON.stringify({ error: updateErr.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        createdUserId = maybeExisting.id;
      } else {
        createdUserId = created.user?.id;
      }

      if (!createdUserId) {
        return new Response(JSON.stringify({ error: 'Unable to create invited user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: rpcData, error: rpcErr } = await admin.rpc('accept_va_invite_atomic', {
        p_token: token,
        p_accepting_user_id: createdUserId,
        p_accepting_email: invite.email.toLowerCase(),
      });

      if (rpcErr) {
        console.error('accept_va_invite_atomic rpc error', rpcErr);
        return new Response(JSON.stringify({ error: rpcErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const result = (rpcData ?? {}) as InviteResult;
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
        email: invite.email,
        userId: createdUserId,
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

    const result = (rpcData ?? {}) as InviteResult;
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
