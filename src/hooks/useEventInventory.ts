import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Rentals ──
export function useEventRentals() {
  return useQuery({
    queryKey: ['event-rentals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_rentals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertEventRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rental: Record<string, any>) => {
      const { data, error } = await supabase
        .from('event_rentals')
        .upsert(rental as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-rentals'] }); toast.success('Rental saved'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEventRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_rentals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-rentals'] }); toast.success('Rental deleted'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Staff ──
export function useEventStaff() {
  return useQuery({
    queryKey: ['event-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_staff')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (staff: Record<string, any>) => {
      const { data, error } = await supabase
        .from('event_staff')
        .upsert(staff as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-staff'] }); toast.success('Staff saved'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-staff'] }); toast.success('Staff removed'); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Suppliers ──
export function useEventSuppliers() {
  return useQuery({
    queryKey: ['event-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_suppliers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertEventSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: Record<string, any>) => {
      const { data, error } = await supabase
        .from('event_suppliers')
        .upsert(supplier as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-suppliers'] }); toast.success('Supplier saved'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteEventSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-suppliers'] }); toast.success('Supplier deleted'); },
    onError: (e: any) => toast.error(e.message),
  });
}
