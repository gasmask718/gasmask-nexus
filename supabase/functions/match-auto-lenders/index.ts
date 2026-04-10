import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { credit_score, loan_amount, vehicle_age, vehicle_mileage, state } = await req.json();
    if (!credit_score) throw new Error("credit_score is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: lenders, error } = await supabase
      .from("auto_lenders")
      .select("*")
      .eq("active", true)
      .order("min_apr", { ascending: true });

    if (error) throw error;

    const qualifyNow = [];
    const qualifyWithAction = [];

    for (const lender of lenders || []) {
      const scoreOk = !lender.min_credit_score || credit_score >= lender.min_credit_score;
      const ageOk = !lender.max_vehicle_age_years || !vehicle_age || vehicle_age <= lender.max_vehicle_age_years;
      const mileageOk = !lender.max_vehicle_mileage || !vehicle_mileage || vehicle_mileage <= lender.max_vehicle_mileage;
      const amountOk = !loan_amount || (
        (!lender.min_loan_amount || loan_amount >= lender.min_loan_amount) &&
        (!lender.max_loan_amount || loan_amount <= lender.max_loan_amount)
      );

      if (scoreOk && ageOk && mileageOk && amountOk) {
        qualifyNow.push(lender);
      } else if (lender.min_credit_score && credit_score >= lender.min_credit_score - 100) {
        const actions = [];
        if (!scoreOk) actions.push(`Raise score ${lender.min_credit_score - credit_score} points to ${lender.min_credit_score}`);
        if (!ageOk) actions.push(`Vehicle must be ${lender.max_vehicle_age_years} years or newer`);
        if (!mileageOk) actions.push(`Vehicle must have under ${lender.max_vehicle_mileage?.toLocaleString()} miles`);
        qualifyWithAction.push({ ...lender, actions_needed: actions });
      }
    }

    return new Response(
      JSON.stringify({ qualify_now: qualifyNow, qualify_with_action: qualifyWithAction }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("match-auto-lenders error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
