import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Follow-Up Engine Edge Function
 * Runs automated follow-ups for invoices, stores, inventory, drivers, and ambassadors
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { scanType = 'full' } = await req.json().catch(() => ({}));

    console.log('🤖 Follow-Up Engine: Starting automated follow-ups...');

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      invoicesProcessed: 0,
      storesProcessed: 0,
      inventoryProcessed: 0,
      driversProcessed: 0,
      ambassadorsProcessed: 0,
      actionsTriggered: 0,
      errors: [] as string[],
    };

    // Fetch settings
    const { data: settingsData } = await supabase
      .from('ai_follow_up_settings')
      .select('*');

    const settings: Record<string, any> = {};
    for (const row of settingsData || []) {
      settings[row.category] = row.settings;
    }

    // Process Invoice Follow-Ups
    if (scanType === 'full' || scanType === 'invoice') {
      const invoiceResult = await processInvoiceFollowUps(supabase, settings.invoice);
      result.invoicesProcessed = invoiceResult.processed;
      result.actionsTriggered += invoiceResult.actions;
      result.errors.push(...invoiceResult.errors);
    }

    // Process Store Follow-Ups
    if (scanType === 'full' || scanType === 'store') {
      const storeResult = await processStoreFollowUps(supabase, settings.store);
      result.storesProcessed = storeResult.processed;
      result.actionsTriggered += storeResult.actions;
      result.errors.push(...storeResult.errors);
    }

    // Process Inventory Follow-Ups
    if (scanType === 'full' || scanType === 'inventory') {
      const inventoryResult = await processInventoryFollowUps(supabase, settings.inventory);
      result.inventoryProcessed = inventoryResult.processed;
      result.actionsTriggered += inventoryResult.actions;
      result.errors.push(...inventoryResult.errors);
    }

    // Process Ambassador Follow-Ups
    if (scanType === 'full' || scanType === 'ambassador') {
      const ambassadorResult = await processAmbassadorFollowUps(supabase, settings.ambassador);
      result.ambassadorsProcessed = ambassadorResult.processed;
      result.actionsTriggered += ambassadorResult.actions;
      result.errors.push(...ambassadorResult.errors);
    }

    console.log(`✅ Follow-Up Engine complete: ${result.actionsTriggered} actions triggered`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Follow-Up Engine Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processInvoiceFollowUps(supabase: any, settings: any) {
  const result = { processed: 0, actions: 0, errors: [] as string[] };
  
  if (!settings?.auto_reminder_enabled) return result;

  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, total_amount, status')
      .in('status', ['sent', 'overdue']);

    if (!invoices) return result;

    const today = new Date();

    for (const invoice of invoices) {
      result.processed++;
      
      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) continue;

      // Check recent follow-ups
      const { data: recentLog } = await supabase
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'invoice')
        .eq('entity_id', invoice.id)
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      // Determine message based on days overdue
      let message = settings.day1_message;
      let escalationLevel = 0;

      if (daysOverdue >= 15) {
        message = settings.day15_message;
        escalationLevel = 3;
      } else if (daysOverdue >= 10) {
        message = settings.day10_message;
        escalationLevel = 2;
      } else if (daysOverdue >= 5) {
        message = settings.day5_message;
        escalationLevel = 1;
      }

      // Log to communication queue
      await supabase.from('ai_communication_queue').insert({
        entity_type: 'invoice',
        entity_id: invoice.id,
        suggested_action: 'send_reminder',
        reason: `Invoice ${daysOverdue} days overdue`,
        urgency: Math.min(90, 50 + daysOverdue * 2),
        status: 'pending',
      });

      // Log follow-up action
      await supabase.from('ai_follow_up_log').insert({
        entity_type: 'invoice',
        entity_id: invoice.id,
        action_taken: 'send_reminder',
        action_category: 'invoice',
        result: 'success',
        message_sent: message,
        escalated: escalationLevel >= 2,
        escalation_level: escalationLevel,
        next_follow_up_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      result.actions++;
    }
  } catch (error) {
    result.errors.push(`Invoice error: ${error}`);
  }

  return result;
}

async function processStoreFollowUps(supabase: any, settings: any) {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  try {
    const { data: riskInsights } = await supabase
      .from('ai_risk_insights')
      .select('id, entity_id, risk_score, risk_level, source_data')
      .eq('entity_type', 'store')
      .eq('risk_type', 'churn')
      .eq('status', 'open')
      .in('risk_level', ['medium', 'high', 'critical']);

    if (!riskInsights) return result;

    for (const insight of riskInsights) {
      result.processed++;

      // Check recent follow-ups
      const { data: recentLog } = await supabase
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'store')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const daysSinceVisit = insight.source_data?.days_since_last_order || 0;
      const message = daysSinceVisit >= (settings?.critical_churn_days || 30)
        ? settings?.recovery_message || 'We miss you!'
        : settings?.auto_reminder_message || 'We\'re stopping by this week!';

      // Log to communication queue
      await supabase.from('ai_communication_queue').insert({
        entity_type: 'store',
        entity_id: insight.entity_id,
        suggested_action: 'send_recovery',
        reason: `Store not visited in ${daysSinceVisit} days`,
        urgency: Math.min(95, 40 + daysSinceVisit * 2),
        status: 'pending',
      });

      // Log follow-up action
      await supabase.from('ai_follow_up_log').insert({
        entity_type: 'store',
        entity_id: insight.entity_id,
        action_taken: 'send_recovery_message',
        action_category: 'store',
        result: 'success',
        message_sent: message,
        escalated: insight.risk_level === 'critical',
        next_follow_up_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      result.actions++;
    }
  } catch (error) {
    result.errors.push(`Store error: ${error}`);
  }

  return result;
}

async function processInventoryFollowUps(supabase: any, settings: any) {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  try {
    const { data: riskInsights } = await supabase
      .from('ai_risk_insights')
      .select('id, entity_id, headline, source_data')
      .eq('entity_type', 'inventory')
      .eq('risk_type', 'low_stock')
      .eq('status', 'open');

    if (!riskInsights) return result;

    for (const insight of riskInsights) {
      result.processed++;

      // Check recent alerts
      const { data: recentLog } = await supabase
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'inventory')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const currentQty = insight.source_data?.quantity || 0;
      const reorderPoint = insight.source_data?.reorder_point || 10;
      const itemName = insight.source_data?.product_name || 'Unknown';

      // Log to communication queue
      await supabase.from('ai_communication_queue').insert({
        entity_type: 'inventory',
        entity_id: insight.entity_id,
        suggested_action: 'reorder_alert',
        reason: `${itemName} low stock (${currentQty}/${reorderPoint})`,
        urgency: currentQty === 0 ? 100 : Math.min(90, 70 + (reorderPoint - currentQty) * 5),
        status: 'pending',
      });

      // Log follow-up action
      await supabase.from('ai_follow_up_log').insert({
        entity_type: 'inventory',
        entity_id: insight.entity_id,
        action_taken: 'create_reorder_alert',
        action_category: 'inventory',
        result: 'success',
        metadata: { currentQty, reorderPoint, itemName },
      });

      result.actions++;
    }
  } catch (error) {
    result.errors.push(`Inventory error: ${error}`);
  }

  return result;
}

async function processAmbassadorFollowUps(supabase: any, settings: any) {
  const result = { processed: 0, actions: 0, errors: [] as string[] };

  if (!settings?.auto_reactivation_enabled) return result;

  try {
    const { data: riskInsights } = await supabase
      .from('ai_risk_insights')
      .select('id, entity_id, risk_level, source_data')
      .eq('entity_type', 'ambassador')
      .eq('risk_type', 'inactive_ambassador')
      .eq('status', 'open');

    if (!riskInsights) return result;

    for (const insight of riskInsights) {
      result.processed++;

      // Check recent follow-ups
      const { data: recentLog } = await supabase
        .from('ai_follow_up_log')
        .select('id')
        .eq('entity_type', 'ambassador')
        .eq('entity_id', insight.entity_id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recentLog && recentLog.length > 0) continue;

      const daysSinceActivity = insight.source_data?.days_since_commission || 0;
      const message = settings?.motivational_message || 'Keep pushing!';

      // Log to communication queue
      await supabase.from('ai_communication_queue').insert({
        entity_type: 'ambassador',
        entity_id: insight.entity_id,
        suggested_action: 'send_motivation',
        reason: `Ambassador inactive for ${daysSinceActivity} days`,
        urgency: Math.min(70, 30 + daysSinceActivity),
        status: 'pending',
      });

      // Log follow-up action
      await supabase.from('ai_follow_up_log').insert({
        entity_type: 'ambassador',
        entity_id: insight.entity_id,
        action_taken: 'send_motivation',
        action_category: 'ambassador',
        result: 'success',
        message_sent: message,
        next_follow_up_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      result.actions++;
    }
  } catch (error) {
    result.errors.push(`Ambassador error: ${error}`);
  }

  return result;
}
