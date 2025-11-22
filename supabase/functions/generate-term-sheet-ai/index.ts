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

    const { application_id } = await req.json();

    console.log(`Generating term sheet for application: ${application_id}`);

    // Fetch application details
    const { data: application, error: appError } = await supabase
      .from("lender_applications")
      .select(`
        *,
        lenders(*),
        loan_products(*),
        leads_raw(address, city, state, zip_code)
      `)
      .eq("id", application_id)
      .single();

    if (appError) throw appError;

    const termSheetNumber = `TS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const propertyAddress = `${application.leads_raw.address}, ${application.leads_raw.city}, ${application.leads_raw.state} ${application.leads_raw.zip_code}`;

    // Generate term sheet content using AI
    const termSheetPrompt = `Generate a professional loan term sheet with these details:

LENDER: ${application.lenders.lender_name}
BORROWER: ${application.borrower_name}
PROPERTY: ${propertyAddress}

LOAN DETAILS:
- Loan Amount: $${application.loan_amount.toLocaleString()}
- Interest Rate: ${application.loan_products?.interest_rate_min || 10}% - ${application.loan_products?.interest_rate_max || 12}%
- Origination Points: ${application.loan_products?.origination_points || 2}
- Term: ${application.loan_products?.term_months || 12} months
- LTV: ${application.ltv}%
- DSCR: ${application.dscr || 'N/A'}
- Purpose: ${application.loan_purpose}

PROPERTY DETAILS:
- Purchase Price: $${application.purchase_price?.toLocaleString() || 'N/A'}
- Property Value: $${application.property_value?.toLocaleString() || 'N/A'}
- ARV: $${application.arv?.toLocaleString() || 'N/A'}
- Rehab Budget: $${application.rehab_budget?.toLocaleString() || 0}

Generate a complete, professional term sheet including:
1. Loan Summary
2. Property Information
3. Borrower Information
4. Loan Terms & Conditions
5. Fees & Costs
6. Requirements & Conditions
7. Timeline & Next Steps

Format professionally as a formal document.`;

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
            content: 'You are a commercial lending officer creating professional loan term sheets.'
          },
          {
            role: 'user',
            content: termSheetPrompt
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const termSheetContent = aiData.choices[0].message.content;

    // Create term sheet record
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // 30 days to accept

    const { data: termSheet, error: termSheetError } = await supabase
      .from("term_sheets")
      .insert([{
        application_id,
        term_sheet_number: termSheetNumber,
        lender_id: application.lender_id,
        borrower_name: application.borrower_name,
        property_address: propertyAddress,
        loan_amount: application.loan_amount,
        interest_rate: application.loan_products?.interest_rate_min || 10,
        origination_points: application.loan_products?.origination_points || 2,
        term_months: application.loan_products?.term_months || 12,
        ltv: application.ltv,
        dscr: application.dscr,
        expiration_date: expirationDate.toISOString().split('T')[0],
        status: 'draft',
      }])
      .select()
      .single();

    if (termSheetError) throw termSheetError;

    return new Response(
      JSON.stringify({
        success: true,
        term_sheet_id: termSheet.id,
        term_sheet_number: termSheetNumber,
        content: termSheetContent,
        expiration_date: expirationDate.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating term sheet:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
