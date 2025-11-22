import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    console.log('💰 Starting AI Financial Analysis...');

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('customer_invoices')
      .select(`
        *,
        crm_customers(id, name, email, phone, business_type)
      `)
      .order('created_at', { ascending: false });

    if (invoicesError) throw invoicesError;

    // Fetch customer balances
    const { data: balances, error: balancesError } = await supabase
      .from('customer_balance')
      .select(`
        *,
        crm_customers(id, name, email, phone)
      `);

    if (balancesError) throw balancesError;

    // Fetch recent orders
    const { data: orders, error: ordersError } = await supabase
      .from('customer_orders')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    // Identify overdue invoices
    const overdueInvoices = invoices?.filter(inv => 
      inv.status !== 'paid' && 
      inv.due_date && 
      new Date(inv.due_date) < today
    ) || [];

    // Identify high-value customers
    const customerRevenue = new Map();
    invoices?.forEach(inv => {
      const customerId = inv.customer_id;
      if (inv.status === 'paid') {
        customerRevenue.set(
          customerId, 
          (customerRevenue.get(customerId) || 0) + Number(inv.total_amount || 0)
        );
      }
    });

    const highValueCustomers = Array.from(customerRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([customerId, revenue]) => {
        const customer = invoices?.find(i => i.customer_id === customerId)?.crm_customers;
        return {
          customerId,
          customerName: customer?.name || 'Unknown',
          totalRevenue: revenue,
        };
      });

    // Identify at-risk customers (outstanding balance > 30 days)
    const atRiskCustomers = balances?.filter(b => 
      Number(b.outstanding_balance || 0) > 0 &&
      b.last_invoice_date &&
      (today.getTime() - new Date(b.last_invoice_date).getTime()) > (30 * 24 * 60 * 60 * 1000)
    ).map(b => ({
      customerId: b.customer_id,
      customerName: b.crm_customers?.name || 'Unknown',
      outstandingBalance: Number(b.outstanding_balance),
      daysSinceLastInvoice: Math.floor(
        (today.getTime() - new Date(b.last_invoice_date).getTime()) / (24 * 60 * 60 * 1000)
      ),
    })) || [];

    // Call Lovable AI for predictions and recommendations
    const aiContext = `
Analyze this financial data:
- Total Invoices: ${invoices?.length || 0}
- Overdue Invoices: ${overdueInvoices.length}
- At-Risk Customers: ${atRiskCustomers.length}
- Top Customer Revenue: $${highValueCustomers[0]?.totalRevenue || 0}
- Average Invoice Value: $${invoices?.reduce((sum, i) => sum + Number(i.total_amount || 0), 0) / (invoices?.length || 1)}

Recent orders: ${orders?.length || 0} in last 30 days

Provide:
1. Predicted next orders for top 5 customers
2. Recommended follow-up actions for overdue accounts
3. Revenue forecast for next 30 days
4. Risk assessment for at-risk customers
    `.trim();

    let aiPredictions = {
      predictedOrders: [],
      recommendations: [],
      revenueForecast: 0,
      riskAssessment: 'Low',
    };

    try {
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
              content: 'You are a financial analyst AI for GasMask OS. Provide actionable insights and predictions.'
            },
            {
              role: 'user',
              content: `${aiContext}\n\nProvide JSON response with:\n{\n  "predictedOrders": [{"customerId": "...", "predictedAmount": 0, "predictedDate": "..."}],\n  "recommendations": ["..."],\n  "revenueForecast": 0,\n  "riskAssessment": "Low|Medium|High"\n}`
            }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices[0]?.message?.content || '{}';
        
        let jsonContent = content;
        if (content.includes('```json')) {
          jsonContent = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonContent = content.split('```')[1].split('```')[0].trim();
        }
        
        aiPredictions = JSON.parse(jsonContent);
      }
    } catch (aiError) {
      console.error('AI prediction failed:', aiError);
    }

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      overdueAccounts: overdueInvoices.map(inv => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id,
        customerName: inv.crm_customers?.name || 'Unknown',
        amount: Number(inv.total_amount),
        dueDate: inv.due_date,
        daysOverdue: Math.floor(
          (today.getTime() - new Date(inv.due_date).getTime()) / (24 * 60 * 60 * 1000)
        ),
      })),
      atRiskCustomers,
      highValueCustomers,
      predictedOrders: aiPredictions.predictedOrders,
      recommendations: aiPredictions.recommendations,
      revenueForecast: aiPredictions.revenueForecast,
      riskAssessment: aiPredictions.riskAssessment,
      metrics: {
        totalInvoices: invoices?.length || 0,
        overdueCount: overdueInvoices.length,
        totalOutstanding: balances?.reduce((sum, b) => sum + Number(b.outstanding_balance || 0), 0) || 0,
        averageInvoiceValue: invoices?.reduce((sum, i) => sum + Number(i.total_amount || 0), 0) / (invoices?.length || 1),
      },
    };

    console.log('✅ Financial Analysis Complete');
    console.log(`📊 Overdue: ${overdueInvoices.length}, At-Risk: ${atRiskCustomers.length}`);

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ AI Financial Analysis Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});