import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Midday Monitor Cycle Edge Function
 * Runs hourly - Continuous monitoring and quick response
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const results: Record<string, any> = {
    risksRescored: 0,
    newUnpaidDetected: 0,
    newLowStockDetected: 0,
    driverIssuesDetected: 0,
    urgentItemsPushed: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🕐 Midday Monitor Cycle: Starting...');

    // Check if midday ops is enabled
    const { data: settings } = await supabase
      .from('ai_follow_up_settings')
      .select('midday_enabled')
      .limit(1)
      .single();

    if (settings && settings.midday_enabled === false) {
      console.log('⏸️ Midday monitoring disabled, skipping...');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Midday monitoring disabled in settings'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Re-score existing risks
    try {
      console.log('📊 Re-scoring risks...');
      const { data: openRisks } = await supabase
        .from('ai_risk_insights')
        .select('id, entity_type, entity_id, risk_score, source_data, created_at')
        .eq('status', 'open');

      if (openRisks) {
        const today = new Date();
        for (const risk of openRisks) {
          // Increase risk score based on age
          const createdAt = new Date(risk.created_at);
          const daysOld = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOld > 0) {
            const newScore = Math.min(100, risk.risk_score + (daysOld * 2));
            const newLevel = newScore >= 80 ? 'critical' : newScore >= 60 ? 'high' : newScore >= 40 ? 'medium' : 'low';
            
            if (newScore !== risk.risk_score) {
              await supabase
                .from('ai_risk_insights')
                .update({ risk_score: newScore, risk_level: newLevel })
                .eq('id', risk.id);
              results.risksRescored++;
            }
          }
        }
        console.log(`✅ Re-scored ${results.risksRescored} risks`);
      }
    } catch (e) {
      errors.push(`Risk rescoring failed: ${e}`);
      console.error('❌ Risk rescoring error:', e);
    }

    // 2. Detect new unpaid invoices
    try {
      console.log('💰 Checking for new unpaid invoices...');
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, due_date, total_amount, status')
        .in('status', ['sent', 'overdue']);

      if (invoices) {
        const today = new Date();
        for (const invoice of invoices) {
          const dueDate = new Date(invoice.due_date);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue > 0) {
            // Check if risk insight already exists
            const { data: existingRisk } = await supabase
              .from('ai_risk_insights')
              .select('id')
              .eq('entity_type', 'invoice')
              .eq('entity_id', invoice.id)
              .eq('status', 'open')
              .limit(1);

            if (!existingRisk || existingRisk.length === 0) {
              const riskScore = Math.min(100, 40 + (daysOverdue * 3));
              await supabase.from('ai_risk_insights').insert({
                entity_type: 'invoice',
                entity_id: invoice.id,
                risk_type: 'non_payment',
                risk_score: riskScore,
                risk_level: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : 'medium',
                headline: `Invoice #${invoice.invoice_number} is ${daysOverdue} days overdue`,
                details: `Amount: $${invoice.total_amount}`,
                recommended_action: 'Send payment reminder',
                source_data: { daysOverdue, amount: invoice.total_amount },
                status: 'open',
              });
              results.newUnpaidDetected++;
            }
          }
        }
        console.log(`✅ Detected ${results.newUnpaidDetected} new unpaid invoices`);
      }
    } catch (e) {
      errors.push(`Unpaid detection failed: ${e}`);
      console.error('❌ Unpaid detection error:', e);
    }

    // 3. Detect new low stock items
    try {
      console.log('📦 Checking for low stock items...');
      const { data: inventory } = await supabase
        .from('inventory')
        .select('id, product_name, quantity, reorder_point')
        .lt('quantity', 50); // Check items below 50 quantity

      if (inventory) {
        for (const item of inventory) {
          const threshold = item.reorder_point || 10;
          if (item.quantity < threshold) {
            const { data: existingRisk } = await supabase
              .from('ai_risk_insights')
              .select('id')
              .eq('entity_type', 'inventory')
              .eq('entity_id', item.id)
              .eq('status', 'open')
              .limit(1);

            if (!existingRisk || existingRisk.length === 0) {
              const riskScore = item.quantity === 0 ? 100 : Math.min(95, 60 + ((threshold - item.quantity) * 5));
              await supabase.from('ai_risk_insights').insert({
                entity_type: 'inventory',
                entity_id: item.id,
                risk_type: 'low_stock',
                risk_score: riskScore,
                risk_level: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : 'medium',
                headline: `${item.product_name} low stock (${item.quantity}/${threshold})`,
                recommended_action: 'Create reorder request',
                source_data: { quantity: item.quantity, reorder_point: threshold, product_name: item.product_name },
                status: 'open',
              });
              results.newLowStockDetected++;
            }
          }
        }
        console.log(`✅ Detected ${results.newLowStockDetected} new low stock items`);
      }
    } catch (e) {
      errors.push(`Low stock detection failed: ${e}`);
      console.error('❌ Low stock detection error:', e);
    }

    // 4. Monitor driver routes and delays
    try {
      console.log('🚗 Monitoring driver routes...');
      const { data: activeRoutes } = await supabase
        .from('route_plans')
        .select('id, driver_id, status, planned_date')
        .eq('planned_date', new Date().toISOString().split('T')[0])
        .eq('status', 'in_progress');

      // For now, just count active routes - could add delay detection logic
      results.activeRoutes = activeRoutes?.length || 0;
      console.log(`✅ Monitoring ${results.activeRoutes} active routes`);
    } catch (e) {
      // Route table might not exist - not a critical error
      console.log('ℹ️ Route monitoring skipped (table may not exist)');
    }

    // 5. Push urgent problems to communication queue
    try {
      console.log('📬 Pushing urgent items to queue...');
      const { data: criticalRisks } = await supabase
        .from('ai_risk_insights')
        .select('id, entity_type, entity_id, headline, risk_score')
        .eq('status', 'open')
        .eq('risk_level', 'critical')
        .limit(10);

      if (criticalRisks) {
        for (const risk of criticalRisks) {
          const { data: existing } = await supabase
            .from('ai_communication_queue')
            .select('id')
            .eq('entity_type', risk.entity_type)
            .eq('entity_id', risk.entity_id || risk.id)
            .eq('status', 'pending')
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from('ai_communication_queue').insert({
              entity_type: risk.entity_type,
              entity_id: risk.entity_id || risk.id,
              suggested_action: 'immediate_attention',
              reason: `CRITICAL: ${risk.headline}`,
              urgency: 95,
              status: 'pending',
            });
            results.urgentItemsPushed++;
          }
        }
        console.log(`✅ Pushed ${results.urgentItemsPushed} urgent items to queue`);
      }
    } catch (e) {
      errors.push(`Urgent queue push failed: ${e}`);
      console.error('❌ Urgent queue error:', e);
    }

    // Log the ops cycle
    const duration = Date.now() - startTime;
    await supabase.from('ai_ops_log').insert({
      cycle_type: 'midday',
      results,
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : null,
      notes: `Completed in ${duration}ms`,
    });

    console.log(`🕐 Midday Monitor Cycle complete in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      cycle: 'midday',
      duration,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Midday Monitor Cycle Error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('ai_ops_log').insert({
        cycle_type: 'midday',
        results,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        notes: 'Cycle failed with critical error',
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
