import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AmbassadorMetrics {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  storesAcquired: number;
  storesActive: number;
  storesDormant: number;
  wholesalersAcquired: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  onlineSalesCount: number;
  onlineSalesRevenue: number;
  onlineCommission: number;
  conversionRate: number;
  last30DaysRevenue: number;
  last30DaysOrders: number;
}

export interface AmbassadorStore {
  id: string;
  name: string;
  status: string;
  city?: string;
  state?: string;
  lastOrderDate?: string;
  monthlyRevenue: number;
  totalOrders: number;
  assignmentDate: string;
  roleType: string;
  commissionRate: number;
}

export interface AmbassadorPipelineStage {
  stage: string;
  count: number;
  stores: AmbassadorStore[];
}

export function useAmbassadorIntelligence(ambassadorId: string | null) {
  const queryClient = useQueryClient();

  // Fetch ambassador with full profile data
  const ambassadorQuery = useQuery({
    queryKey: ["ambassador-intelligence", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return null;

      const { data, error } = await supabase
        .from("ambassadors")
        .select(`
          *,
          profiles:user_id (name, email, avatar_url)
        `)
        .eq("id", ambassadorId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ambassadorId,
  });

  // Fetch ambassador assignments (stores & wholesalers)
  const assignmentsQuery = useQuery({
    queryKey: ["ambassador-assignments", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from("ambassador_assignments")
        .select(`
          *,
          company:companies(id, name, type)
        `)
        .eq("ambassador_id", ambassadorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Fetch commissions
  const commissionsQuery = useQuery({
    queryKey: ["ambassador-commissions", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from("commission_ledger")
        .select("*")
        .eq("ambassador_id", ambassadorId)
        .neq("status", "reversed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Fetch online sales
  const onlineSalesQuery = useQuery({
    queryKey: ["ambassador-online-sales-intel", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];

      const { data, error } = await supabase
        .from("ambassador_online_sales")
        .select("*")
        .eq("ambassador_id", ambassadorId)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Store orders - simplified without status filter
  const storeOrdersQuery = useQuery({
    queryKey: ["ambassador-store-orders", ambassadorId],
    queryFn: async (): Promise<any[]> => {
      // For now, return empty - would need proper order aggregation
      return [];
    },
    enabled: !!ambassadorId,
  });

  // Calculate metrics
  const calculateMetrics = (): AmbassadorMetrics => {
    const ambassador = ambassadorQuery.data;
    const assignments = assignmentsQuery.data || [];
    const commissions = commissionsQuery.data || [];
    const onlineSales = onlineSalesQuery.data || [];

    const storeAssignments = assignments.filter((a: any) => 
      a.role_type === 'store_finder' || a.company?.type === 'store'
    );
    const wholesalerAssignments = assignments.filter((a: any) => 
      a.role_type === 'wholesaler_finder' || a.company?.type === 'wholesaler'
    );

    const pendingCommissions = commissions.filter((c: any) => c.status === 'pending');
    const paidCommissions = commissions.filter((c: any) => c.status === 'paid');

    const completedOnlineSales = onlineSales.filter((s: any) => s.status === 'completed');
    const onlineRevenue = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.order_amount), 0);
    const onlineCommission = completedOnlineSales.reduce((sum: number, s: any) => sum + Number(s.commission_amount), 0);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentOnlineSales = onlineSales.filter((s: any) => new Date(s.sale_date) >= thirtyDaysAgo);

    const totalOrders = onlineSales.length;
    const totalRevenue = onlineRevenue;

    return {
      totalEarnings: ambassador?.total_earnings || 0,
      pendingEarnings: pendingCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      paidEarnings: paidCommissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0),
      storesAcquired: storeAssignments.length,
      storesActive: storeAssignments.length, // Simplified
      storesDormant: 0,
      wholesalersAcquired: wholesalerAssignments.length,
      totalOrders,
      totalRevenue,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      onlineSalesCount: onlineSales.length,
      onlineSalesRevenue: onlineRevenue,
      onlineCommission,
      conversionRate: onlineSales.length > 0 
        ? (completedOnlineSales.length / onlineSales.length) * 100 
        : 0,
      last30DaysRevenue: recentOnlineSales.filter((s: any) => s.status === 'completed').reduce((sum: number, s: any) => sum + Number(s.order_amount), 0),
      last30DaysOrders: recentOnlineSales.length,
    };
  };

  // Build store pipeline
  const buildStorePipeline = (): AmbassadorPipelineStage[] => {
    const assignments = assignmentsQuery.data || [];
    const storeAssignments = assignments.filter((a: any) => 
      a.role_type === 'store_finder' || a.company?.type === 'store'
    );

    const stages = ['lead', 'contacted', 'interested', 'onboarded', 'active', 'dormant', 'lost'];
    
    return stages.map(stage => {
      // All current assignments are considered "active" for now
      const storesInStage = stage === 'active' ? storeAssignments : [];

      return {
        stage,
        count: storesInStage.length,
        stores: storesInStage.map((a: any) => ({
          id: a.company?.id || '',
          name: a.company?.name || 'Unknown',
          status: 'active',
          monthlyRevenue: 0,
          totalOrders: 0,
          assignmentDate: a.created_at,
          roleType: a.role_type,
          commissionRate: a.commission_rate || 0,
        })),
      };
    });
  };

  // Update ambassador profile
  const updateAmbassadorMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!ambassadorId) throw new Error("No ambassador ID");
      
      const { error } = await supabase
        .from("ambassadors")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ambassadorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ambassador-intelligence", ambassadorId] });
      toast.success("Ambassador updated");
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  // Get display name (canonical - fixes the "Ambassador" bug)
  const getDisplayName = () => {
    const ambassador = ambassadorQuery.data;
    if (!ambassador) return 'Unknown Ambassador';
    
    // Priority: ambassador.name > profiles.name > fallback
    return ambassador.name || 
           ambassador.profiles?.name || 
           'Unknown Ambassador';
  };

  return {
    ambassador: ambassadorQuery.data,
    assignments: assignmentsQuery.data || [],
    commissions: commissionsQuery.data || [],
    onlineSales: onlineSalesQuery.data || [],
    storeOrders: storeOrdersQuery.data || [],
    metrics: calculateMetrics(),
    pipeline: buildStorePipeline(),
    displayName: getDisplayName(),
    isLoading: ambassadorQuery.isLoading || assignmentsQuery.isLoading,
    isError: ambassadorQuery.isError,
    updateAmbassador: updateAmbassadorMutation.mutateAsync,
    isUpdating: updateAmbassadorMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["ambassador-intelligence", ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ["ambassador-assignments", ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ["ambassador-commissions", ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ["ambassador-online-sales-intel", ambassadorId] });
    },
  };
}

// Helper to get ambassador display name from raw data (for lists/cards)
export function getAmbassadorDisplayName(ambassador: any): string {
  if (!ambassador) return 'Unknown Ambassador';
  
  // Check direct name field first
  if (ambassador.name) return ambassador.name;
  
  // Check joined profile data (various shapes)
  if (ambassador.profiles?.name) return ambassador.profiles.name;
  if (ambassador.user?.name) return ambassador.user.name;
  
  // Fallback
  return 'Unknown Ambassador';
}
