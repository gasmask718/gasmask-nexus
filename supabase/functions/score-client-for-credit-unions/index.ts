import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://esm.sh/zod@3.25.76";

const QuerySchema = z.object({
  client_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let clientId: string;
    if (req.method === "GET") {
      const url = new URL(req.url);
      clientId = url.searchParams.get("client_id") || "";
    } else {
      const body = await req.json();
      clientId = body.client_id;
    }

    const parsed = QuerySchema.safeParse({ client_id: clientId });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Valid client_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client data
    const { data: client, error: clientError } = await supabase
      .from("funding_clients")
      .select("id, full_name, first_name, last_name, credit_score_estimate, monthly_income, monthly_revenue")
      .eq("id", parsed.data.client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientScore = client.credit_score_estimate || 0;
    const clientIncome = client.monthly_income || client.monthly_revenue || 0;

    // Get all active products with credit union info
    const { data: products, error: prodError } = await supabase
      .from("credit_union_products")
      .select("*, credit_unions(*)")
      .eq("active", true)
      .order("approval_difficulty", { ascending: true });

    if (prodError) {
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const difficultyOrder: Record<string, number> = {
      very_easy: 1, easy: 2, moderate: 3, hard: 4, very_hard: 5,
    };

    // Qualify Now: client meets minimum score
    const qualifyNow = (products || [])
      .filter((p: any) => !p.min_credit_score || clientScore >= p.min_credit_score)
      .sort((a: any, b: any) => {
        const da = difficultyOrder[a.approval_difficulty] || 3;
        const db = difficultyOrder[b.approval_difficulty] || 3;
        if (da !== db) return da - db;
        return (b.max_loan_amount || 0) - (a.max_loan_amount || 0);
      });

    // Pathway: products within 100 points of client score
    const pathways = (products || [])
      .filter((p: any) => p.min_credit_score && clientScore < p.min_credit_score && clientScore + 100 >= p.min_credit_score)
      .map((p: any) => {
        const gap = p.min_credit_score - clientScore;
        const cu = p.credit_unions;
        return {
          ...p,
          score_gap: gap,
          action_required: `Raise score ${gap} points` +
            (cu?.third_party_membership_org ? ` + join ${cu.third_party_membership_org}` : "") +
            ` → qualify for ${p.product_name} up to $${(p.max_loan_amount || 0).toLocaleString()}`,
        };
      })
      .sort((a: any, b: any) => a.score_gap - b.score_gap);

    return new Response(JSON.stringify({
      client: {
        id: client.id,
        name: client.full_name || `${client.first_name} ${client.last_name}`,
        credit_score: clientScore,
        monthly_income: clientIncome,
      },
      qualify_now: qualifyNow,
      pathways,
      total_qualify_now: qualifyNow.length,
      total_pathways: pathways.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Scoring error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
