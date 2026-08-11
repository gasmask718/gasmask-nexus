// Dynasty Direct — provision / transfer a wholesaler portal account.
//
// actions:
//   provision  -> create auth user + profile + wholesaler role + wholesaler_profiles row
//   transfer   -> reassign an existing wholesaler_profiles row to a different login
//                 (product history stays attached to wholesaler_profiles.id)
//
// Auth: caller must be an admin (Bearer JWT) OR present x-provision-secret
// matching DD_PROVISION_SECRET (bootstrap / ops path).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-provision-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isEmail = (v: unknown): v is string =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function genPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "!7";
}

async function findUserByEmail(admin: any, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if ((data?.users ?? []).length < 200) return null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- authorize -----------------------------------------------------------
  const provisionSecret = Deno.env.get("DD_PROVISION_SECRET");
  const presented = req.headers.get("x-provision-secret");
  let actorId: string | null = null;
  let authorized = false;

  if (provisionSecret && presented && presented === provisionSecret) {
    authorized = true;
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    actorId = userRes.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: actorId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
    authorized = true;
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body?.action ?? "provision";

  // ---- provision -----------------------------------------------------------
  if (action === "provision") {
    const email = body?.email;
    const companyName = typeof body?.company_name === "string" ? body.company_name.trim() : "";
    if (!isEmail(email)) return json({ error: "Valid email required" }, 400);
    if (!companyName) return json({ error: "company_name required" }, 400);

    const password: string =
      typeof body?.password === "string" && body.password.length >= 10
        ? body.password
        : genPassword();
    const generated = !(typeof body?.password === "string" && body.password.length >= 10);

    let userId = await findUserByEmail(admin, email);
    if (userId) {
      // Idempotent: reset the password so the credentials handed over always work.
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: body?.contact_name ?? companyName, role: "wholesaler" },
      });
      if (createErr || !created?.user) {
        console.error("[dd-provision-wholesaler] createUser failed", createErr);
        return json({ error: createErr?.message ?? "Could not create login" }, 500);
      }
      userId = created.user.id;
    }

    await admin.from("profiles").upsert(
      {
        id: userId,
        name: body?.contact_name ?? companyName,
        email,
        role: "wholesaler",
      },
      { onConflict: "id" },
    );

    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "wholesaler" }, { onConflict: "user_id,role" });

    // Reuse an existing profile for this login if present, otherwise create it.
    const { data: existingProfile } = await admin
      .from("wholesaler_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let wholesalerProfileId = existingProfile?.id ?? null;
    if (wholesalerProfileId) {
      await admin
        .from("wholesaler_profiles")
        .update({
          company_name: companyName,
          contact_name: body?.contact_name ?? null,
          email,
          phone: body?.phone ?? null,
          status: "verified",
        })
        .eq("id", wholesalerProfileId);
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("wholesaler_profiles")
        .insert({
          user_id: userId,
          company_name: companyName,
          contact_name: body?.contact_name ?? null,
          email,
          phone: body?.phone ?? null,
          status: "verified",
          wholesaler_type: body?.wholesaler_type ?? "distributor",
          notes: body?.notes ?? null,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("[dd-provision-wholesaler] profile insert failed", insErr);
        return json({ error: insErr.message }, 500);
      }
      wholesalerProfileId = inserted.id;
    }

    return json({
      success: true,
      action: "provision",
      user_id: userId,
      wholesaler_profile_id: wholesalerProfileId,
      email,
      password: generated ? password : undefined,
      login_url: "/auth",
      onboard_url: "/portal/wholesaler/catalog/onboard",
    });
  }

  // ---- transfer ------------------------------------------------------------
  if (action === "transfer") {
    const profileId = body?.wholesaler_profile_id;
    const newEmail = body?.new_email;
    if (!isUuid(profileId)) return json({ error: "wholesaler_profile_id (uuid) required" }, 400);
    if (!isEmail(newEmail)) return json({ error: "new_email required" }, 400);

    const { data: profile, error: pErr } = await admin
      .from("wholesaler_profiles")
      .select("id, user_id, company_name")
      .eq("id", profileId)
      .maybeSingle();
    if (pErr) return json({ error: pErr.message }, 500);
    if (!profile) return json({ error: "Wholesaler profile not found" }, 404);

    const oldUserId = profile.user_id;

    let newUserId = await findUserByEmail(admin, newEmail);
    let tempPassword: string | undefined;
    if (!newUserId) {
      tempPassword = typeof body?.password === "string" && body.password.length >= 10
        ? body.password
        : genPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: newEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: body?.contact_name ?? profile.company_name, role: "wholesaler" },
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message ?? "Could not create login" }, 500);
      }
      newUserId = created.user.id;
    }

    await admin.from("profiles").upsert(
      {
        id: newUserId,
        name: body?.contact_name ?? profile.company_name,
        email: newEmail,
        role: "wholesaler",
      },
      { onConflict: "id" },
    );
    await admin
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "wholesaler" }, { onConflict: "user_id,role" });

    const patch: Record<string, unknown> = { user_id: newUserId, email: newEmail };
    if (typeof body?.company_name === "string" && body.company_name.trim()) {
      patch.company_name = body.company_name.trim();
    }
    if (typeof body?.contact_name === "string") patch.contact_name = body.contact_name;
    if (typeof body?.phone === "string") patch.phone = body.phone;

    const { error: updErr } = await admin
      .from("wholesaler_profiles")
      .update(patch)
      .eq("id", profileId);
    if (updErr) return json({ error: updErr.message }, 500);

    // Optionally strip the wholesaler role from the caretaker login.
    if (body?.revoke_old_role === true && oldUserId && oldUserId !== newUserId) {
      await admin.from("user_roles").delete().eq("user_id", oldUserId).eq("role", "wholesaler");
    }

    return json({
      success: true,
      action: "transfer",
      wholesaler_profile_id: profileId,
      previous_user_id: oldUserId,
      new_user_id: newUserId,
      new_email: newEmail,
      temp_password: tempPassword,
      note: "Products, drafts, orders and payouts stay attached to wholesaler_profile_id — nothing is re-keyed.",
    });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
