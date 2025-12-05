// ═══════════════════════════════════════════════════════════════════════════════
// STORE AI INSIGHTS SERVICE — Predictive intelligence for Customer Memory Core V3
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface TimelineChapter {
  phase: string;
  summary: string;
  from: string | null;
  to: string | null;
}

export interface StoreAIInsights {
  id: string;
  store_id: string;
  snapshot_date: string;
  next_order_date: string | null;
  next_order_confidence: number | null;
  next_order_summary: string | null;
  mood_state: string | null;
  relationship_phase: string | null;
  relationship_trend: string | null;
  risk_score: number | null;
  loyalty_score: number | null;
  health_score: number | null;
  influence_score: number | null;
  ltv_12m_low: number | null;
  ltv_12m_expected: number | null;
  ltv_12m_high: number | null;
  buying_style: string | null;
  personality_archetype: string | null;
  next_best_action: string | null;
  early_warning_flags: string[];
  opportunity_flags: string[];
  timeline_chapters: TimelineChapter[];
  created_at: string;
  updated_at: string;
}

/**
 * Get the latest AI insights for a store
 */
export async function getStoreInsights(storeId: string): Promise<StoreAIInsights | null> {
  try {
    // Use any to avoid deep type instantiation issues
    const result = await (supabase as any)
      .from('store_ai_insights')
      .select('*')
      .eq('store_id', storeId)
      .order('snapshot_date', { ascending: false })
      .limit(1);
    
    const { data, error } = result;

    if (error) {
      console.error('[StoreInsights] Error fetching insights:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0] as any;

    return {
      id: row.id,
      store_id: row.store_id,
      snapshot_date: row.snapshot_date,
      next_order_date: row.next_order_date,
      next_order_confidence: row.next_order_confidence,
      next_order_summary: row.next_order_summary,
      mood_state: row.mood_state,
      relationship_phase: row.relationship_phase,
      relationship_trend: row.relationship_trend,
      risk_score: row.risk_score,
      loyalty_score: row.loyalty_score,
      health_score: row.health_score,
      influence_score: row.influence_score,
      ltv_12m_low: row.ltv_12m_low,
      ltv_12m_expected: row.ltv_12m_expected,
      ltv_12m_high: row.ltv_12m_high,
      buying_style: row.buying_style,
      personality_archetype: row.personality_archetype,
      next_best_action: row.next_best_action,
      early_warning_flags: Array.isArray(row.early_warning_flags) ? row.early_warning_flags : [],
      opportunity_flags: Array.isArray(row.opportunity_flags) ? row.opportunity_flags : [],
      timeline_chapters: Array.isArray(row.timeline_chapters) ? row.timeline_chapters : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (e) {
    console.error('[StoreInsights] Error:', e);
    return null;
  }
}

/**
 * Refresh AI insights for a store by calling the edge function
 */
export async function refreshStoreInsights(storeId: string): Promise<{
  success: boolean;
  insights?: StoreAIInsights;
  error?: string;
}> {
  try {
    // Fetch store details
    const { data: storeData, error: storeError } = await supabase
      .from('store_master')
      .select('*')
      .eq('id', storeId)
      .limit(1);

    if (storeError || !storeData || storeData.length === 0) {
      return { success: false, error: 'Store not found' };
    }

    const store = storeData[0] as any;

    // Fetch contact interactions (notes)
    const { data: interactionsData } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100);

    const interactions = (interactionsData || []) as any[];

    // Fetch orders (wholesale_orders)
    const { data: ordersData } = await supabase
      .from('wholesale_orders')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(50);

    const orders = (ordersData || []) as any[];

    // Fetch invoices (store_payments as invoices proxy)
    const { data: invoicesData } = await supabase
      .from('store_payments')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(50);

    const invoices = (invoicesData || []) as any[];

    // Concatenate notes
    const notesArray = interactions
      .map((i) => `${i.interaction_type || 'Note'}: ${i.notes || i.summary || ''}`)
      .filter(Boolean);
    const notesText = notesArray.join('\n\n');

    // Compute basic metrics
    const totalOrders = orders.length;
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0);
    
    const metrics = {
      totalOrders,
      totalInvoices,
      totalRevenue,
      averageOrderValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
    };

    // Call edge function
    const { data, error } = await supabase.functions.invoke('ai-store-insights', {
      body: {
        storeId,
        storeName: store.store_name || 'Unknown Store',
        notes: notesText,
        orders: orders.slice(0, 20).map((o) => ({
          id: o.id,
          total: o.total_amount,
          status: o.status,
          brand: o.brand,
          created_at: o.created_at,
        })),
        invoices: invoices.slice(0, 20).map((i) => ({
          id: i.id,
          total: i.owed_amount,
          paid: i.paid_amount,
          status: i.payment_status,
          date: i.created_at,
        })),
        interactions: interactions.slice(0, 30).map((i) => ({
          type: i.interaction_type,
          notes: i.notes,
          date: i.created_at,
        })),
        metrics,
      }
    });

    if (error) {
      console.error('[StoreInsights] Edge function error:', error);
      return { success: false, error: error.message };
    }

    if (data?.success && data?.insights) {
      // Fetch the latest saved insight
      const latestInsight = await getStoreInsights(storeId);
      return { success: true, insights: latestInsight || undefined };
    }

    return { success: false, error: data?.error || 'Unknown error' };
  } catch (e: any) {
    console.error('[StoreInsights] Refresh error:', e);
    return { success: false, error: e.message };
  }
}
