// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY AUDIT LOG SERVICE — Track all inventory changes
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  id: string;
  stock_id: string | null;
  store_inventory_id: string | null;
  product_id: string | null;
  warehouse_id: string | null;
  store_id: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  quantity_delta: number | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_by_system: boolean;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  product?: { id: string; name: string; sku: string | null };
  warehouse?: { id: string; name: string; code: string | null };
  store?: { 
    id: string; 
    store_name: string; 
    address: string; 
    city: string; 
    state: string; 
    zip: string;
  };
  changed_by_profile?: { id: string; name: string; email: string };
}

export interface AuditLogFilters {
  productId?: string;
  warehouseId?: string;
  storeId?: string;
  referenceType?: string;
  fieldChanged?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export function useInventoryAuditLog(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ['inventory-audit-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('inventory_audit_log')
        .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name, code),
          store:store_master(id, store_name, address, city, state, zip),
          changed_by_profile:profiles(id, name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }
      if (filters?.warehouseId) {
        query = query.eq('warehouse_id', filters.warehouseId);
      }
      if (filters?.storeId) {
        query = query.eq('store_id', filters.storeId);
      }
      if (filters?.referenceType) {
        query = query.eq('reference_type', filters.referenceType);
      }
      if (filters?.fieldChanged) {
        query = query.eq('field_changed', filters.fieldChanged);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as unknown as AuditLogEntry[];
    },
  });
}

export function useAuditLogStats() {
  return useQuery({
    queryKey: ['audit-log-stats'],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('inventory_audit_log')
        .select('id, reference_type, created_at')
        .gte('created_at', weekAgo.toISOString());

      if (error) throw error;

      const entries = data || [];
      const byType: Record<string, number> = {};
      entries.forEach(e => {
        const type = e.reference_type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      });

      return {
        totalThisWeek: entries.length,
        byReferenceType: byType,
      };
    },
  });
}
