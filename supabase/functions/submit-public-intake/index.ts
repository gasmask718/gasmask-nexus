// Public endpoint — no JWT required. Validates an intake token from
// va_intake_invites, inserts a new lead assigned to the inviting VA,
// and marks the invite as submitted. Storage uploads happen client-side
// against the public va-lead-intake bucket policy.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubmitBody {
  token?: string | null;
  form: Record<string, any>;
  uploadedFiles?: Array<{ name: string; url: string; size: number; type: string; category: string }>;
  scopeAccepted?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as SubmitBody;
    if (!body.scopeAccepted) {
      return new Response(JSON.stringify({ error: "Scope agreement required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const f = body.form || {};
    if (!f.businessName || typeof f.businessName !== "string") {
      return new Response(JSON.stringify({ error: "Business name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate invite only if a token was provided (token-gated flow).
    // When no token is present, treat this as an open public intake.
    let invite: { id: string; va_id: string | null; submitted_at: string | null } | null = null;
    if (body.token && typeof body.token === "string") {
      const { data: inv, error: invErr } = await supabase
        .from("va_intake_invites")
        .select("id, va_id, submitted_at")
        .eq("token", body.token)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!inv) {
        return new Response(JSON.stringify({ error: "Invalid intake link" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (inv.submitted_at) {
        return new Response(JSON.stringify({ error: "This intake has already been submitted." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      invite = inv as any;
    }

    const integrations: string[] = Array.isArray(f.integrations) ? f.integrations : [];
    const finalIntegrations = integrations.includes("Other") && f.otherIntegration
      ? [...integrations.filter((i) => i !== "Other"), `Other: ${String(f.otherIntegration).trim()}`]
      : integrations;

    const intakePayload = {
      form_type: "brandaro_public_intake",
      submitted_at: new Date().toISOString(),
      invite_id: invite.id,
      contact: {
        businessName: f.businessName, ownerName: f.ownerName, email: f.email, phone: f.phone, city: f.city,
        businessType: f.businessType, yearsInBusiness: f.yearsInBusiness, teamSize: f.teamSize,
        hoursOfOperation: f.hoursOfOperation, serviceRadius: f.serviceRadius,
        existingWebsite: f.existingWebsite, socialMedia: f.socialMedia,
      },
      vision: { primaryGoal: f.primaryGoal, currentFrustration: f.currentFrustration },
      market: { idealCustomer: f.idealCustomer, valueProposition: f.valueProposition, competitors: f.competitors, brandAdjectives: f.brandAdjectives },
      conversion: { primaryCta: f.primaryCta, services: f.services, servicePackages: f.servicePackages, pagesNeeded: f.pagesNeeded, integrations: finalIntegrations },
      creative: { ownsDomain: f.ownsDomain, copywritingPreference: f.copywritingPreference, mediaNeeds: f.mediaNeeds, designInspiration: f.designInspiration, themePreference: f.themePreference, brandColors: f.brandColors, needsLogo: f.needsLogo === "Yes", logoPackage: f.logoPackage },
      scope: { launchDateReason: f.launchDateReason, budgetRange: f.budgetRange, supportPreference: f.supportPreference },
      notes: f.message,
      uploadedFiles: body.uploadedFiles ?? [],
      scopeAccepted: true,
    };

    const callNotes = `[Public Brandaro Intake]\n${JSON.stringify(intakePayload, null, 2)}`;

    const { data: lead, error: leadErr } = await supabase
      .from("brandaro_qualified_leads")
      .insert({
        business_name: f.businessName,
        phone_number: f.phone || null,
        city: f.city || null,
        industry: f.businessType || null,
        assigned_va: invite.va_id,
        lead_status: "new",
        source: "public_intake",
        call_notes: callNotes,
        service_interest: f.services || null,
        website_status: f.existingWebsite ? "has_site" : "unknown",
        pipeline_stage: "new",
      })
      .select("id")
      .single();
    if (leadErr) throw leadErr;

    await supabase
      .from("va_intake_invites")
      .update({ submitted_at: new Date().toISOString(), status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("submit-public-intake error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
