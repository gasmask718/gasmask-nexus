import { supabase } from "@/integrations/supabase/client";

export type ReorderSuggestion = {
  product_id: string;
  warehouse_id: string;
  supplier_id: string | null;
  business_id: string | null;
  
  product_name: string;
  sku: string;
  brand_name: string | null;
  warehouse_name: string;
  supplier_name: string | null;
  
  available: number;
  on_hand: number;
  reorder_point: number | null;
  safety_stock: number | null;
  
  suggested_qty: number;
  unit_cost: number | null;
  line_total: number | null;
  
  policy_source: 'product_defaults' | 'policy_override' | 'fallback';
};

interface CalculateParams {
  businessId?: string;
  warehouseId?: string;
}

export async function calculateReorderSuggestions(params: CalculateParams): Promise<ReorderSuggestion[]> {
  const { businessId, warehouseId } = params;

  // Fetch inventory stock
  let query = supabase
    .from('inventory_stock')
    .select('id, product_id, warehouse_id, quantity_on_hand, quantity_reserved, reorder_point, business_id');

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data: stockData, error: stockError } = await query;

  if (stockError || !stockData || stockData.length === 0) {
    return [];
  }

  // Fetch products
  const productIds = [...new Set(stockData.map(s => s.product_id).filter(Boolean))] as string[];
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, reorder_point, reorder_qty, safety_stock, brand_id, cost')
    .in('id', productIds);

  // Fetch warehouses
  const warehouseIds = [...new Set(stockData.map(s => s.warehouse_id).filter(Boolean))] as string[];
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id, name, business_id')
    .in('id', warehouseIds);

  // Fetch brands
  const brandIds = [...new Set(products?.map(p => p.brand_id).filter(Boolean) || [])] as string[];
  const { data: brands } = brandIds.length > 0 
    ? await supabase.from('brands').select('id, name').in('id', brandIds)
    : { data: [] };

  // Fetch reorder policies
  const { data: policies } = await supabase.from('reorder_policies').select('*');

  const suggestions: ReorderSuggestion[] = [];

  for (const stock of stockData) {
    if (!stock.product_id || !stock.warehouse_id) continue;

    const product = products?.find(p => p.id === stock.product_id);
    const warehouse = warehouses?.find(w => w.id === stock.warehouse_id);
    if (!product || !warehouse) continue;

    if (businessId && warehouse.business_id !== businessId) continue;

    const onHand = stock.quantity_on_hand || 0;
    const reserved = stock.quantity_reserved || 0;
    const available = onHand - reserved;

    const policy = policies?.find(p => 
      p.product_id === stock.product_id && 
      (p.warehouse_id === stock.warehouse_id || p.warehouse_id === null)
    );

    let reorderPoint = stock.reorder_point || product.reorder_point || null;
    let safetyStock = product.safety_stock || 0;
    let reorderQty = product.reorder_qty || 0;
    let policySource: 'product_defaults' | 'policy_override' | 'fallback' = 'product_defaults';

    if (policy) {
      policySource = 'policy_override';
      if (policy.min_reorder_qty) reorderQty = Math.max(reorderQty, policy.min_reorder_qty);
    }

    if (reorderPoint === null && safetyStock > 0) {
      reorderPoint = safetyStock;
      policySource = 'fallback';
    }

    if (reorderPoint === null || available > reorderPoint) continue;

    const targetStock = reorderPoint + safetyStock;
    let suggestedQty = Math.max(reorderQty, targetStock - available);

    if (policy) {
      if (policy.min_reorder_qty && suggestedQty < policy.min_reorder_qty) suggestedQty = policy.min_reorder_qty;
      if (policy.max_reorder_qty && suggestedQty > policy.max_reorder_qty) suggestedQty = policy.max_reorder_qty;
      if (policy.reorder_multiple && policy.reorder_multiple > 1) {
        suggestedQty = Math.ceil(suggestedQty / policy.reorder_multiple) * policy.reorder_multiple;
      }
    }

    suggestedQty = Math.max(0, suggestedQty);
    if (suggestedQty === 0) continue;

    const brand = product.brand_id ? brands?.find(b => b.id === product.brand_id) : null;
    const unitCost = product.cost || null;

    suggestions.push({
      product_id: stock.product_id,
      warehouse_id: stock.warehouse_id,
      supplier_id: null, // No direct supplier link on products
      business_id: warehouse.business_id,
      product_name: product.name,
      sku: product.sku || '',
      brand_name: brand?.name || null,
      warehouse_name: warehouse.name,
      supplier_name: null,
      available,
      on_hand: onHand,
      reorder_point: reorderPoint,
      safety_stock: safetyStock,
      suggested_qty: suggestedQty,
      unit_cost: unitCost,
      line_total: unitCost ? suggestedQty * unitCost : null,
      policy_source: policySource,
    });
  }

  suggestions.sort((a, b) => a.available - b.available);
  return suggestions;
}

export async function generateDraftPOsFromSuggestions(
  suggestions: ReorderSuggestion[]
): Promise<{ success: boolean; poCount: number; poIds: string[] }> {
  // For now, group by warehouse since we don't have supplier links
  const groups = new Map<string, ReorderSuggestion[]>();
  
  for (const suggestion of suggestions) {
    const key = `${suggestion.warehouse_id}|${suggestion.business_id || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(suggestion);
  }

  const createdPoIds: string[] = [];

  for (const [key, items] of groups) {
    const [warehouseId, businessId] = key.split('|');
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    const poNumber = `PO-${year}-${timestamp}`;
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        business_id: businessId || null,
        warehouse_id: warehouseId,
        po_number: poNumber,
        status: 'draft',
        currency: 'USD',
        subtotal,
        total_cost: subtotal,
      })
      .select('id')
      .single();

    if (poError || !po) continue;

    const lineItems = items.map(item => ({
      purchase_order_id: po.id,
      product_id: item.product_id,
      quantity: item.suggested_qty,
      unit_cost: item.unit_cost,
      line_total: item.line_total,
      received_quantity: 0,
    }));

    await supabase.from('purchase_order_items').insert(lineItems);
    createdPoIds.push(po.id);
  }

  return { success: createdPoIds.length > 0, poCount: createdPoIds.length, poIds: createdPoIds };
}
