import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email + password required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Try create; if exists, update password + confirm
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      // Query GoTrue admin REST directly by email
      const url = Deno.env.get('SUPABASE_URL')!;
      const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${srk}`, apikey: srk },
      });
      const body = await res.json();
      const existing = body?.users?.[0] ?? (body?.id ? body : null);
      if (!existing?.id) {
        return new Response(JSON.stringify({ error: createErr.message, lookup: body }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    // Insert va role
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'va' }, { onConflict: 'user_id,role' });
    if (roleErr) throw roleErr;

    // Seed user_profiles primary_role if table exists
    await admin
      .from('user_profiles')
      .upsert({ id: userId, primary_role: 'va', email, must_change_password: true }, { onConflict: 'id' });

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email, role: 'va' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
