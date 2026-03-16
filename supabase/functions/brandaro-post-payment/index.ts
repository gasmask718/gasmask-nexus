import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { proposal_id, payment_amount, stripe_checkout_id, stripe_customer_id } = await req.json();

    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get proposal details
    const { data: proposal, error: pErr } = await supabase
      .from("brandaro_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();
    if (pErr || !proposal) throw new Error("Proposal not found");

    // 2. Update proposal to paid
    await supabase.from("brandaro_proposals").update({
      status: "accepted",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_amount: payment_amount || proposal.total_price,
      stripe_checkout_id: stripe_checkout_id || null,
      accepted_at: new Date().toISOString(),
    }).eq("id", proposal_id);

    // 3. Get lead info
    const { data: lead } = await supabase
      .from("brandaro_qualified_leads")
      .select("*")
      .eq("id", proposal.lead_id)
      .single();

    // 4. Create client record
    const { data: client, error: cErr } = await supabase
      .from("brandaro_clients")
      .insert({
        business_name: lead?.business_name || "Unknown Business",
        owner_name: lead?.owner_name || null,
        phone: lead?.phone || null,
        email: lead?.email || null,
        package_chosen: proposal.package_tier,
        website_package_price: proposal.base_price,
        monthly_recurring: 0,
        client_status: "active",
        onboarding_status: "pending",
        maintenance_status: "pending",
        proposal_id: proposal_id,
        lead_id: proposal.lead_id,
        onboarding_checklist: JSON.stringify([
          { step: "welcome_call", label: "Welcome Call", done: false },
          { step: "content_gathering", label: "Gather Content & Assets", done: false },
          { step: "design_brief", label: "Design Brief Approval", done: false },
          { step: "draft_review", label: "Draft Review", done: false },
          { step: "final_approval", label: "Final Approval", done: false },
          { step: "launch", label: "Website Launch", done: false },
        ]),
        portal_access_enabled: true,
      })
      .select()
      .single();
    if (cErr) throw cErr;

    // 5. Create project record
    const { data: project } = await supabase
      .from("brandaro_projects")
      .insert({
        client_id: client.id,
        project_name: `${lead?.business_name || "Client"} Website`,
        package_tier: proposal.package_tier,
        build_status: "onboarding",
        hosting_status: "pending",
        ssl_status: "pending",
        assigned_builder: null,
      })
      .select()
      .single();

    // 6. Create maintenance subscription if addons include it
    const addons = proposal.addons || [];
    const maintenanceAddon = addons.find((a: any) => a.id === "maintenance" || a.name?.includes("Maintenance"));
    if (maintenanceAddon) {
      await supabase.from("brandaro_subscriptions").insert({
        client_id: client.id,
        service_type: "maintenance",
        monthly_fee: maintenanceAddon.price || 150,
        status: "active",
        started_at: new Date().toISOString(),
        stripe_customer_id: stripe_customer_id || null,
      });

      // Update client MRR
      await supabase.from("brandaro_clients")
        .update({ 
          monthly_recurring: maintenanceAddon.price || 150,
          maintenance_status: "active",
        })
        .eq("id", client.id);
    }

    // 7. Create initial tasks
    const taskTypes = ["homepage_copy", "services_page", "seo_optimization", "contact_form_setup"];
    for (const taskType of taskTypes) {
      await supabase.from("brandaro_tasks").insert({
        task_type: taskType,
        client_id: client.id,
        project_id: project?.id,
        lead_id: proposal.lead_id,
        assigned_to: "human",
        review_status: "pending",
      });
    }

    // 8. Update lead status to sold
    if (proposal.lead_id) {
      await supabase.from("brandaro_qualified_leads")
        .update({ lead_status: "sold", proposal_status: "accepted" })
        .eq("id", proposal.lead_id);
    }

    return new Response(JSON.stringify({
      ok: true,
      client_id: client.id,
      project_id: project?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Post-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
