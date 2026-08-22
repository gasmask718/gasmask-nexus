/**
 * useAmbassadorBoxRequests — Ambassador stock request queue.
 *
 * Requests live in the EXISTING purchase tables, not a parallel table:
 *   ambassador_purchases row with status='requested', order_source='ambassador_request'
 *   + ambassador_purchase_items rows priced at 0 until an admin approves.
 * Approve = stamp the live wholesale price onto the item and flip the purchase
 * to 'draft' (entering the normal admin order flow). Decline = status 'declined'
 * + decline_reason (visible to the ambassador).
 *
 * RLS: ambassadors insert only their own 'requested' rows and see only their
 * own purchases; admin/owner see and update all.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type BoxRequestStatus = 'pending' | 'approved' | 'declined';

export interface AmbassadorBoxRequest {
  id: string;
  ambassador_id: string | null;
  ambassador_user_id: string;
  item_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  note: string | null;
  status: BoxRequestStatus;
  decline_reason: string | null;
  created_at: string;
  ambassador_name?: string | null;
}

const KEY = 'ambassador-box-requests';

function mapPurchase(p: any): AmbassadorBoxRequest {
  const items = p.ambassador_purchase_items || [];
  const first = items[0] || null;
  return {
    id: p.id,
    ambassador_id: p.ambassador_id ?? null,
    ambassador_user_id: p.ambassador_user_id,
    item_id: first?.id ?? null,
    product_id: first?.product_id ?? null,
    product_name: first?.product_name_snapshot ?? 'Boxes',
    quantity: items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
    note: p.notes ?? null,
    status: p.status === 'requested' ? 'pending' : p.status === 'declined' ? 'declined' : 'approved',
    decline_reason: p.decline_reason ?? null,
    created_at: p.created_at,
  };
}

export function useMyBoxRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'mine', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('ambassador_purchases')
        .select('*, ambassador_purchase_items(*)')
        .eq('ambassador_user_id', user.id)
        .eq('order_source', 'ambassador_request')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapPurchase);
    },
    enabled: !!user?.id,
  });
}

export function useAllBoxRequests() {
  return useQuery({
    queryKey: [KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_purchases')
        .select('*, ambassador_purchase_items(*)')
        .eq('order_source', 'ambassador_request')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []).map(mapPurchase);

      const ids = [...new Set(rows.map(r => r.ambassador_id).filter(Boolean))] as string[];
      let names: Record<string, string | null> = {};
      if (ids.length > 0) {
        const { data: ambs, error: ambErr } = await supabase
          .from('ambassadors')
          .select('id, name')
          .in('id', ids);
        if (ambErr) throw ambErr;
        names = Object.fromEntries((ambs || []).map(a => [a.id, a.name]));
      }
      return rows.map(r => ({
        ...r,
        ambassador_name: r.ambassador_id ? names[r.ambassador_id] ?? null : null,
      }));
    },
  });
}

export function useCreateBoxRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { product_id: string; product_name: string; quantity: number; note?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!input.quantity || input.quantity < 1) throw new Error('Quantity must be at least 1');

      const { data: amb, error: ambErr } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (ambErr) throw ambErr;
      if (!amb) throw new Error('No active ambassador profile found');

      // Un-priced request row — admin sets the real price at approval time.
      const { data: purchase, error: pErr } = await supabase
        .from('ambassador_purchases')
        .insert({
          ambassador_user_id: user.id,
          ambassador_id: amb.id,
          order_source: 'ambassador_request',
          status: 'requested',
          created_by_user_id: user.id,
          created_for_user_id: user.id,
          notes: input.note || null,
          subtotal: 0,
          tax: 0,
          discount_total: 0,
          total: 0,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      const { error: iErr } = await supabase
        .from('ambassador_purchase_items')
        .insert({
          purchase_id: purchase.id,
          product_id: input.product_id,
          product_name_snapshot: input.product_name,
          unit_price_snapshot: 0,
          quantity: input.quantity,
          line_total: 0,
        });
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast.success('Request submitted — an admin will review it');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReviewBoxRequest() {
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: async (request: AmbassadorBoxRequest) => {
      // Price from the live catalog at approval time (wholesale first)
      let unit = 0;
      if (request.product_id) {
        const { data: p } = await supabase
          .from('products')
          .select('wholesale_price, store_price')
          .eq('id', request.product_id)
          .maybeSingle();
        unit = Number(p?.wholesale_price ?? p?.store_price ?? 0);
      }
      const subtotal = unit * request.quantity;

      if (request.item_id) {
        const { error: iErr } = await supabase
          .from('ambassador_purchase_items')
          .update({ unit_price_snapshot: unit, line_total: subtotal })
          .eq('id', request.item_id);
        if (iErr) throw iErr;
      }

      // Flip into the normal admin order flow as a draft
      const { data: purchase, error: pErr } = await supabase
        .from('ambassador_purchases')
        .update({ status: 'draft', subtotal, total: subtotal })
        .eq('id', request.id)
        .select()
        .single();
      if (pErr) throw pErr;

      return purchase;
    },
    onSuccess: (purchase: any) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchase-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-outstanding-balances'] });
      toast.success('Request approved — order created', {
        description: purchase?.order_number ? `Order ${purchase.order_number}` : undefined,
      });
    },
    onError: (err: Error) => toast.error(`Approve failed: ${err.message}`),
  });

  const decline = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      if (!reason.trim()) throw new Error('A reason is required when declining');

      const { error } = await supabase
        .from('ambassador_purchases')
        .update({ status: 'declined', decline_reason: reason.trim() })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-outstanding-balances'] });
      toast.success('Request declined');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { approve, decline };
}
