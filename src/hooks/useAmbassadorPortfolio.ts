/**
 * Ambassador Portfolio Hook - RLS-scoped data access for Ambassador Portal OS
 * Fetches only stores, orders, notes that the ambassador is assigned to manage
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface PortfolioStore {
  assignment_id: string;
  store_id: string;
  store_name: string;
  store_address: string;
  store_city: string;
  store_state: string;
  store_phone: string;
  store_owner: string;
  assignment_type: 'assigned' | 'sourced';
  active: boolean;
  start_date: string;
  end_date: string | null;
  is_primary: boolean;
  commission_rate: number;
  assigned_at: string;
  // Aggregated metrics (populated separately)
  last_order_date?: string;
  last_order_amount?: number;
  total_orders?: number;
  total_revenue?: number;
  payment_status?: string;
  notes_count?: number;
}

export interface PortfolioMetrics {
  totalStores: number;
  assignedStores: number;
  sourcedStores: number;
  activeStores: number;
  dormantStores: number;
  atRiskStores: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  totalOrders: number;
  totalRevenue: number;
  onlineCommission: number;
}

export interface StoreOrder {
  id: string;
  store_id: string;
  order_date: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax: number;
  total: number;
  items_count: number;
}

export interface StoreNote {
  id: string;
  store_id: string;
  note_text: string;
  note_date: string;
  created_at: string;
  created_by: string;
  note_type?: string;
}

export function useAmbassadorPortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get ambassador record for current user
  // CRITICAL: User may have multiple ambassador records - use limit(1) to get the most recent active one
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-self', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const ambassadorId = ambassadorQuery.data?.id;

  // Fetch assigned stores from ambassador_assignments (RLS enforced)
  const storesQuery = useQuery({
    queryKey: ['ambassador-portfolio-stores', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select(`
          id,
          store_id,
          assignment_type,
          active,
          start_date,
          end_date,
          is_primary,
          commission_rate,
          created_at,
          store:store_master!store_id (
            id,
            store_name,
            address,
            city,
            state,
            phone,
            owner_name
          )
        `)
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .not('store_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to PortfolioStore format
      return (data || []).map((a: any): PortfolioStore => ({
        assignment_id: a.id,
        store_id: a.store_id,
        store_name: a.store?.store_name || 'Unknown Store',
        store_address: a.store?.address || '',
        store_city: a.store?.city || '',
        store_state: a.store?.state || '',
        store_phone: a.store?.phone || '',
        store_owner: a.store?.owner_name || '',
        assignment_type: a.assignment_type || 'assigned',
        active: a.active,
        start_date: a.start_date,
        end_date: a.end_date,
        is_primary: a.is_primary,
        commission_rate: a.commission_rate || 0,
        assigned_at: a.created_at,
      }));
    },
    enabled: !!ambassadorId,
  });

  // Fetch commissions for this ambassador
  const commissionsQuery = useQuery({
    queryKey: ['ambassador-portfolio-commissions', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('commission_ledger')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .neq('status', 'reversed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Fetch online sales for this ambassador
  const onlineSalesQuery = useQuery({
    queryKey: ['ambassador-portfolio-online-sales', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from('ambassador_online_sales')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  // Calculate portfolio metrics
  const calculateMetrics = (): PortfolioMetrics => {
    const stores = storesQuery.data || [];
    const commissions = commissionsQuery.data || [];
    const onlineSales = onlineSalesQuery.data || [];

    const assignedStores = stores.filter(s => s.assignment_type === 'assigned');
    const sourcedStores = stores.filter(s => s.assignment_type === 'sourced');

    const pendingCommissions = commissions.filter((c: any) => c.status === 'pending');
    const paidCommissions = commissions.filter((c: any) => c.status === 'paid');

    const completedOnlineSales = onlineSales.filter((s: any) => s.status === 'completed');
    const onlineCommission = completedOnlineSales.reduce((sum: number, s: any) => 
      sum + Number(s.commission_amount || 0), 0);

    return {
      totalStores: stores.length,
      assignedStores: assignedStores.length,
      sourcedStores: sourcedStores.length,
      activeStores: stores.filter(s => s.active).length,
      dormantStores: 0, // Would need order data to determine
      atRiskStores: 0, // Would need order data to determine
      totalCommission: commissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      pendingCommission: pendingCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      paidCommission: paidCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      totalOrders: onlineSales.length,
      totalRevenue: completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.order_amount || 0), 0),
      onlineCommission,
    };
  };

  // MASTER GENIUS ARCHITECT: Unassign store (never delete, only deactivate)
  // "Remove from My Stores" = deactivate assignment, store remains in system
  const unassignStoreMutation = useMutation({
    mutationFn: async (storeId: string) => {
      if (!ambassadorId) throw new Error('Ambassador profile not found');

      const { error } = await supabase
        .from('ambassador_assignments')
        .update({
          active: false,
          unassigned_at: new Date().toISOString(),
          unassigned_by: ambassadorId,
        })
        .eq('store_id', storeId)
        .eq('ambassador_id', ambassadorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-stores', ambassadorId] });
      toast.success('Store removed from your portfolio');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove store: ${error.message}`);
    },
  });

  return {
    ambassador: ambassadorQuery.data,
    stores: storesQuery.data || [],
    commissions: commissionsQuery.data || [],
    onlineSales: onlineSalesQuery.data || [],
    metrics: calculateMetrics(),
    isLoading: ambassadorQuery.isLoading || storesQuery.isLoading,
    isError: ambassadorQuery.isError || storesQuery.isError,
    // Mutations
    unassignStore: unassignStoreMutation.mutateAsync,
    isUnassigningStore: unassignStoreMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-stores', ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-commissions', ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-portfolio-online-sales', ambassadorId] });
    },
  };
}

/**
 * Hook to fetch details for a specific store in the ambassador's portfolio
 */
export function useAmbassadorStoreProfile(storeId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch store details (RLS enforced)
  const storeQuery = useQuery({
    queryKey: ['ambassador-store-profile', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('store_master')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Fetch store orders (RLS enforced)
  const ordersQuery = useQuery({
    queryKey: ['ambassador-store-orders', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_orders')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Fetch store notes (RLS enforced)
  const notesQuery = useQuery({
    queryKey: ['ambassador-store-notes', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_notes')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Fetch store contacts
  const contactsQuery = useQuery({
    queryKey: ['ambassador-store-contacts', storeId],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('store_contacts')
        .select('*')
        .is('deleted_at', null)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      if (!storeId || !user?.id) throw new Error('Missing store or user');

      const { error } = await supabase
        .from('store_notes')
        .insert({
          store_id: storeId,
          note_text: noteText,
          note_date: new Date().toISOString(),
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-notes', storeId] });
      toast.success('Note added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  return {
    store: storeQuery.data,
    orders: ordersQuery.data || [],
    notes: notesQuery.data || [],
    contacts: contactsQuery.data || [],
    isLoading: storeQuery.isLoading,
    isError: storeQuery.isError,
    addNote: addNoteMutation.mutateAsync,
    isAddingNote: addNoteMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-profile', storeId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-orders', storeId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-notes', storeId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-store-contacts', storeId] });
    },
  };
}
