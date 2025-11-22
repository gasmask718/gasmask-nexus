import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, loan_amount, loan_purpose, borrower_info } = await req.json();

    console.log(`Auto-sending loan package for lead: ${lead_id}`);

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*), loan_analysis(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const analysis = lead.loan_analysis?.[0];
    if (!analysis) throw new Error("No loan analysis available. Run pre-qualification first.");

    // Find matching lenders
    const { data: products, error: productsError } = await supabase
      .from("loan_products")
      .select("*, lenders(*)")
      .eq("is_active", true)
      .lte("min_loan", loan_amount)
      .gte("max_loan", loan_amount)
      .contains("states_available", [lead.state]);

    if (productsError) throw productsError;

    // Score and rank lenders
    const rankedProducts = products?.map(p => {
      let score = 0;
      
      // Prefer lower rates
      score += (15 - p.interest_rate_min) * 2;
      
      // Prefer higher LTV
      score += p.max_ltv;
      
      // Prefer faster close times
      if (p.lenders.speed_to_close_days) {
        score += (60 - p.lenders.speed_to_close_days) / 2;
      }
      
      // Prefer lenders with good ratings
      if (p.lenders.rating) {
        score += p.lenders.rating * 5;
      }
      
      return { ...p, match_score: score };
    }).sort((a, b) => b.match_score - a.match_score) || [];

    // Submit to top 5 lenders
    const topLenders = rankedProducts.slice(0, 5);
    const applications = [];

    for (const product of topLenders) {
      const { data: application, error: appError } = await supabase
        .from("lender_applications")
        .insert([{
          lead_id,
          lender_id: product.lenders.id,
          product_id: product.id,
          loan_amount,
          loan_purpose,
          property_value: analysis.arv,
          purchase_price: analysis.purchase_price,
          rehab_budget: analysis.rehab_budget,
          arv: analysis.arv,
          ltv: analysis.ltv,
          loan_to_cost: analysis.loan_to_cost,
          dscr: analysis.dscr,
          monthly_rent: analysis.monthly_rent,
          borrower_name: borrower_info.name,
          borrower_email: borrower_info.email,
          borrower_phone: borrower_info.phone,
          borrower_credit_score: borrower_info.credit_score,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (!appError) {
        applications.push(application);
        
        // Create notification
        await supabase
          .from("real_estate_notifications")
          .insert([{
            notification_type: 'new_motivated_seller',
            entity_type: 'lead',
            entity_id: lead_id,
            title: 'Loan Package Submitted',
            message: `Loan application submitted to ${product.lenders.lender_name}`,
            priority: 'normal',
          }]);
      }
    }

    console.log(`Loan package sent to ${applications.length} lenders`);

    return new Response(
      JSON.stringify({
        success: true,
        applications_created: applications.length,
        lenders_contacted: applications.map(a => ({
          lender: topLenders.find(l => l.lenders.id === a.lender_id)?.lenders.lender_name,
          application_id: a.id,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error auto-sending loan package:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
