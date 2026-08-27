import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findUserByEmail(admin: AdminClient, email: string) {
  const normalized = email.toLowerCase();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Targeted lookup first (avoids listing every user, which can fail at scale).
  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?per_page=50&filter=${encodeURIComponent(normalized)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (res.ok) {
      const payload = await res.json();
      const match = (payload.users ?? []).find(
        (candidate: { email?: string }) => candidate.email?.toLowerCase() === normalized,
      );
      if (match) return match;
    } else {
      console.error("admin users filter lookup failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("admin users filter lookup threw", err);
  }

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 200) break;
  }
  return null;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Backend is not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();

    if (!token) return json({ error: "Invite token is required" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    const { data: invitation, error: inviteError } = await admin
      .from("user_invitations")
      .select("id, email, role, invite_token, invite_status, expires_at, accepted_at, metadata")
      .eq("invite_token", token)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invitation) return json({ error: "Invite not found" }, 404);
    if (invitation.invite_status === "accepted" || invitation.accepted_at) {
      return json({ error: "This invitation has already been used" }, 410);
    }
    if (invitation.invite_status === "revoked") {
      return json({ error: "This invitation has been revoked" }, 410);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return json({ error: "This invitation has expired" }, 410);
    }

    const email = String(invitation.email).toLowerCase();
    const role = String(invitation.role);
    let userId: string | undefined;

    // The role comes from a server-verified invitation row, so it is passed as
    // app_metadata.provisioned_role. handle_new_user() ignores any client-supplied
    // user_metadata.role and only trusts app_metadata.provisioned_role.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
      app_metadata: { provisioned_role: role },
    });

    if (createError) {
      const existing = await findUserByEmail(admin, email);
      if (!existing) {
        console.error("admin createUser failed", createError);
        return json({ error: createError.message }, 500);
      }
      // Same-email adoption: the email is taken from the server-verified
      // invitation row (never from the client), so an existing auth user with
      // this exact normalized email is the invited person. Adopt it instead of
      // creating a second account. Any mismatch fails closed.
      if ((existing.email ?? "").toLowerCase() !== email) {
        return json({ error: "Account already exists. Please sign in to accept the invite." }, 409);
      }

      // Conflicting identity guard: an accepted invitation for this email that
      // resolved to a different auth user means the state is ambiguous.
      const { data: conflicting, error: conflictError } = await admin
        .from("user_invitations")
        .select("id, accepted_user_id")
        .eq("email", email)
        .eq("invite_status", "accepted")
        .not("accepted_user_id", "is", null)
        .neq("accepted_user_id", existing.id)
        .limit(1);
      if (conflictError) throw conflictError;
      if (conflicting && conflicting.length > 0) {
        return json({ error: "Conflicting account state. Contact an administrator." }, 409);
      }

      // Preserves the existing Google identity: only password/metadata change.
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {

          ...(existing.user_metadata ?? {}),
          ...(fullName ? { full_name: fullName } : {}),
        },
        app_metadata: {
          ...((existing as any).app_metadata ?? {}),
          provisioned_role: role,
        },
      });
      if (updateError) {
        console.error("admin updateUserById failed", updateError);
        return json({ error: updateError.message }, 500);
      }
      userId = existing.id;
    } else {
      userId = created.user?.id;
    }


    if (!userId) return json({ error: "Unable to create invited user" }, 500);

    const profileInsert = {
      user_id: userId,
      full_name: fullName || null,
      primary_role: role,
      preferred_language: "en",
    };

    const { error: profileError } = await admin
      .from("user_profiles")
      .upsert(profileInsert, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    if (role === "va") {
      const { error: vaProfileError } = await admin
        .from("va_profiles")
        .upsert({ user_id: userId, label: fullName || "VA" }, { onConflict: "user_id" });
      if (vaProfileError) throw vaProfileError;
    }

    const { error: acceptError } = await admin
      .from("user_invitations")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_user_id: userId,
        invite_status: "accepted",
      })
      .eq("invite_token", token);
    if (acceptError) throw acceptError;

    return json({ success: true, email, role, userId });
  } catch (error) {
    console.error("complete-user-invite error", error);
    const message = error instanceof Error ? error.message : "Failed to complete invite";
    return json({ error: message }, 500);
  }
});