import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brandaro package price IDs
const PACKAGE_PRICES: Record<string, string> = {
  starter: "price_1TByikLhpzgs5Jby9PES3Igr",
  professional: "price_1TByjFLhpzgs5Jby5uzBDPkZ",
  premium: "price_1TByn9Lhpzgs5JbybhVwfvkb",
  elite: "price_1TByncLhpzgs5JbyLvBISr6J",
};

const MAINTENANCE_PRICE = "price_1TByoDLhpzgs5Jby2twL0566";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposal_id, include_maintenance } = await req.json();
    if (!proposal_id) throw new Error("proposal_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get proposal
    const { data: proposal, error: pErr } = await supabase
      .from("brandaro_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();
    if (pErr || !proposal) throw new Error("Proposal not found");

    // Get lead info for email
    const { data: lead } = await supabase
      .from("brandaro_qualified_leads")
      .select("email, business_name, phone")
      .eq("id", proposal.lead_id)
      .single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Build line items
    const lineItems: any[] = [];
    
    // Website package
    const priceId = PACKAGE_PRICES[proposal.package_tier];
    if (priceId) {
      lineItems.push({ price: priceId, quantity: 1 });
    } else {
      // Fallback: use price_data for custom amounts
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `${proposal.package_tier} Website Package` },
          unit_amount: Math.round((proposal.base_price || 750) * 100),
        },
        quantity: 1,
      });
    }

    // Check if proposal addons include maintenance
    const addons = proposal.addons || [];
    const hasMaintenance = include_maintenance || addons.some((a: any) => 
      a.id === "maintenance" || a.name?.toLowerCase().includes("maintenance")
    );

    // Create checkout session (payment mode for one-time website build)
    const origin = req.headers.get("origin") || "https://gasmask-os-nexus.lovable.app";
    
    const sessionConfig: any = {
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/proposal/${proposal.tracking_token}?paid=true`,
      cancel_url: `${origin}/proposal/${proposal.tracking_token}?cancelled=true`,
      metadata: {
        proposal_id: proposal.id,
        lead_id: proposal.lead_id,
        package_tier: proposal.package_tier,
        include_maintenance: hasMaintenance ? "true" : "false",
      },
    };

    // Set customer email if available
    if (lead?.email) {
      const customers = await stripe.customers.list({ email: lead.email, limit: 1 });
      if (customers.data.length > 0) {
        sessionConfig.customer = customers.data[0].id;
      } else {
        sessionConfig.customer_email = lead.email;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Update proposal with Stripe session info
    await supabase.from("brandaro_proposals").update({
      stripe_checkout_id: session.id,
      stripe_session_url: session.url,
      status: "checkout_started",
    }).eq("id", proposal_id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Brandaro checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
