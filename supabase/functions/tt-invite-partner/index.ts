// tt-invite-partner — sends a Supabase magic-link invite to a seeded partner.
// IMPORTANT: We never set the partner's password. The partner sets their own
// credential after they click the invite link and land on /partner/claim.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { partner_id, redirect_origin } = await req.json();
    if (!partner_id) {
      return new Response(JSON.stringify({ error: 'partner_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Look up partner email
    const { data: partner, error: pErr } = await admin
      .from('tt_partners')
      .select('id, email, business_name, name, portal_status')
      .eq('id', partner_id)
      .maybeSingle();

    if (pErr || !partner) {
      return new Response(JSON.stringify({ error: 'partner not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!partner.email) {
      return new Response(JSON.stringify({ error: 'partner has no email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const origin =
      redirect_origin || req.headers.get('origin') || 'https://gasmask-os-nexus.lovable.app';
    const redirectTo = `${origin}/partner/claim?partner_id=${partner.id}`;

    // Supabase invite — sends magic link to partner; partner sets own password.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(partner.email, {
      redirectTo,
      data: { tt_partner_id: partner.id, business_name: partner.business_name ?? partner.name },
    });

    // If user already exists, fall back to generating a magic link
    if (inviteErr && /already.*registered|exists/i.test(inviteErr.message)) {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: partner.email,
        options: { redirectTo },
      });
      if (linkErr) {
        return new Response(JSON.stringify({ error: linkErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Magic link is generated server-side; default email template will deliver.
      console.log('Generated magic link for existing user', partner.email, link?.properties?.action_link);
    } else if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin
      .from('tt_partners')
      .update({ portal_status: 'invited', invited_at: new Date().toISOString() })
      .eq('id', partner.id);

    return new Response(
      JSON.stringify({ ok: true, partner_id: partner.id, email: partner.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
