import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ambassador_id } = await req.json();
    if (!ambassador_id) {
      return new Response(JSON.stringify({ error: "ambassador_id required" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Fetch ambassador record
    const { data: amb, error: fetchErr } = await admin
      .from("unforgettable_ambassadors")
      .select("*")
      .eq("id", ambassador_id)
      .single();

    if (fetchErr || !amb) {
      return new Response(JSON.stringify({ error: "Ambassador not found" }), { status: 404, headers: corsHeaders });
    }

    if (!amb.email) {
      return new Response(JSON.stringify({ error: "Ambassador has no email address" }), { status: 400, headers: corsHeaders });
    }

    // Check if auth user already exists for this ambassador
    if (amb.auth_user_id) {
      return new Response(JSON.stringify({ success: true, message: "Auth user already exists", auth_user_id: amb.auth_user_id }), { headers: corsHeaders });
    }

    // Check if an auth user with this email already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === amb.email);

    let authUserId: string;

    if (existingUser) {
      authUserId = existingUser.id;
    } else {
      // Create auth user with a random password (they'll set their own via email)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: amb.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: amb.full_name, role: "ambassador" },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: `Failed to create auth user: ${createErr.message}` }), { status: 500, headers: corsHeaders });
      }
      authUserId = newUser.user.id;
    }

    // Link auth user to ambassador record
    const { error: updateErr } = await admin
      .from("unforgettable_ambassadors")
      .update({
        auth_user_id: authUserId,
        status: "active",
        approved_at: new Date().toISOString(),
      })
      .eq("id", ambassador_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: `Failed to link user: ${updateErr.message}` }), { status: 500, headers: corsHeaders });
    }

    // Ensure profile exists
    await admin.from("profiles").upsert({
      id: authUserId,
      name: amb.full_name,
      email: amb.email,
      primary_role: "ambassador",
    }, { onConflict: "id" });

    // Ensure user_roles entry
    await admin.from("user_roles").upsert({
      user_id: authUserId,
      role: "ambassador",
    }, { onConflict: "user_id,role" }).select();

    // Get the site URL for the password reset redirect
    const siteUrl = Deno.env.get("SITE_URL") || "https://gasmask-os-nexus.lovable.app";

    // Send password reset email so ambassador can set their password
    const { error: resetErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: amb.email,
      options: {
        redirectTo: `${siteUrl}/ambassador/set-password`,
      },
    });

    // Even if reset email fails, the user is created
    const emailSent = !resetErr;

    // Also try sending via the standard method as backup
    if (resetErr) {
      await admin.auth.resetPasswordForEmail(amb.email, {
        redirectTo: `${siteUrl}/ambassador/set-password`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      auth_user_id: authUserId,
      email_sent: emailSent,
      message: `Auth user created for ${amb.email}. Password setup email sent.`,
    }), { headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
