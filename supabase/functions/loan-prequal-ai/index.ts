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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, borrower_credit_score, monthly_income } = await req.json();

    console.log(`Pre-qualifying loan for lead: ${lead_id}`);

    // Fetch lead and comps
    const { data: lead, error: leadError } = await supabase
      .from("leads_raw")
      .select("*, ai_comps(*)")
      .eq("id", lead_id)
      .single();

    if (leadError) throw leadError;

    const comps = lead.ai_comps?.[0];
    if (!comps) throw new Error("No comps available");

    // Calculate key metrics
    const purchasePrice = comps.offer_price || lead.estimated_value;
    const arv = comps.arv || comps.resale_price;
    const rehabBudget = comps.repair_cost || 0;
    const totalCost = purchasePrice + rehabBudget;
    
    // Estimate monthly rent (typically 1% of ARV for rough calc)
    const monthlyRent = arv * 0.01;
    const monthlyExpenses = monthlyRent * 0.35; // 35% operating expenses
    const noi = (monthlyRent - monthlyExpenses) * 12;
    
    // Calculate DSCR assuming 75% LTV at 10% rate
    const estimatedLoan = arv * 0.75;
    const annualDebtService = estimatedLoan * 0.10;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
    
    const ltv = (estimatedLoan / arv) * 100;
    const loanToCost = (estimatedLoan / totalCost) * 100;
    const capRate = (noi / arv) * 100;

    // Fetch qualifying loan products
    const { data: products, error: productsError } = await supabase
      .from("loan_products")
      .select("*, lenders(*)")
      .eq("is_active", true)
      .lte("min_loan", estimatedLoan)
      .gte("max_loan", estimatedLoan)
      .gte("max_ltv", ltv);

    if (productsError) throw productsError;

    // Filter by credit score and DSCR
    const qualifyingProducts = products?.filter(p => {
      const creditMatch = !p.min_credit_score || (borrower_credit_score >= p.min_credit_score);
      const dscrMatch = !p.min_dscr || (dscr >= p.min_dscr);
      return creditMatch && dscrMatch;
    }) || [];

    // Use AI to analyze and recommend
    const analysisPrompt = `Analyze this real estate investment opportunity and recommend the best financing strategy:

Property Details:
- Purchase Price: $${purchasePrice.toLocaleString()}
- ARV (After Repair Value): $${arv.toLocaleString()}
- Rehab Budget: $${rehabBudget.toLocaleString()}
- Total Cost: $${totalCost.toLocaleString()}

Financial Metrics:
- Estimated Monthly Rent: $${monthlyRent.toLocaleString()}
- Net Operating Income: $${noi.toLocaleString()}/year
- DSCR: ${dscr.toFixed(2)}
- LTV: ${ltv.toFixed(1)}%
- Loan-to-Cost: ${loanToCost.toFixed(1)}%
- Cap Rate: ${capRate.toFixed(2)}%

Borrower Profile:
- Credit Score: ${borrower_credit_score}
- Monthly Income: $${monthly_income?.toLocaleString() || 'Not provided'}

Qualifying Loan Products: ${qualifyingProducts.length}

Recommend:
1. Best strategy: Wholesale, Fix-and-Flip, Buy-and-Hold, or BRRRR?
2. Which loan product type is optimal?
3. Maximum allowable loan amount
4. Key underwriting considerations
5. Risk factors

Format as actionable insights.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a commercial loan officer specializing in real estate investment financing.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    // Determine recommended strategy
    let recommendedStrategy = 'wholesale';
    if (dscr >= 1.25 && capRate >= 8) {
      recommendedStrategy = 'buy_and_hold';
    } else if (rehabBudget > 30000 && arv > purchasePrice * 1.3) {
      recommendedStrategy = 'fix_and_flip';
    } else if (dscr >= 1.0 && rehabBudget > 0) {
      recommendedStrategy = 'brrrr';
    }

    // Store analysis
    const { data: analysisRecord, error: analysisError } = await supabase
      .from("loan_analysis")
      .insert([{
        lead_id,
        property_value: arv,
        purchase_price: purchasePrice,
        rehab_budget: rehabBudget,
        arv,
        monthly_rent: monthlyRent,
        monthly_expenses: monthlyExpenses,
        dscr,
        ltv,
        loan_to_cost: loanToCost,
        cap_rate: capRate,
        max_allowable_loan: estimatedLoan,
        recommended_strategy: recommendedStrategy,
        qualifying_products: qualifyingProducts.map(p => ({ id: p.id, name: p.product_name, lender: p.lenders.lender_name })),
        ai_analysis: analysis,
      }])
      .select()
      .single();

    if (analysisError) throw analysisError;

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          dscr,
          ltv,
          loan_to_cost: loanToCost,
          cap_rate: capRate,
          max_allowable_loan: estimatedLoan,
          monthly_rent: monthlyRent,
          noi,
        },
        recommended_strategy: recommendedStrategy,
        qualifying_products: qualifyingProducts,
        ai_analysis: analysis,
        analysis_id: analysisRecord.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in loan pre-qualification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
