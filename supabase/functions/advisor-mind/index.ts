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

    const { 
      mode = 'advice', 
      userId, 
      question, 
      advisorMode = 'mixed',
      timeWindow = 'today',
      scenarioName,
      scenarioInputs 
    } = await req.json();

    console.log(`🧠 Advisor Mind: Running in ${mode} mode`);

    // Gather context data
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

    const [
      { data: risks },
      { data: briefings },
      { data: transactions },
      { data: expenses },
      { data: subscriptions },
      { data: payroll },
      { data: personalTx },
      { data: insights },
    ] = await Promise.all([
      supabase.from('ai_risk_insights').select('*').eq('status', 'open').limit(50),
      supabase.from('ai_daily_briefings').select('*').order('created_at', { ascending: false }).limit(2),
      supabase.from('business_transactions').select('*').gte('transaction_date', startOfMonth),
      supabase.from('business_expenses').select('*').gte('expense_date', startOfMonth),
      supabase.from('subscription_expenses').select('*').eq('is_active', true),
      supabase.from('payroll_records').select('*').eq('status', 'pending'),
      userId ? supabase.from('personal_transactions').select('*').eq('user_id', userId).gte('transaction_date', startOfMonth) : { data: [] },
      supabase.from('financial_ai_insights').select('*').eq('status', 'active'),
    ]);

    // Calculate financial metrics
    const income = (transactions || []).filter(t => t.transaction_type === 'income');
    const businessExpenses = (transactions || []).filter(t => t.transaction_type === 'expense');
    
    const totalRevenue = income.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = businessExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

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

    const personalSpending = (personalTx || [])
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const criticalRisks = (risks || []).filter(r => r.risk_level === 'critical').length;
    const highRisks = (risks || []).filter(r => r.risk_level === 'high').length;

    if (mode === 'advice') {
      // Build advice context
      const contextPrompt = `
You are the unified OS Dynasty Advisor (CFO + COO + personal money coach).

CURRENT DATA (${timeWindow} focus, ${advisorMode} mode):

BUSINESS FINANCIALS (Month-to-Date):
- Total Revenue: $${totalRevenue.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Profit: $${netProfit.toFixed(2)}
- Profit Margin: ${profitMargin.toFixed(1)}%
- Pending Payroll: $${pendingPayroll.toFixed(2)}
- Monthly Subscriptions: $${monthlySubscriptions.toFixed(2)}

RISKS:
- Critical Risks: ${criticalRisks}
- High Risks: ${highRisks}
- Total Open Risks: ${(risks || []).length}

FINANCIAL INSIGHTS: ${(insights || []).length} active warnings/opportunities

${advisorMode !== 'business' ? `
PERSONAL FINANCES:
- Personal Spending (Month): $${personalSpending.toFixed(2)}
` : ''}

${question ? `USER QUESTION: ${question}` : 'Generate proactive advice.'}

Provide:
1. What are the top 3-5 actions I should take next?
2. What should I watch out for?
3. Where can I save or make the most money quickly?

Return JSON only with this exact structure:
{
  "summary": "One paragraph summary",
  "top_actions": ["action1", "action2", ...],
  "warnings": ["warning1", ...],
  "opportunities": ["opportunity1", ...],
  "risk_level": "low|medium|high|critical",
  "confidence_score": 0-100
}
      `.trim();

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a strategic business and personal finance advisor. Always respond with valid JSON only.' },
            { role: 'user', content: contextPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices[0]?.message?.content || '{}';
      
      // Parse JSON from response
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }

      const advice = JSON.parse(content);

      // Store session
      await supabase.from('advisor_sessions').insert({
        user_id: userId,
        session_type: 'advice',
        input_prompt: question,
        context_sources: ['risk', 'finance', advisorMode !== 'business' ? 'personal' : null].filter(Boolean),
        ai_summary: advice.summary,
        ai_recommendations: advice.top_actions,
        action_items: { warnings: advice.warnings, opportunities: advice.opportunities },
        risk_level: advice.risk_level,
        confidence_score: advice.confidence_score,
        mode: advisorMode,
        time_window: timeWindow,
      });

      console.log('✅ Advisor advice generated');

      return new Response(
        JSON.stringify({ success: true, mode: 'advice', advice }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'simulation') {
      // Calculate projected metrics based on scenario inputs
      const inputs = scenarioInputs || {};
      
      const baselineMetrics = {
        monthly_revenue: totalRevenue,
        monthly_expenses: totalExpenses + monthlySubscriptions + pendingPayroll,
        net_profit: netProfit - monthlySubscriptions - pendingPayroll,
        profit_margin: profitMargin,
      };

      let projectedRevenue = totalRevenue;
      let projectedExpenses = baselineMetrics.monthly_expenses;

      // Apply scenario changes
      if (inputs.cut_subscription_percent) {
        projectedExpenses -= monthlySubscriptions * (inputs.cut_subscription_percent / 100);
      }
      if (inputs.increase_marketing) {
        projectedExpenses += inputs.increase_marketing;
        projectedRevenue *= 1.05; // Assume 5% revenue boost per marketing dollar
      }
      if (inputs.change_driver_pay_percent) {
        projectedExpenses += pendingPayroll * (inputs.change_driver_pay_percent / 100);
      }
      if (inputs.raise_price_percent) {
        projectedRevenue *= (1 + inputs.raise_price_percent / 100);
      }

      const projectedProfit = projectedRevenue - projectedExpenses;
      const projectedMargin = projectedRevenue > 0 ? ((projectedProfit / projectedRevenue) * 100) : 0;

      const projectedMetrics = {
        monthly_revenue: projectedRevenue,
        monthly_expenses: projectedExpenses,
        net_profit: projectedProfit,
        profit_margin: projectedMargin,
      };

      // Get AI analysis
      const simPrompt = `
Compare these business scenarios:

BASELINE:
- Revenue: $${baselineMetrics.monthly_revenue.toFixed(2)}
- Expenses: $${baselineMetrics.monthly_expenses.toFixed(2)}
- Net Profit: $${baselineMetrics.net_profit.toFixed(2)}
- Margin: ${baselineMetrics.profit_margin.toFixed(1)}%

PROJECTED (after changes: ${JSON.stringify(inputs)}):
- Revenue: $${projectedMetrics.monthly_revenue.toFixed(2)}
- Expenses: $${projectedMetrics.monthly_expenses.toFixed(2)}
- Net Profit: $${projectedMetrics.net_profit.toFixed(2)}
- Margin: ${projectedMetrics.profit_margin.toFixed(1)}%

Explain tradeoffs. Focus on cashflow safety, risk, and growth potential.
Return JSON:
{
  "analysis": "paragraph explaining the scenario",
  "recommendations": ["rec1", "rec2"],
  "is_favorable": true/false,
  "risk_rating": "low|medium|high"
}
      `.trim();

      const simResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a financial scenario analyst. Respond with valid JSON only.' },
            { role: 'user', content: simPrompt }
          ],
          temperature: 0.3,
        }),
      });

      const simData = await simResponse.json();
      let simContent = simData.choices[0]?.message?.content || '{}';
      
      if (simContent.includes('```json')) {
        simContent = simContent.split('```json')[1].split('```')[0].trim();
      } else if (simContent.includes('```')) {
        simContent = simContent.split('```')[1].split('```')[0].trim();
      }

      const simAnalysis = JSON.parse(simContent);

      // Store scenario
      await supabase.from('advisor_scenarios').insert({
        user_id: userId,
        scenario_name: scenarioName || 'Custom Scenario',
        scenario_type: Object.keys(inputs).join('_'),
        inputs,
        baseline_metrics: baselineMetrics,
        projected_metrics: projectedMetrics,
        ai_analysis: simAnalysis.analysis,
        ai_recommendations: simAnalysis.recommendations,
        is_favorable: simAnalysis.is_favorable,
        risk_rating: simAnalysis.risk_rating,
      });

      const scenario = {
        scenario_name: scenarioName || 'Custom Scenario',
        baseline_metrics: baselineMetrics,
        projected_metrics: projectedMetrics,
        ai_analysis: simAnalysis.analysis,
        ai_recommendations: simAnalysis.recommendations,
        is_favorable: simAnalysis.is_favorable,
        risk_rating: simAnalysis.risk_rating,
      };

      console.log('✅ Scenario simulation complete');

      return new Response(
        JSON.stringify({ success: true, mode: 'simulation', scenario }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid mode' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Advisor Mind Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
