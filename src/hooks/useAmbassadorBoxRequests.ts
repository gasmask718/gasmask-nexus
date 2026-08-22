/**
 * useAmbassadorBoxRequests — Ambassador stock request queue.
 * Ambassadors request boxes by product; admins approve (creates a purchase
 * exactly like the admin-initiated flow) or decline with a reason.
 * RLS: ambassadors see/create only their own; admin/owner see and review all.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type BoxRequestStatus = 'pending' | 'approved' | 'declined';

export interface AmbassadorBoxRequest {
  id: string;
  ambassador_id: string;
  ambassador_user_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  note: string | null;
  status: BoxRequestStatus;
  decline_reason: string | null;
  created_purchase_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  ambassador_name?: string | null;
}

const KEY = 'ambassador-box-requests';
// Table predates regenerated types in some environments — keep the handle loose.
const table = () => (supabase.from as any)('ambassador_box_requests');

export function useMyBoxRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY, 'mine', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await table()
        .select('*')
        .eq('ambassador_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AmbassadorBoxRequest[];
    },
    enabled: !!user?.id,
  });
}

export function useAllBoxRequests() {
  return useQuery({
    queryKey: [KEY, 'all'],
    queryFn: async () => {
      const { data, error } = await table()
        .select('*, ambassadors:ambassador_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map(r => ({
        ...r,
        ambassador_name: r.ambassadors?.name ?? null,
        ambassadors: undefined,
      })) as AmbassadorBoxRequest[];
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

      const { error } = await table().insert({
        ambassador_id: amb.id,
        ambassador_user_id: user.id,
        product_id: input.product_id,
        product_name: input.product_name,
        quantity: input.quantity,
        note: input.note || null,
      });
      if (error) throw error;
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
  const { user } = useAuth();

  const approve = useMutation({
    mutationFn: async (request: AmbassadorBoxRequest) => {
      if (!user?.id) throw new Error('Not authenticated');

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

      // Create the purchase exactly like the admin-initiated flow
      const { data: purchase, error: pErr } = await supabase
        .from('ambassador_purchases')
        .insert({
          ambassador_user_id: request.ambassador_user_id,
          ambassador_id: request.ambassador_id,
          order_source: 'ambassador_request',
          status: 'draft',
          created_by_user_id: user.id,
          created_for_user_id: request.ambassador_user_id,
          notes: `Box request ${request.id.slice(0, 8)}${request.note ? ` — ${request.note}` : ''}`,
          subtotal,
          tax: 0,
          discount_total: 0,
          total: subtotal,
        } as any)
        .select()
        .single();
      if (pErr) throw pErr;

      const { error: iErr } = await supabase
        .from('ambassador_purchase_items')
        .insert({
          purchase_id: purchase.id,
          product_id: request.product_id,
          product_name_snapshot: request.product_name,
          unit_price_snapshot: unit,
          quantity: request.quantity,
          line_total: subtotal,
        } as any);
      if (iErr) throw iErr;

      const { error: uErr } = await table()
        .update({
          status: 'approved',
          created_purchase_id: purchase.id,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (uErr) throw uErr;

      return purchase;
    },
    onSuccess: (purchase: any) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-purchase-summary'] });
      toast.success('Request approved — order created', {
        description: purchase?.order_number ? `Order ${purchase.order_number}` : undefined,
      });
    },
    onError: (err: Error) => toast.error(`Approve failed: ${err.message}`),
  });

  const decline = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!reason.trim()) throw new Error('A reason is required when declining');

      const { error } = await table()
        .update({
          status: 'declined',
          decline_reason: reason.trim(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      toast.success('Request declined');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { approve, decline };
}
