import { supabase } from '@/integrations/supabase/client';

export type InventoryForecast = {
  id: string;
  business_id: string | null;
  product_id: string;
  warehouse_id: string;
  horizon_days: number;
  avg_daily_usage: number | null;
  forecast_demand: number | null;
  projected_runout_date: string | null;
  days_until_runout: number | null;
  risk_level: string | null;
  risk_reason: string | null;
  suggestion: string | null;
  calculated_at: string;
  // Joined fields
  product_name?: string;
  sku?: string;
  warehouse_name?: string;
  available?: number;
  on_hand?: number;
  lead_time?: number;
};

export type InventoryRiskFlag = {
  id: string;
  business_id: string | null;
  product_id: string;
  warehouse_id: string;
  flag_type: string;
  severity: string;
  message: string;
  days_without_movement: number | null;
  last_movement_at: string | null;
  created_at: string;
  // Joined fields
  product_name?: string;
  sku?: string;
  warehouse_name?: string;
  on_hand?: number;
  available?: number;
  forecast_demand?: number;
};

type RecalculateParams = {
  businessId?: string;
  warehouseId?: string;
  horizonDays?: number;
  historyDays?: number;
};

/**
 * Calculate and store inventory insights including forecasts and risk flags.
 * This is a rule-based engine that will be upgraded to AI in future versions.
 * 
 * TODO (Inventory AI V2):
 * - Use AI/ML model to improve demand forecasting instead of simple averages
 * - Generate natural-language risk_reason and suggestion using AI
 * - Detect cross-product patterns (brand-level slowdown, etc.)
 */
export async function recalculateInventoryInsights(params: RecalculateParams = {}) {
  const { 
    businessId, 
    warehouseId, 
    horizonDays = 30, 
    historyDays = 60 
  } = params;

  try {
    // 1) Fetch inventory_stock joined with products & warehouses
    // Using correct column names: quantity_on_hand, quantity_reserved
    let levelsQuery = supabase
      .from('inventory_stock')
      .select(`
        id,
        business_id,
        product_id,
        warehouse_id,
        quantity_on_hand,
        quantity_reserved,
        reorder_point,
        products (id, name, sku, brand),
        warehouses (id, name)
      `);

    if (businessId) {
      levelsQuery = levelsQuery.eq('business_id', businessId);
    }
    if (warehouseId) {
      levelsQuery = levelsQuery.eq('warehouse_id', warehouseId);
    }

    const { data: levels, error: levelsError } = await levelsQuery;
    if (levelsError) throw levelsError;

    if (!levels || levels.length === 0) {
      return { success: true, message: 'No inventory levels to analyze', forecasts: 0, flags: 0 };
    }

    // 2) Get movement history for last N days
    // Using correct columns: quantity, to_warehouse_id
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - historyDays);

    const { data: movements, error: movementsError } = await supabase
      .from('inventory_movements')
      .select('product_id, to_warehouse_id, from_warehouse_id, quantity, movement_type, created_at')
      .gte('created_at', historyStart.toISOString());

    if (movementsError) throw movementsError;

    // Build movement aggregates by product+warehouse
    // Track outbound (from_warehouse) for each product+warehouse combo
    const movementMap = new Map<string, { outbound: number; lastMovement: Date | null }>();
    
    (movements || []).forEach((m: any) => {
      // Track outbound from each warehouse
      if (m.from_warehouse_id && m.quantity) {
        const key = `${m.product_id}|${m.from_warehouse_id}`;
        const existing = movementMap.get(key) || { outbound: 0, lastMovement: null };
        existing.outbound += Math.abs(m.quantity);
        
        const movementDate = new Date(m.created_at);
        if (!existing.lastMovement || movementDate > existing.lastMovement) {
          existing.lastMovement = movementDate;
        }
        
        movementMap.set(key, existing);
      }
      
      // Also track inbound movements for last movement date
      if (m.to_warehouse_id) {
        const key = `${m.product_id}|${m.to_warehouse_id}`;
        const existing = movementMap.get(key) || { outbound: 0, lastMovement: null };
        
        const movementDate = new Date(m.created_at);
        if (!existing.lastMovement || movementDate > existing.lastMovement) {
          existing.lastMovement = movementDate;
        }
        
        movementMap.set(key, existing);
      }
    });

    // 3) Get supplier lead times from supplier_products
    // Note: supplier_products doesn't have product_id, it links via name/sku
    // For V1, use a default lead time
    const DEFAULT_LEAD_TIME = 10;
    const leadTimeMap = new Map<string, number>();

    // 4) Calculate forecasts and flags
    const forecasts: any[] = [];
    const riskFlags: any[] = [];

    for (const level of levels as any[]) {
      const key = `${level.product_id}|${level.warehouse_id}`;
      const movementData = movementMap.get(key) || { outbound: 0, lastMovement: null };
      const leadTime = leadTimeMap.get(level.product_id) || DEFAULT_LEAD_TIME;
      
      const onHand = level.quantity_on_hand || 0;
      const reserved = level.quantity_reserved || 0;
      const available = onHand - reserved;
      
      const avgDailyUsage = movementData.outbound > 0 
        ? movementData.outbound / historyDays 
        : 0;
      
      const forecastDemand = avgDailyUsage * horizonDays;
      
      let daysUntilRunout: number | null = null;
      let projectedRunoutDate: string | null = null;
      
      if (avgDailyUsage > 0) {
        daysUntilRunout = Math.floor(available / avgDailyUsage);
        const runoutDate = new Date();
        runoutDate.setDate(runoutDate.getDate() + daysUntilRunout);
        projectedRunoutDate = runoutDate.toISOString().split('T')[0];
      }

      // Determine risk level based on days until runout vs lead time
      let riskLevel = 'low';
      let riskReason = 'Stock levels appear healthy.';
      let suggestion = 'Continue monitoring.';

      if (avgDailyUsage > 0 && daysUntilRunout !== null) {
        if (daysUntilRunout <= leadTime) {
          riskLevel = 'critical';
          riskReason = `Current stock covers only ${daysUntilRunout} days, but lead time is ${leadTime} days. Stockout imminent.`;
          suggestion = 'Create PO for this SKU immediately.';
        } else if (daysUntilRunout <= leadTime + 7) {
          riskLevel = 'high';
          riskReason = `Stock covers ${daysUntilRunout} days with ${leadTime} day lead time. Buffer is thin.`;
          suggestion = 'Prioritize reorder for this SKU within the week.';
        } else if (daysUntilRunout <= leadTime + 21) {
          riskLevel = 'medium';
          riskReason = `Stock covers ${daysUntilRunout} days. Approaching reorder point.`;
          suggestion = 'Plan reorder in the next 2 weeks.';
        } else {
          riskLevel = 'low';
          riskReason = `Stock covers ${daysUntilRunout} days. Well above safety threshold.`;
          suggestion = 'No immediate action needed.';
        }
      } else if (avgDailyUsage === 0 && available > 0) {
        riskLevel = 'low';
        riskReason = 'No recent outbound movement. Usage pattern unclear.';
        suggestion = 'Monitor for movement or check if product is active.';
      } else if (available <= 0) {
        riskLevel = 'critical';
        riskReason = 'Product is out of stock.';
        suggestion = 'Urgent: Create PO immediately if product is still needed.';
      }

      forecasts.push({
        business_id: level.business_id,
        product_id: level.product_id,
        warehouse_id: level.warehouse_id,
        horizon_days: horizonDays,
        avg_daily_usage: avgDailyUsage,
        forecast_demand: forecastDemand,
        projected_runout_date: projectedRunoutDate,
        days_until_runout: daysUntilRunout,
        risk_level: riskLevel,
        risk_reason: riskReason,
        suggestion: suggestion,
        metadata: { lead_time: leadTime, history_days: historyDays, available, on_hand: onHand },
        calculated_at: new Date().toISOString(),
      });

      // Check for dead stock and overstock flags
      const now = new Date();
      const lastMovement = movementData.lastMovement;
      const daysSinceLastMovement = lastMovement 
        ? Math.floor((now.getTime() - lastMovement.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Dead stock: no movement in 90+ days with stock on hand
      if (onHand > 0 && daysSinceLastMovement !== null && daysSinceLastMovement >= 90) {
        const severity = daysSinceLastMovement >= 180 ? 'critical' : 'high';
        riskFlags.push({
          business_id: level.business_id,
          product_id: level.product_id,
          warehouse_id: level.warehouse_id,
          flag_type: 'DEAD_STOCK',
          severity,
          message: `No movement in ${daysSinceLastMovement} days. Consider discounting, bundling, or returning to supplier.`,
          days_without_movement: daysSinceLastMovement,
          last_movement_at: lastMovement?.toISOString() || null,
        });
      }

      // Overstock: available > 2x forecast demand
      if (avgDailyUsage > 0 && forecastDemand > 0 && available > forecastDemand * 2) {
        const overstockRatio = (available / forecastDemand).toFixed(1);
        const severity = available > forecastDemand * 4 ? 'high' : 'medium';
        riskFlags.push({
          business_id: level.business_id,
          product_id: level.product_id,
          warehouse_id: level.warehouse_id,
          flag_type: 'OVERSTOCK',
          severity,
          message: `Stock level is ${overstockRatio}× the next ${horizonDays} days' forecast demand. Consider reducing future orders.`,
          days_without_movement: daysSinceLastMovement,
          last_movement_at: lastMovement?.toISOString() || null,
        });
      }
    }

    // 5) Clear old forecasts and flags, then insert new ones
    // Delete existing forecasts for the scope we're recalculating
    let deleteForecasts = supabase.from('inventory_forecasts').delete();
    let deleteFlags = supabase.from('inventory_risk_flags').delete();
    
    if (businessId) {
      deleteForecasts = deleteForecasts.eq('business_id', businessId);
      deleteFlags = deleteFlags.eq('business_id', businessId);
    }
    if (warehouseId) {
      deleteForecasts = deleteForecasts.eq('warehouse_id', warehouseId);
      deleteFlags = deleteFlags.eq('warehouse_id', warehouseId);
    }
    
    // Need to add a condition to make delete work (Supabase requires a filter)
    deleteForecasts = deleteForecasts.neq('id', '00000000-0000-0000-0000-000000000000');
    deleteFlags = deleteFlags.neq('id', '00000000-0000-0000-0000-000000000000');

    await deleteForecasts;
    await deleteFlags;

    // Insert new forecasts
    if (forecasts.length > 0) {
      const { error: insertError } = await supabase
        .from('inventory_forecasts')
        .insert(forecasts);
      if (insertError) throw insertError;
    }

    // Insert new flags
    if (riskFlags.length > 0) {
      const { error: flagError } = await supabase
        .from('inventory_risk_flags')
        .insert(riskFlags);
      if (flagError) throw flagError;
    }

    return { 
      success: true, 
      message: 'Insights recalculated successfully',
      forecasts: forecasts.length,
      flags: riskFlags.length,
    };

  } catch (error) {
    console.error('Error calculating inventory insights:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
      forecasts: 0,
      flags: 0,
    };
  }
}

/**
 * Fetch inventory forecasts with joined product/warehouse data
 */
export async function fetchInventoryForecasts(params: {
  businessId?: string;
  warehouseId?: string;
  riskLevel?: string;
  searchTerm?: string;
}) {
  const { businessId, warehouseId, riskLevel, searchTerm } = params;

  let query = supabase
    .from('inventory_forecasts')
    .select(`
      *,
      products (id, name, sku, brand),
      warehouses (id, name)
    `)
    .order('risk_level', { ascending: true })
    .order('days_until_runout', { ascending: true, nullsFirst: false });

  if (businessId) {
    query = query.eq('business_id', businessId);
  }
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }
  if (riskLevel && riskLevel !== 'all') {
    query = query.eq('risk_level', riskLevel);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform and filter by search term if needed
  let results = (data || []).map((f: any) => ({
    ...f,
    product_name: f.products?.name || 'Unknown',
    sku: f.products?.sku || '',
    warehouse_name: f.warehouses?.name || 'Unknown',
  }));

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    results = results.filter((r: any) => 
      r.product_name.toLowerCase().includes(term) ||
      r.sku.toLowerCase().includes(term)
    );
  }

  return results;
}

/**
 * Fetch inventory risk flags with joined data
 */
export async function fetchInventoryRiskFlags(params: {
  businessId?: string;
  warehouseId?: string;
  flagType?: string;
}) {
  const { businessId, warehouseId, flagType } = params;

  let query = supabase
    .from('inventory_risk_flags')
    .select(`
      *,
      products (id, name, sku),
      warehouses (id, name)
    `)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false });

  if (businessId) {
    query = query.eq('business_id', businessId);
  }
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }
  if (flagType) {
    query = query.eq('flag_type', flagType);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((f: any) => ({
    ...f,
    product_name: f.products?.name || 'Unknown',
    sku: f.products?.sku || '',
    warehouse_name: f.warehouses?.name || 'Unknown',
  }));
}

/**
 * Get insight summary counts for dashboard
 */
export async function getInsightsSummary(businessId?: string) {
  try {
    // Get at-risk count
    let atRiskQuery = supabase
      .from('inventory_forecasts')
      .select('id', { count: 'exact', head: true })
      .in('risk_level', ['high', 'critical']);
    
    if (businessId) {
      atRiskQuery = atRiskQuery.eq('business_id', businessId);
    }
    
    const { count: atRiskCount } = await atRiskQuery;

    // Get dead stock count
    let deadStockQuery = supabase
      .from('inventory_risk_flags')
      .select('id', { count: 'exact', head: true })
      .eq('flag_type', 'DEAD_STOCK');
    
    if (businessId) {
      deadStockQuery = deadStockQuery.eq('business_id', businessId);
    }
    
    const { count: deadStockCount } = await deadStockQuery;

    // Get overstock count
    let overstockQuery = supabase
      .from('inventory_risk_flags')
      .select('id', { count: 'exact', head: true })
      .eq('flag_type', 'OVERSTOCK');
    
    if (businessId) {
      overstockQuery = overstockQuery.eq('business_id', businessId);
    }
    
    const { count: overstockCount } = await overstockQuery;

    return {
      atRiskCount: atRiskCount || 0,
      deadStockCount: deadStockCount || 0,
      overstockCount: overstockCount || 0,
    };
  } catch (error) {
    console.error('Error fetching insights summary:', error);
    return {
      atRiskCount: 0,
      deadStockCount: 0,
      overstockCount: 0,
    };
  }
}
