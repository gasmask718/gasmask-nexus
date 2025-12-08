// ═══════════════════════════════════════════════════════════════════════════════
// CENTRALIZED INVENTORY MOVEMENT HELPER
// All stock changes should go through this function
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export type MovementType = 
  | 'PO_RECEIPT'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'CORRECTION'
  | 'INITIAL_LOAD'
  | 'SALE';

export interface InventoryMovementInput {
  product_id: string;
  warehouse_id: string;
  bin_id?: string | null;
  quantity_change: number;
  movement_type: MovementType | string;
  reason?: string | null;
  reference_type?: string | null; // 'purchase_order', 'manual', 'transfer', etc.
  reference_id?: string | null;
}

export interface ApplyMovementResult {
  success: boolean;
  movement_id?: string;
  stock_id?: string;
  before_on_hand: number;
  after_on_hand: number;
  error?: string;
}

/**
 * Apply an inventory movement - updates stock levels and logs the movement
 * This should be the ONLY function used to modify stock quantities
 */
export async function applyInventoryMovement(
  input: InventoryMovementInput
): Promise<ApplyMovementResult> {
  const {
    product_id,
    warehouse_id,
    bin_id = null,
    quantity_change,
    movement_type,
    reason,
    reference_type,
    reference_id,
  } = input;

  try {
    // 1) Get current inventory stock row
    let query = supabase
      .from('inventory_stock')
      .select('*')
      .eq('product_id', product_id)
      .eq('warehouse_id', warehouse_id);

    if (bin_id) {
      query = query.eq('bin_id', bin_id);
    } else {
      query = query.is('bin_id', null);
    }

    const { data: existingStock, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch stock: ${fetchError.message}`);
    }

    const before_on_hand = existingStock?.quantity_on_hand || 0;
    const current_reserved = existingStock?.quantity_reserved || 0;
    
    // 2) Calculate new quantities
    let new_on_hand = before_on_hand + quantity_change;
    
    // Clamp to 0 if would go negative (we log it but don't allow negative stock)
    if (new_on_hand < 0) {
      console.warn(`Stock would go negative for product ${product_id}, clamping to 0`);
      new_on_hand = 0;
    }

    const new_available = Math.max(0, new_on_hand - current_reserved);

    let stock_id: string;

    // 3) Update or create inventory_stock record
    if (existingStock) {
      const { error: updateError } = await supabase
        .from('inventory_stock')
        .update({
          quantity_on_hand: new_on_hand,
          // available is derived: on_hand - reserved
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStock.id);

      if (updateError) {
        throw new Error(`Failed to update stock: ${updateError.message}`);
      }
      stock_id = existingStock.id;
    } else {
      // Create new stock record
      const { data: newStock, error: insertError } = await supabase
        .from('inventory_stock')
        .insert({
          product_id,
          warehouse_id,
          bin_id,
          quantity_on_hand: new_on_hand,
          quantity_reserved: 0,
          quantity_in_transit: 0,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create stock record: ${insertError.message}`);
      }
      stock_id = newStock.id;
    }

    // 4) Log the movement
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id,
        movement_type: movement_type,
        quantity: Math.abs(quantity_change),
        reference_type,
        reference_id,
        notes: reason,
        from_warehouse_id: quantity_change < 0 ? warehouse_id : null,
        from_bin_id: quantity_change < 0 ? bin_id : null,
        to_warehouse_id: quantity_change > 0 ? warehouse_id : null,
        to_bin_id: quantity_change > 0 ? bin_id : null,
      })
      .select()
      .single();

    if (movementError) {
      throw new Error(`Failed to log movement: ${movementError.message}`);
    }

    return {
      success: true,
      movement_id: movement.id,
      stock_id,
      before_on_hand,
      after_on_hand: new_on_hand,
    };
  } catch (error) {
    console.error('applyInventoryMovement error:', error);
    return {
      success: false,
      before_on_hand: 0,
      after_on_hand: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch apply multiple movements (useful for PO receiving with multiple items)
 */
export async function applyBatchMovements(
  movements: InventoryMovementInput[]
): Promise<{ success: boolean; results: ApplyMovementResult[] }> {
  const results: ApplyMovementResult[] = [];
  
  for (const movement of movements) {
    const result = await applyInventoryMovement(movement);
    results.push(result);
  }

  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}
