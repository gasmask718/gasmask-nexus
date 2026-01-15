import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AmbassadorOnlineSale {
  id: string;
  ambassador_id: string;
  tracking_code: string;
  order_reference: string | null;
  order_amount: number;
  commission_amount: number;
  customer_email: string | null;
  customer_name: string | null;
  product_details: Record<string, unknown> | null;
  sale_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorSalesMetrics {
  totalSales: number;
  totalRevenue: number;
  totalCommission: number;
  averageOrderValue: number;
  completedSales: number;
  pendingSales: number;
  refundedSales: number;
}

export function useAmbassadorOnlineSales(ambassadorId: string | null) {
  const queryClient = useQueryClient();

  const salesQuery = useQuery({
    queryKey: ["ambassador-online-sales", ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      
      const { data, error } = await supabase
        .from("ambassador_online_sales")
        .select("*")
        .eq("ambassador_id", ambassadorId)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return data as AmbassadorOnlineSale[];
    },
    enabled: !!ambassadorId,
  });

  const metricsQuery = useQuery({
    queryKey: ["ambassador-sales-metrics", ambassadorId],
    queryFn: async (): Promise<AmbassadorSalesMetrics> => {
      if (!ambassadorId) {
        return {
          totalSales: 0,
          totalRevenue: 0,
          totalCommission: 0,
          averageOrderValue: 0,
          completedSales: 0,
          pendingSales: 0,
          refundedSales: 0,
        };
      }

      const { data, error } = await supabase
        .from("ambassador_online_sales")
        .select("*")
        .eq("ambassador_id", ambassadorId);

      if (error) throw error;

      const sales = data as AmbassadorOnlineSale[];
      const completedSales = sales.filter((s) => s.status === "completed");
      const pendingSales = sales.filter((s) => s.status === "pending");
      const refundedSales = sales.filter((s) => s.status === "refunded");

      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.order_amount), 0);
      const totalCommission = completedSales.reduce((sum, s) => sum + Number(s.commission_amount), 0);

      return {
        totalSales: sales.length,
        totalRevenue,
        totalCommission,
        averageOrderValue: completedSales.length > 0 ? totalRevenue / completedSales.length : 0,
        completedSales: completedSales.length,
        pendingSales: pendingSales.length,
        refundedSales: refundedSales.length,
      };
    },
    enabled: !!ambassadorId,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: Partial<AmbassadorOnlineSale>) => {
      const { data: result, error } = await supabase
        .from("ambassador_online_sales")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ambassador-online-sales", ambassadorId] });
      queryClient.invalidateQueries({ queryKey: ["ambassador-sales-metrics", ambassadorId] });
      toast.success("Sale recorded successfully");
    },
    onError: (error) => {
      toast.error(`Failed to record sale: ${error.message}`);
    },
  });

  return {
    sales: salesQuery.data ?? [],
    metrics: metricsQuery.data,
    isLoading: salesQuery.isLoading || metricsQuery.isLoading,
    isError: salesQuery.isError || metricsQuery.isError,
    createSale: createSaleMutation.mutateAsync,
    isCreating: createSaleMutation.isPending,
  };
}
