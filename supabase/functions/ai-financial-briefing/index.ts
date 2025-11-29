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
    const { type = 'daily', userId } = await req.json();

    console.log(`📊 Generating ${type} financial briefing...`);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch financial data
    const [
      { data: businessTransactions },
      { data: businessExpenses },
      { data: payroll },
      { data: subscriptions },
      { data: personalTransactions },
    ] = await Promise.all([
      supabase.from('business_transactions').select('*').gte('transaction_date', startOfMonth),
      supabase.from('business_expenses').select('*').gte('expense_date', startOfMonth),
      supabase.from('payroll_records').select('*').eq('status', 'pending'),
      supabase.from('subscription_expenses').select('*').eq('is_active', true),
      userId 
        ? supabase.from('personal_transactions').select('*').eq('user_id', userId).gte('transaction_date', yesterday)
        : { data: [] },
    ]);

    // Calculate summaries
    const income = (businessTransactions || []).filter(t => t.transaction_type === 'income');
    const expenses = (businessTransactions || []).filter(t => t.transaction_type === 'expense');
    
    const totalRevenue = income.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalBusinessExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = totalRevenue - totalBusinessExpenses;

    const pendingPayroll = (payroll || []).reduce((sum, p) => sum + Number(p.net_pay), 0);
    const monthlySubscriptions = (subscriptions || []).reduce((sum, s) => {
      const amount = Number(s.amount);
      switch (s.billing_cycle) {
        case 'weekly': return sum + (amount * 4);
        case 'yearly': return sum + (amount / 12);
        case 'quarterly': return sum + (amount / 3);
        default: return sum + amount;
      }
    }, 0);

    const personalSpending = (personalTransactions || [])
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Generate AI insights
    const financialContext = `
Business Financial Summary (${startOfMonth} to ${today.toISOString().split('T')[0]}):
- Total Revenue: $${totalRevenue.toFixed(2)}
- Total Expenses: $${totalBusinessExpenses.toFixed(2)}
- Net Profit: $${netProfit.toFixed(2)}
- Pending Payroll: $${pendingPayroll.toFixed(2)}
- Monthly Subscriptions: $${monthlySubscriptions.toFixed(2)}
- Personal Spending (24h): $${personalSpending.toFixed(2)}

Transaction Count: ${(businessTransactions || []).length}
Expense Count: ${(businessExpenses || []).length}
Pending Payroll Records: ${(payroll || []).length}
Active Subscriptions: ${(subscriptions || []).length}
    `.trim();

    let aiAnalysis = {
      summary: `Revenue: $${totalRevenue.toFixed(0)}, Expenses: $${totalBusinessExpenses.toFixed(0)}, Profit: $${netProfit.toFixed(0)}`,
      insights: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[],
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
              content: 'You are a CFO AI assistant. Analyze financial data and provide actionable insights. Return JSON with: summary (1 sentence), insights (array of observations), warnings (array of concerns), recommendations (array of actions).'
            },
            {
              role: 'user',
              content: `Analyze this financial data and provide insights:\n\n${financialContext}\n\nReturn JSON format only.`
            }
          ],
          temperature: 0.3,
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
        
        aiAnalysis = JSON.parse(jsonContent);
      }
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
    }

    // Store insights
    if (aiAnalysis.warnings.length > 0) {
      for (const warning of aiAnalysis.warnings) {
        await supabase.from('financial_ai_insights').insert({
          insight_type: 'warning',
          insight_category: 'daily_briefing',
          title: 'Financial Warning',
          description: warning,
          severity: 'warning',
          is_business: true,
        });
      }
    }

    const briefing = {
      date: today.toISOString().split('T')[0],
      type,
      business: {
        totalRevenue,
        totalExpenses: totalBusinessExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0',
        pendingPayroll,
        monthlySubscriptions,
        transactionCount: (businessTransactions || []).length,
      },
      personal: {
        spending24h: personalSpending,
      },
      aiAnalysis,
    };

    console.log('✅ Financial briefing generated');

    return new Response(
      JSON.stringify({ success: true, briefing }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Financial briefing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
