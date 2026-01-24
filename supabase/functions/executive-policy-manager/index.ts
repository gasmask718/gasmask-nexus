import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PolicyRequest {
  action: 'create' | 'sign' | 'suspend' | 'revoke' | 'list' | 'get';
  policy_id?: string;
  business_id?: string;
  policy_data?: {
    policy_name: string;
    policy_scope: string;
    description?: string;
    allowed_actions: string[];
    forbidden_actions: string[];
    approval_required_for: string[];
    risk_classification: string;
    jurisdiction_constraints?: Record<string, unknown>;
    brand_voice_constraints?: Record<string, unknown>;
    max_contact_rate?: number;
    max_contacts_per_day?: number;
    cooldown_rules?: Record<string, unknown>;
    escalation_conditions?: Record<string, unknown>;
    rollback_triggers?: Record<string, unknown>;
    expires_at?: string;
  };
  signature_notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PolicyRequest = await req.json();
    const { action, policy_id, business_id, policy_data, signature_notes } = body;

    let result: unknown;

    switch (action) {
      case 'create': {
        if (!policy_data || !business_id) {
          throw new Error("Policy data and business_id required");
        }

        const { data: policy, error: createError } = await supabase
          .from("executive_policies")
          .insert({
            business_id,
            ...policy_data,
            status: 'draft',
            created_by: user.id,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Log policy creation
        await supabase.from("policy_signing_log").insert({
          policy_id: policy.id,
          action: 'created',
          actor_user_id: user.id,
          signature_payload: { policy_name: policy_data.policy_name, scope: policy_data.policy_scope },
          signature_hash: crypto.randomUUID(), // Placeholder for real signature
          notes: 'Policy draft created',
        });

        result = { success: true, policy };
        break;
      }

      case 'sign': {
        if (!policy_id) throw new Error("Policy ID required");

        // Get current policy
        const { data: currentPolicy, error: fetchError } = await supabase
          .from("executive_policies")
          .select("*")
          .eq("id", policy_id)
          .single();

        if (fetchError) throw fetchError;
        if (currentPolicy.status !== 'draft' && currentPolicy.status !== 'pending_approval') {
          throw new Error("Policy must be in draft or pending_approval status to sign");
        }

        // Generate cryptographic signature
        const signaturePayload = {
          policy_id,
          policy_name: currentPolicy.policy_name,
          policy_scope: currentPolicy.policy_scope,
          signed_by: user.id,
          signed_at: new Date().toISOString(),
          allowed_actions: currentPolicy.allowed_actions,
          forbidden_actions: currentPolicy.forbidden_actions,
        };

        const signatureHash = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(signaturePayload))
        ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

        // Update policy to active
        const { data: signedPolicy, error: signError } = await supabase
          .from("executive_policies")
          .update({
            status: 'active',
            signed_by: user.id,
            signed_at: new Date().toISOString(),
            signature_hash: signatureHash,
          })
          .eq("id", policy_id)
          .select()
          .single();

        if (signError) throw signError;

        // Log signing ceremony
        await supabase.from("policy_signing_log").insert({
          policy_id,
          action: 'approved',
          actor_user_id: user.id,
          signature_payload: signaturePayload,
          signature_hash: signatureHash,
          notes: signature_notes || 'Policy signed and activated',
        });

        result = { success: true, policy: signedPolicy, signature_hash: signatureHash };
        break;
      }

      case 'suspend': {
        if (!policy_id) throw new Error("Policy ID required");

        const { data: suspended, error: suspendError } = await supabase
          .from("executive_policies")
          .update({ status: 'suspended' })
          .eq("id", policy_id)
          .select()
          .single();

        if (suspendError) throw suspendError;

        await supabase.from("policy_signing_log").insert({
          policy_id,
          action: 'suspended',
          actor_user_id: user.id,
          signature_payload: { reason: signature_notes },
          signature_hash: crypto.randomUUID(),
          notes: signature_notes || 'Policy suspended',
        });

        result = { success: true, policy: suspended };
        break;
      }

      case 'revoke': {
        if (!policy_id) throw new Error("Policy ID required");

        const { data: revoked, error: revokeError } = await supabase
          .from("executive_policies")
          .update({ status: 'revoked' })
          .eq("id", policy_id)
          .select()
          .single();

        if (revokeError) throw revokeError;

        await supabase.from("policy_signing_log").insert({
          policy_id,
          action: 'revoked',
          actor_user_id: user.id,
          signature_payload: { reason: signature_notes },
          signature_hash: crypto.randomUUID(),
          notes: signature_notes || 'Policy permanently revoked',
        });

        result = { success: true, policy: revoked };
        break;
      }

      case 'list': {
        const query = supabase
          .from("executive_policies")
          .select("*")
          .order("created_at", { ascending: false });

        if (business_id) {
          query.eq("business_id", business_id);
        }

        const { data: policies, error: listError } = await query;
        if (listError) throw listError;

        result = { success: true, policies };
        break;
      }

      case 'get': {
        if (!policy_id) throw new Error("Policy ID required");

        const { data: policy, error: getError } = await supabase
          .from("executive_policies")
          .select(`
            *,
            signing_log:policy_signing_log(*)
          `)
          .eq("id", policy_id)
          .single();

        if (getError) throw getError;

        result = { success: true, policy };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Executive Policy Manager error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
