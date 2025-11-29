import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Risk scoring utilities
function scoreToLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function daysSince(date: string | null): number {
  if (!date) return 999;
  const d = new Date(date);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stats = {
      stores_analyzed: 0,
      invoices_analyzed: 0,
      inventory_analyzed: 0,
      new_risks: 0,
      updated_risks: 0,
      kpi_snapshot_created: false,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. STORE CHURN RISK ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    
    const { data: stores } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        brand,
        address_city,
        status,
        created_at,
        visit_logs(visit_datetime)
      `)
      .in('status', ['active', 'member', 'prospect']);

    for (const store of stores || []) {
      stats.stores_analyzed++;
      
      // Get last visit date
      const visits = store.visit_logs || [];
      const lastVisit = visits.length > 0 
        ? visits.sort((a: any, b: any) => 
            new Date(b.visit_datetime).getTime() - new Date(a.visit_datetime).getTime()
          )[0]?.visit_datetime
        : null;
      
      const daysSinceVisit = daysSince(lastVisit);
      
      // Only create risks for stores with activity gaps
      if (daysSinceVisit >= 7) {
        let score = 0;
        if (daysSinceVisit >= 30) score = 85 + Math.min(15, (daysSinceVisit - 30) / 10);
        else if (daysSinceVisit >= 14) score = 60 + ((daysSinceVisit - 14) / 16) * 25;
        else score = 40 + ((daysSinceVisit - 7) / 7) * 20;
        
        const level = scoreToLevel(score);
        
        // Upsert risk insight
        const { data: existingRisk } = await supabase
          .from('ai_risk_insights')
          .select('id')
          .eq('entity_type', 'store')
          .eq('entity_id', store.id)
          .eq('risk_type', 'churn')
          .eq('status', 'open')
          .single();

        const riskData = {
          entity_type: 'store',
          entity_id: store.id,
          brand: store.brand,
          region: store.address_city,
          risk_type: 'churn',
          risk_score: Math.round(score),
          risk_level: level,
          headline: `Store hasn't been visited in ${daysSinceVisit} days`,
          details: `${store.name} was last visited ${daysSinceVisit} days ago. Status: ${store.status}.`,
          recommended_action: level === 'critical' 
            ? 'Urgent: Send recovery text & schedule immediate visit'
            : level === 'high'
            ? 'Send recovery text & schedule visit within 3 days'
            : 'Schedule routine check-in',
          source_data: {
            last_visit_date: lastVisit,
            days_since_visit: daysSinceVisit,
            store_name: store.name,
            status: store.status,
          },
          status: 'open',
        };

        if (existingRisk) {
          await supabase
            .from('ai_risk_insights')
            .update(riskData)
            .eq('id', existingRisk.id);
          stats.updated_risks++;
        } else {
          await supabase
            .from('ai_risk_insights')
            .insert(riskData);
          stats.new_risks++;
          
          // Add to communication queue for high/critical
          if (level === 'high' || level === 'critical') {
            await supabase
              .from('ai_communication_queue')
              .insert({
                entity_type: 'risk',
                entity_id: store.id,
                suggested_action: 'alert',
                reason: riskData.headline,
                urgency: level === 'critical' ? 90 : 70,
                status: 'pending',
              });
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. INVOICE NON-PAYMENT RISK
    // ═══════════════════════════════════════════════════════════════════════════
    
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, store_id, total_amount, due_date, created_at, status, stores(name)')
      .in('status', ['sent', 'overdue', 'pending']);

    for (const invoice of invoices || []) {
      stats.invoices_analyzed++;
      
      const daysOverdue = invoice.due_date 
        ? daysSince(invoice.due_date)
        : daysSince(invoice.created_at);
      
      if (daysOverdue >= 7) {
        let score = 0;
        const amount = Number(invoice.total_amount) || 0;
        
        if (daysOverdue >= 30) score = 80 + Math.min(20, (daysOverdue - 30) / 5);
        else if (daysOverdue >= 14) score = 60 + ((daysOverdue - 14) / 16) * 20;
        else score = 40 + ((daysOverdue - 7) / 7) * 20;
        
        if (amount > 1000) score = Math.min(100, score + 10);
        if (amount > 5000) score = Math.min(100, score + 10);
        
        const level = scoreToLevel(score);
        const storeName = invoice.stores && typeof invoice.stores === 'object' && 'name' in invoice.stores
          ? invoice.stores.name
          : 'Unknown Store';

        const { data: existingRisk } = await supabase
          .from('ai_risk_insights')
          .select('id')
          .eq('entity_type', 'invoice')
          .eq('entity_id', invoice.id)
          .eq('risk_type', 'non_payment')
          .eq('status', 'open')
          .single();

        const riskData = {
          entity_type: 'invoice',
          entity_id: invoice.id,
          risk_type: 'non_payment',
          risk_score: Math.round(score),
          risk_level: level,
          headline: `Invoice ${daysOverdue} days overdue ($${amount.toLocaleString()})`,
          details: `Invoice ${invoice.invoice_number || invoice.id} for ${storeName} is ${daysOverdue} days past due.`,
          recommended_action: level === 'critical'
            ? 'Immediate follow-up required. Consider escalation.'
            : level === 'high'
            ? 'Send payment reminder & schedule follow-up call'
            : 'Send friendly payment reminder',
          source_data: {
            due_date: invoice.due_date,
            days_overdue: daysOverdue,
            amount,
            invoice_number: invoice.invoice_number,
            store_name: storeName,
          },
          status: 'open',
        };

        if (existingRisk) {
          await supabase
            .from('ai_risk_insights')
            .update(riskData)
            .eq('id', existingRisk.id);
          stats.updated_risks++;
        } else {
          await supabase
            .from('ai_risk_insights')
            .insert(riskData);
          stats.new_risks++;
          
          if (level === 'high' || level === 'critical') {
            await supabase
              .from('ai_communication_queue')
              .insert({
                entity_type: 'risk',
                entity_id: invoice.id,
                suggested_action: 'alert',
                reason: riskData.headline,
                urgency: level === 'critical' ? 90 : 70,
                status: 'pending',
              });
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. INVENTORY LOW STOCK RISK
    // ═══════════════════════════════════════════════════════════════════════════
    
    const { data: inventory } = await supabase
      .from('inventory')
      .select('id, product_name, sku, quantity, reorder_point, brand');

    let lowStockCount = 0;
    
    for (const item of inventory || []) {
      stats.inventory_analyzed++;
      
      const reorderPoint = item.reorder_point || 10;
      const quantity = item.quantity || 0;
      
      if (quantity <= reorderPoint) {
        lowStockCount++;
        
        let score = 0;
        if (quantity <= 0) score = 100;
        else if (quantity <= reorderPoint * 0.25) score = 80 + (1 - quantity / (reorderPoint * 0.25)) * 20;
        else if (quantity <= reorderPoint * 0.5) score = 60 + ((reorderPoint * 0.5 - quantity) / (reorderPoint * 0.25)) * 20;
        else score = 40 + ((reorderPoint - quantity) / (reorderPoint * 0.5)) * 20;
        
        const level = scoreToLevel(score);
        const productName = item.product_name || item.sku || item.id;

        const { data: existingRisk } = await supabase
          .from('ai_risk_insights')
          .select('id')
          .eq('entity_type', 'inventory')
          .eq('entity_id', item.id)
          .eq('risk_type', 'low_stock')
          .eq('status', 'open')
          .single();

        const riskData = {
          entity_type: 'inventory',
          entity_id: item.id,
          brand: item.brand,
          risk_type: 'low_stock',
          risk_score: Math.round(score),
          risk_level: level,
          headline: quantity <= 0 
            ? `${productName} is OUT OF STOCK`
            : `${productName} low: ${quantity} units`,
          details: `Current quantity: ${quantity}. Reorder point: ${reorderPoint}.`,
          recommended_action: level === 'critical'
            ? 'Urgent: Place emergency reorder immediately'
            : level === 'high'
            ? 'Place reorder within 24 hours'
            : 'Add to next scheduled reorder',
          source_data: {
            quantity,
            reorder_point: reorderPoint,
            product_name: productName,
          },
          status: 'open',
        };

        if (existingRisk) {
          await supabase
            .from('ai_risk_insights')
            .update(riskData)
            .eq('id', existingRisk.id);
          stats.updated_risks++;
        } else {
          await supabase
            .from('ai_risk_insights')
            .insert(riskData);
          stats.new_risks++;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. AMBASSADOR INACTIVITY RISK
    // ═══════════════════════════════════════════════════════════════════════════
    
    const { data: ambassadors } = await supabase
      .from('ambassadors')
      .select(`
        id,
        user_id,
        total_earnings,
        is_active,
        created_at,
        profiles(full_name),
        ambassador_commissions(created_at)
      `)
      .eq('is_active', true);

    for (const ambassador of ambassadors || []) {
      const commissions = ambassador.ambassador_commissions || [];
      const lastCommission = commissions.length > 0
        ? commissions.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]?.created_at
        : null;
      
      const daysSinceCommission = daysSince(lastCommission);
      const totalEarnings = Number(ambassador.total_earnings) || 0;
      
      // Only flag if historically active but now inactive
      if (totalEarnings > 0 && daysSinceCommission >= 14) {
        let score = 0;
        if (daysSinceCommission >= 30) score = 70 + Math.min(30, (daysSinceCommission - 30) / 10);
        else score = 40 + ((daysSinceCommission - 14) / 16) * 30;
        
        const level = scoreToLevel(score);
        const name = ambassador.profiles && typeof ambassador.profiles === 'object' && 'full_name' in ambassador.profiles
          ? ambassador.profiles.full_name
          : 'Ambassador';

        const { data: existingRisk } = await supabase
          .from('ai_risk_insights')
          .select('id')
          .eq('entity_type', 'ambassador')
          .eq('entity_id', ambassador.id)
          .eq('risk_type', 'inactive_ambassador')
          .eq('status', 'open')
          .single();

        const riskData = {
          entity_type: 'ambassador',
          entity_id: ambassador.id,
          risk_type: 'inactive_ambassador',
          risk_score: Math.round(score),
          risk_level: level,
          headline: `${name} inactive for ${daysSinceCommission} days`,
          details: `Last commission: ${daysSinceCommission} days ago. Total earnings: $${totalEarnings.toLocaleString()}.`,
          recommended_action: level === 'critical'
            ? 'Reach out immediately to re-engage'
            : 'Schedule check-in call',
          source_data: {
            last_commission_date: lastCommission,
            days_since_commission: daysSinceCommission,
            total_earnings: totalEarnings,
            name,
          },
          status: 'open',
        };

        if (existingRisk) {
          await supabase
            .from('ai_risk_insights')
            .update(riskData)
            .eq('id', existingRisk.id);
          stats.updated_risks++;
        } else {
          await supabase
            .from('ai_risk_insights')
            .insert(riskData);
          stats.new_risks++;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. CREATE KPI SNAPSHOT
    // ═══════════════════════════════════════════════════════════════════════════
    
    const today = new Date().toISOString().split('T')[0];
    
    // Count metrics
    const { count: totalStores } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeStores } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'member']);
    
    const { count: totalInvoices } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });
    
    const { count: unpaidInvoices } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .in('status', ['sent', 'overdue', 'pending']);

    // Check if snapshot exists for today
    const { data: existingSnapshot } = await supabase
      .from('ai_kpi_snapshots')
      .select('id')
      .eq('snapshot_date', today)
      .is('brand', null)
      .is('region', null)
      .single();

    const snapshotData = {
      snapshot_date: today,
      total_stores: totalStores || 0,
      active_stores: activeStores || 0,
      inactive_stores: (totalStores || 0) - (activeStores || 0),
      total_invoices: totalInvoices || 0,
      unpaid_invoices: unpaidInvoices || 0,
      low_stock_items: lowStockCount,
    };

    if (existingSnapshot) {
      await supabase
        .from('ai_kpi_snapshots')
        .update(snapshotData)
        .eq('id', existingSnapshot.id);
    } else {
      await supabase
        .from('ai_kpi_snapshots')
        .insert(snapshotData);
    }
    stats.kpi_snapshot_created = true;

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. EXPIRE OLD RESOLVED RISKS
    // ═══════════════════════════════════════════════════════════════════════════
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await supabase
      .from('ai_risk_insights')
      .update({ expires_at: new Date().toISOString() })
      .eq('status', 'resolved')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .is('expires_at', null);

    return new Response(
      JSON.stringify({
        success: true,
        ...stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Risk scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
