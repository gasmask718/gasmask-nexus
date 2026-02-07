/**
 * Ambassador Purchase Ledger Hooks
 * useAmbassadorPurchaseHistory - full purchase list with filters
 * useAmbassadorPurchaseSummary - KPI summary (one row per ambassador)
 * useCreateAmbassadorPurchase - mutation to create order
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AmbassadorPurchase {
  id: string;
  order_number: string;
  ambassador_user_id: string;
  ambassador_id: string | null;
  status: string;
  order_source: string;
  created_by_user_id: string;
  created_for_user_id: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount_total: number;
  total: number;
  paid_at: string | null;
  fulfilled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorPurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface PurchaseSummary {
  ambassador_user_id: string;
  ambassador_id: string | null;
  ambassador_name: string;
  purchase_count: number;
  lifetime_spend: number;
  last_purchase_at: string | null;
  avg_order_value: number;
  days_since_last_purchase: number | null;
}

export interface PurchaseWithItems extends AmbassadorPurchase {
  items: AmbassadorPurchaseItem[];
  ambassador_name?: string;
}

export interface PurchaseFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  minTotal?: number;
  maxTotal?: number;
  search?: string;
}

export interface CreatePurchaseInput {
  ambassador_user_id: string;
  ambassador_id?: string;
  order_source?: string;
  notes?: string;
  status?: string;
  items: {
    product_id?: string;
    product_name_snapshot: string;
    unit_price_snapshot: number;
    quantity: number;
  }[];
  discount_total?: number;
  tax?: number;
}

// ─── Hook: Purchase History ──────────────────────────────────────────────────

export function useAmbassadorPurchaseHistory(
  ambassadorUserId?: string,
  filters?: PurchaseFilters
) {
  return useQuery({
    queryKey: ['ambassador-purchases', ambassadorUserId, filters],
    queryFn: async () => {
      let query = supabase
        .from('ambassador_purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (ambassadorUserId) {
        query = query.eq('ambassador_user_id', ambassadorUserId);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters?.minTotal) {
        query = query.gte('total', filters.minTotal);
      }

      if (filters?.maxTotal) {
        query = query.lte('total', filters.maxTotal);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch items for all purchases
      if (data && data.length > 0) {
        const purchaseIds = data.map(p => p.id);
        const { data: items, error: itemsError } = await supabase
          .from('ambassador_purchase_items')
          .select('*')
          .in('purchase_id', purchaseIds);

        if (itemsError) throw itemsError;

        const itemsByPurchase = (items || []).reduce((acc, item) => {
          if (!acc[item.purchase_id]) acc[item.purchase_id] = [];
          acc[item.purchase_id].push(item);
          return acc;
        }, {} as Record<string, AmbassadorPurchaseItem[]>);

        return data.map(purchase => ({
          ...purchase,
          items: itemsByPurchase[purchase.id] || [],
        })) as PurchaseWithItems[];
      }

      return (data || []).map(p => ({ ...p, items: [] })) as PurchaseWithItems[];
    },
  });
}

// ─── Hook: My Purchases (for ambassador portal) ─────────────────────────────

export function useMyPurchases(filters?: PurchaseFilters) {
  const { user } = useAuth();
  return useAmbassadorPurchaseHistory(user?.id, filters);
}

// ─── Hook: Purchase Summary ─────────────────────────────────────────────────

export function useAmbassadorPurchaseSummary(ambassadorUserId?: string) {
  return useQuery({
    queryKey: ['ambassador-purchase-summary', ambassadorUserId],
    queryFn: async () => {
      let query = supabase
        .from('v_ambassador_purchase_summary' as any)
        .select('*');

      if (ambassadorUserId) {
        query = query.eq('ambassador_user_id', ambassadorUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (ambassadorUserId && data && data.length > 0) {
        return data[0] as unknown as PurchaseSummary;
      }

      return data as unknown as PurchaseSummary[];
    },
    enabled: ambassadorUserId ? !!ambassadorUserId : true,
  });
}

// ─── Hook: Single Purchase Detail ───────────────────────────────────────────

export function useAmbassadorPurchaseDetail(purchaseId?: string) {
  return useQuery({
    queryKey: ['ambassador-purchase-detail', purchaseId],
    queryFn: async () => {
      if (!purchaseId) return null;

      const { data: purchase, error } = await supabase
        .from('ambassador_purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();

      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from('ambassador_purchase_items')
        .select('*')
        .eq('purchase_id', purchaseId);

      if (itemsError) throw itemsError;

      return {
        ...purchase,
        items: items || [],
      } as PurchaseWithItems;
    },
    enabled: !!purchaseId,
  });
}

// ─── Mutation: Create Purchase ──────────────────────────────────────────────

export function useCreateAmbassadorPurchase() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePurchaseInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Calculate totals
      const subtotal = input.items.reduce(
        (sum, item) => sum + item.unit_price_snapshot * item.quantity,
        0
      );
      const tax = input.tax || 0;
      const discount = input.discount_total || 0;
      const total = subtotal + tax - discount;

      // Insert purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('ambassador_purchases')
        .insert({
          ambassador_user_id: input.ambassador_user_id,
          ambassador_id: input.ambassador_id || null,
          order_source: input.order_source || 'admin_backoffice',
          status: input.status || 'draft',
          created_by_user_id: user.id,
          created_for_user_id: input.ambassador_user_id,
          notes: input.notes || null,
          subtotal,
          tax,
          discount_total: discount,
          total,
          paid_at: input.status === 'paid' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert line items
      const lineItems = input.items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id || null,
        product_name_snapshot: item.product_name_snapshot,
        unit_price_snapshot: item.unit_price_snapshot,
        quantity: item.quantity,
        line_total: item.unit_price_snapshot * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('ambassador_purchase_items')
        .insert(lineItems);

      if (itemsError) throw itemsError;

      return purchase;
    },
    onSuccess: (data) => {
      toast.success('Order created successfully', {
        description: `Order ${data.order_number} has been created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchase-summary'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create order', {
        description: error.message,
      });
    },
  });
}

// ─── Mutation: Update Purchase Status ───────────────────────────────────────

export function useUpdatePurchaseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      purchaseId,
      status,
    }: {
      purchaseId: string;
      status: string;
    }) => {
      const updateData: Record<string, any> = { status };
      if (status === 'paid') updateData.paid_at = new Date().toISOString();
      if (status === 'fulfilled') updateData.fulfilled_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('ambassador_purchases')
        .update(updateData)
        .eq('id', purchaseId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchase-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchase-detail'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update status', { description: error.message });
    },
  });
}
