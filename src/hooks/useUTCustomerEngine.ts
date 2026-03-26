import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useUTCustomers() {
  return useQuery({
    queryKey: ['ut-customers'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_customers') as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTEventRequests(filters?: { status?: string; event_type?: string }) {
  return useQuery({
    queryKey: ['ut-event-requests', filters],
    queryFn: async () => {
      let q = (supabase.from('ut_event_requests') as any).select('*');
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.event_type) q = q.eq('event_type', filters.event_type);
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTGeneratedPackages(eventRequestId?: string) {
  return useQuery({
    queryKey: ['ut-generated-packages', eventRequestId],
    queryFn: async () => {
      let q = (supabase.from('ut_generated_packages') as any).select('*');
      if (eventRequestId) q = q.eq('event_request_id', eventRequestId);
      q = q.order('recommendation_score', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventRequestId || eventRequestId === undefined,
  });
}

export function useUTOrders() {
  return useQuery({
    queryKey: ['ut-orders'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_orders') as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUTCustomerMutations() {
  const qc = useQueryClient();

  const createCustomer = useMutation({
    mutationFn: async (customer: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_customers') as any)
        .insert(customer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-customers'] });
      toast.success('Customer created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createEventRequest = useMutation({
    mutationFn: async (req: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_event_requests') as any)
        .insert(req).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-event-requests'] });
      toast.success('Event request created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateRecommendations = useMutation({
    mutationFn: async (eventRequestId: string) => {
      const { data, error } = await supabase.rpc('ut_generate_recommendations' as any, {
        p_event_request_id: eventRequestId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-event-requests'] });
      toast.success('AI recommendations generated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createOrder = useMutation({
    mutationFn: async (order: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_orders') as any)
        .insert(order).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-orders'] });
      toast.success('Order created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateEventStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from('ut_event_requests') as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-event-requests'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveGeneratedPackage = useMutation({
    mutationFn: async (pkg: Record<string, any>) => {
      const { data, error } = await (supabase.from('ut_generated_packages') as any)
        .insert(pkg).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ut-generated-packages'] });
      toast.success('Package saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    createCustomer,
    createEventRequest,
    generateRecommendations,
    createOrder,
    updateEventStatus,
    saveGeneratedPackage,
  };
}
