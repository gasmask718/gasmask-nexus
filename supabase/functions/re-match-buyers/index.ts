import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MatchInput {
  property_id?: string;
  state: string;
  city: string;
  property_type: string;
  arv_estimate: number;
  repair_estimate: number;
  asking_price: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as MatchInput;
    const { state, city, property_type, arv_estimate, repair_estimate, asking_price, property_id } = body;

    const { data: buyers, error } = await supabase
      .from("re_buyers")
      .select("id, name, company, email, phone, status, re_buyer_criteria(states, cities, property_types, min_beds, max_price, min_arv, max_arv, condition_acceptable, max_repair_cost, active)")
      .or("status.eq.active,status.is.null");
    if (error) throw error;

    const scored = (buyers ?? []).map((b: any) => {
      const crit = (b.re_buyer_criteria ?? []).find((c: any) => c.active) ?? (b.re_buyer_criteria ?? [])[0];
      let score = 0;
      let maxScore = 0;

      if (crit) {
        if (crit.states?.length) { maxScore++; if (crit.states.includes(state)) score++; }
        if (crit.cities?.length) {
          maxScore++;
          if (crit.cities.some((c: string) => (city ?? "").toLowerCase().includes(c.toLowerCase()))) score++;
        }
        if (crit.property_types?.length) {
          maxScore++;
          if (crit.property_types.includes((property_type ?? "").toLowerCase())) score++;
        }
        if (crit.max_price != null) { maxScore++; if (asking_price <= Number(crit.max_price)) score++; }
        if (crit.min_arv != null || crit.max_arv != null) {
          maxScore++;
          const okMin = crit.min_arv == null || arv_estimate >= Number(crit.min_arv);
          const okMax = crit.max_arv == null || arv_estimate <= Number(crit.max_arv);
          if (okMin && okMax) score++;
        }
        if (crit.max_repair_cost != null) {
          maxScore++;
          if (repair_estimate <= Number(crit.max_repair_cost)) score++;
        }
      }

      if (maxScore === 0) { score = 3; maxScore = 6; }

      return {
        id: b.id,
        name: b.name,
        company: b.company,
        email: b.email,
        phone: b.phone,
        match_score: score,
        max_score: maxScore,
        match_pct: Math.round((score / Math.max(maxScore, 1)) * 100),
      };
    });

    scored.sort((a, b) => b.match_pct - a.match_pct || b.match_score - a.match_score);

    return new Response(
      JSON.stringify({
        success: true,
        matches: scored.slice(0, 10),
        total_buyers_checked: scored.length,
        property_id: property_id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
