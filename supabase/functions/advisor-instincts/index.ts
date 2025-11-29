import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerDef {
  trigger_name: string;
  trigger_type: 'risk' | 'opportunity' | 'task' | 'action';
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  condition_detected: string;
  recommended_action: string;
  details?: Record<string, any>;
  related_entity_type?: string;
  related_entity_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🧠 Advisor Instincts: Starting autonomous scan...');

    const triggers: TriggerDef[] = [];
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data in parallel
    const [
      { data: transactions },
      { data: expenses },
      { data: subscriptions },
      { data: payroll },
      { data: personalTx },
      { data: risks },
      { data: stores },
      { data: invoices },
      { data: inventory },
      { data: ambassadors },
      { data: existingTriggers },
    ] = await Promise.all([
      supabase.from('business_transactions').select('*').gte('transaction_date', startOfMonth),
      supabase.from('business_expenses').select('*').gte('expense_date', startOfMonth),
      supabase.from('subscription_expenses').select('*').eq('is_active', true),
      supabase.from('payroll_records').select('*').eq('status', 'pending'),
      supabase.from('personal_transactions').select('*').gte('transaction_date', twentyFourHoursAgo.split('T')[0]),
      supabase.from('ai_risk_insights').select('*').eq('status', 'open'),
      supabase.from('stores').select('*'),
      supabase.from('invoices').select('*').eq('payment_status', 'unpaid'),
      supabase.from('inventory').select('*'),
      supabase.from('ambassadors').select('*, profiles(name)'),
      supabase.from('advisor_triggers').select('trigger_name').eq('status', 'open').gte('created_at', twentyFourHoursAgo),
    ]);

    const existingTriggerNames = new Set((existingTriggers || []).map(t => t.trigger_name));

    // Calculate financial metrics
    const revenue = (transactions || []).filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const businessExp = (transactions || []).filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = revenue - businessExp;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const monthlySubscriptions = (subscriptions || []).reduce((sum, s) => {
      const amount = Number(s.amount);
      switch (s.billing_cycle) {
        case 'weekly': return sum + (amount * 4);
        case 'yearly': return sum + (amount / 12);
        case 'quarterly': return sum + (amount / 3);
        default: return sum + amount;
      }
    }, 0);

    const pendingPayroll = (payroll || []).reduce((sum, p) => sum + Number(p.net_pay), 0);
    const personalSpending24h = (personalTx || []).filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

    // === TRIGGER DETECTION ===

    // 1. Net profit drops below 20%
    if (profitMargin < 20 && revenue > 0) {
      const name = `profit_margin_low_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'risk',
          category: 'finance',
          severity: profitMargin < 10 ? 'critical' : 'high',
          condition_detected: `Net profit margin is ${profitMargin.toFixed(1)}%, below the 20% threshold`,
          recommended_action: 'Review expenses and identify cost-cutting opportunities. Consider raising prices or reducing subscriptions.',
          details: { profit_margin: profitMargin, revenue, expenses: businessExp },
        });
      }
    }

    // 2. Subscription costs exceed profit
    if (monthlySubscriptions > netProfit && netProfit > 0) {
      const name = `subscriptions_exceed_profit_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'risk',
          category: 'finance',
          severity: 'critical',
          condition_detected: `Monthly subscriptions ($${monthlySubscriptions.toFixed(2)}) exceed net profit ($${netProfit.toFixed(2)})`,
          recommended_action: 'Immediately audit all subscriptions. Cancel unused services and negotiate better rates.',
          details: { subscriptions: monthlySubscriptions, net_profit: netProfit },
        });
      }
    }

    // 3. Payroll backing up
    if (pendingPayroll > 5000) {
      const name = `payroll_backlog_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'task',
          category: 'finance',
          severity: pendingPayroll > 10000 ? 'critical' : 'high',
          condition_detected: `Pending payroll of $${pendingPayroll.toFixed(2)} needs processing`,
          recommended_action: 'Process payroll immediately to maintain driver and staff satisfaction.',
          details: { pending_amount: pendingPayroll, pending_records: (payroll || []).length },
        });
      }
    }

    // 4. Personal spending spike
    if (personalSpending24h > 500) {
      const name = `personal_spending_spike_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'risk',
          category: 'personal',
          severity: personalSpending24h > 1000 ? 'high' : 'medium',
          condition_detected: `Personal spending in last 24h: $${personalSpending24h.toFixed(2)}`,
          recommended_action: 'Review recent personal purchases. Consider if spending aligns with budget goals.',
          details: { amount: personalSpending24h, transaction_count: (personalTx || []).length },
        });
      }
    }

    // 5. Stores not visited in 7 days
    const inactiveStores = (stores || []).filter(s => {
      if (!s.last_visit_date) return true;
      return new Date(s.last_visit_date) < new Date(sevenDaysAgo);
    });
    if (inactiveStores.length > 5) {
      const name = `stores_inactive_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'task',
          category: 'crm',
          severity: inactiveStores.length > 10 ? 'high' : 'medium',
          condition_detected: `${inactiveStores.length} stores haven't been visited in 7+ days`,
          recommended_action: 'Generate route plan to visit inactive stores. Prioritize high-value accounts.',
          details: { count: inactiveStores.length, store_ids: inactiveStores.slice(0, 10).map(s => s.id) },
        });
      }
    }

    // 6. Unpaid invoices more than 48 hours
    const overdueInvoices = (invoices || []).filter(i => new Date(i.invoice_date) < new Date(fortyEightHoursAgo));
    if (overdueInvoices.length > 0) {
      const totalUnpaid = overdueInvoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
      const name = `unpaid_invoices_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'task',
          category: 'finance',
          severity: totalUnpaid > 5000 ? 'critical' : 'high',
          condition_detected: `${overdueInvoices.length} unpaid invoices totaling $${totalUnpaid.toFixed(2)} are overdue`,
          recommended_action: 'Send payment reminders. Follow up with phone calls for high-value accounts.',
          details: { count: overdueInvoices.length, total_amount: totalUnpaid },
        });
      }
    }

    // 7. Low inventory
    const lowStockItems = (inventory || []).filter(i => Number(i.quantity) < Number(i.reorder_level || 10));
    if (lowStockItems.length > 0) {
      const name = `low_inventory_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'task',
          category: 'inventory',
          severity: lowStockItems.length > 5 ? 'high' : 'medium',
          condition_detected: `${lowStockItems.length} items are below reorder level`,
          recommended_action: 'Place restock orders immediately. Prioritize fast-moving items.',
          details: { count: lowStockItems.length, items: lowStockItems.slice(0, 5).map(i => i.product_name) },
        });
      }
    }

    // 8. Critical risks from ai_risk_insights
    const criticalRisks = (risks || []).filter(r => r.risk_level === 'critical');
    if (criticalRisks.length > 0) {
      const name = `critical_risks_detected_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'risk',
          category: 'operations',
          severity: 'critical',
          condition_detected: `${criticalRisks.length} critical risks require immediate attention`,
          recommended_action: 'Review and address each critical risk in the Risk Radar immediately.',
          details: { count: criticalRisks.length, risk_types: criticalRisks.map(r => r.risk_type) },
        });
      }
    }

    // 9. Ambassador inactivity
    const inactiveAmbassadors = (ambassadors || []).filter(a => {
      if (!a.updated_at) return true;
      return new Date(a.updated_at) < new Date(sevenDaysAgo);
    });
    if (inactiveAmbassadors.length > 0) {
      const name = `ambassador_inactive_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'task',
          category: 'ambassador',
          severity: 'medium',
          condition_detected: `${inactiveAmbassadors.length} ambassadors have been inactive for 7+ days`,
          recommended_action: 'Reach out to inactive ambassadors. Consider incentives or check for issues.',
          details: { count: inactiveAmbassadors.length },
        });
      }
    }

    // 10. Opportunity: High revenue day
    if (revenue > 10000) {
      const name = `high_revenue_opportunity_${today.toISOString().split('T')[0]}`;
      if (!existingTriggerNames.has(name)) {
        triggers.push({
          trigger_name: name,
          trigger_type: 'opportunity',
          category: 'finance',
          severity: 'low',
          condition_detected: `Strong revenue month: $${revenue.toFixed(2)} so far`,
          recommended_action: 'Consider reinvesting profits into marketing or inventory expansion.',
          details: { revenue, profit_margin: profitMargin },
        });
      }
    }

    // Insert all new triggers
    if (triggers.length > 0) {
      const { error: insertError } = await supabase.from('advisor_triggers').insert(
        triggers.map(t => ({
          trigger_name: t.trigger_name,
          trigger_type: t.trigger_type,
          severity: t.severity,
          category: t.category,
          condition_detected: t.condition_detected,
          recommended_action: t.recommended_action,
          details: t.details || {},
          auto_generated_task: t.severity === 'critical' || t.severity === 'high',
        }))
      );

      if (insertError) {
        console.error('Error inserting triggers:', insertError);
      }
    }

    // For critical triggers, create advisor sessions
    const criticalTriggers = triggers.filter(t => t.severity === 'critical');
    if (criticalTriggers.length > 0) {
      await supabase.from('advisor_sessions').insert({
        session_type: 'auto_instinct',
        context_sources: ['triggers', 'finance', 'risk'],
        ai_summary: `Autonomous scan detected ${criticalTriggers.length} critical issues requiring immediate attention.`,
        ai_recommendations: criticalTriggers.map(t => t.recommended_action),
        action_items: { triggers: criticalTriggers.map(t => t.trigger_name) },
        risk_level: 'critical',
        confidence_score: 95,
      });
    }

    console.log(`✅ Advisor Instincts: Detected ${triggers.length} new triggers`);

    return new Response(
      JSON.stringify({
        success: true,
        triggers_detected: triggers.length,
        critical: triggers.filter(t => t.severity === 'critical').length,
        high: triggers.filter(t => t.severity === 'high').length,
        medium: triggers.filter(t => t.severity === 'medium').length,
        low: triggers.filter(t => t.severity === 'low').length,
        triggers: triggers.map(t => ({ name: t.trigger_name, severity: t.severity, category: t.category })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Advisor Instincts Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});