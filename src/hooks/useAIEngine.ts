// Universal AI Engine Hooks for Grabba Skyscraper
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  processAIRequest,
  getStoreQualityScore,
  getReorderPrediction,
  getDriverScore,
  getSalesForecast,
  getInventoryNeeds,
  getChurnRisk,
  DEFAULT_AI_TASKS,
} from '@/ai-engine';
import type { AITask, TaskLog } from '@/ai-engine/aiTasks';
import type { StoreQualityScore, ReorderPrediction, DriverPerformance, SalesForecast } from '@/ai-engine/aiModels';
import { toast } from 'sonner';

// AI Forecasting Hook
export const useAIForecast = (brand?: string) => {
  return useQuery({
    queryKey: ['ai-forecast', brand],
    queryFn: async () => {
      // Simulate historical sales data - in production, fetch from DB
      const historicalSales = Array.from({ length: 30 }, () => Math.floor(Math.random() * 500) + 200);
      
      const brands = brand ? [brand] : ['grabba', 'gasmask', 'hotmama', 'scalati'];
      const forecasts: SalesForecast[] = [];
      
      for (const b of brands) {
        const response = await getSalesForecast(b, historicalSales);
        if (response.success && response.data) {
          forecasts.push(response.data);
        }
      }
      
      return forecasts;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// AI Alerts Hook
export const useAIAlerts = () => {
  return useQuery({
    queryKey: ['ai-alerts'],
    queryFn: async () => {
      const { data: recommendations } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      const alerts = recommendations?.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        severity: r.severity as 'info' | 'warning' | 'critical',
        category: r.category,
        entityType: r.entity_type,
        entityId: r.entity_id,
        createdAt: r.created_at,
        confidence: r.confidence_score,
      })) || [];

      return alerts;
    },
    refetchInterval: 60000,
  });
};

// AI Task Runner Hook
export const useAITaskRunner = () => {
  const queryClient = useQueryClient();

  const runTask = useMutation({
    mutationFn: async (task: AITask) => {
      const response = await processAIRequest({ type: 'run_task', params: { task } });
      if (!response.success) throw new Error(response.error);
      return response.data as TaskLog;
    },
    onSuccess: (data) => {
      toast.success(`Task "${data.taskName}" completed`);
      queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ai-task-logs'] });
    },
    onError: (error) => {
      toast.error(`Task failed: ${error.message}`);
    },
  });

  return { runTask: runTask.mutate, isRunning: runTask.isPending };
};

// AI Recommendations Hook
export const useAIRecommendations = (entityType?: string, entityId?: string) => {
  return useQuery({
    queryKey: ['ai-recommendations', entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from('ai_recommendations')
        .select('*')
        .order('confidence_score', { ascending: false });

      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);

      const { data, error } = await query.limit(20);
      if (error) throw error;

      return data?.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        severity: r.severity,
        confidence: r.confidence_score,
        action: r.recommended_action,
        reasoning: r.reasoning,
        status: r.status,
      })) || [];
    },
  });
};

// AI Scoring Hook
export const useAIScoring = () => {
  const scoreStore = async (storeData: Parameters<typeof getStoreQualityScore>[0]) => {
    const response = await getStoreQualityScore(storeData);
    return response.data;
  };

  const scoreDriver = async (driverData: Parameters<typeof getDriverScore>[0]) => {
    const response = await getDriverScore(driverData);
    return response.data;
  };

  const predictReorder = async (entityData: Parameters<typeof getReorderPrediction>[0]) => {
    const response = await getReorderPrediction(entityData);
    return response.data;
  };

  const assessChurnRisk = async (daysSinceLastOrder: number, totalOrders: number, avgOrderValue: number) => {
    const response = await getChurnRisk(daysSinceLastOrder, totalOrders, avgOrderValue);
    return response.data;
  };

  return { scoreStore, scoreDriver, predictReorder, assessChurnRisk };
};

// Route Optimizer Hook
export const useRouteOptimizer = () => {
  return useMutation({
    mutationFn: async (stops: { id: string; lat: number; lng: number; priority: number }[]) => {
      const response = await processAIRequest({ type: 'route_optimization', params: { stops } });
      if (!response.success) throw new Error(response.error);
      return response.data as typeof stops;
    },
  });
};

// AI Tasks Management Hook
export const useAITasks = () => {
  return useQuery({
    queryKey: ['ai-tasks'],
    queryFn: async () => {
      // In production, fetch from Supabase. For now, use defaults
      return DEFAULT_AI_TASKS.map((task, idx) => ({
        ...task,
        id: `task-${idx}`,
        lastRun: undefined,
        nextRun: new Date().toISOString(),
      })) as AITask[];
    },
  });
};

// AI Task Logs Hook
export const useAITaskLogs = (limit: number = 50) => {
  return useQuery({
    queryKey: ['ai-task-logs', limit],
    queryFn: async () => {
      // In production, fetch from Supabase
      const mockLogs: TaskLog[] = [
        {
          id: '1',
          taskId: 'task-0',
          taskName: 'Daily Sales Report',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date(Date.now() - 3590000).toISOString(),
          status: 'completed',
          result: { totalSales: 15420, orderCount: 47 },
        },
        {
          id: '2',
          taskId: 'task-1',
          taskName: 'Inventory Health Check',
          startedAt: new Date(Date.now() - 7200000).toISOString(),
          completedAt: new Date(Date.now() - 7180000).toISOString(),
          status: 'completed',
          result: { lowStockCount: 12, criticalStockCount: 3 },
        },
      ];
      return mockLogs;
    },
  });
};

// AI Predictions Hook
export const useAIPredictions = () => {
  return useQuery({
    queryKey: ['ai-predictions'],
    queryFn: async () => {
      const forecasts = await Promise.all(
        ['grabba', 'gasmask', 'hotmama', 'scalati'].map(async (brand) => {
          const historicalSales = Array.from({ length: 14 }, () => Math.floor(Math.random() * 500) + 200);
          const response = await getSalesForecast(brand, historicalSales);
          return response.data;
        })
      );

      return {
        salesForecasts: forecasts.filter(Boolean) as SalesForecast[],
        inventoryProjections: [
          { brand: 'grabba', daysUntilDepletion: 12, urgency: 'ok' as const },
          { brand: 'gasmask', daysUntilDepletion: 5, urgency: 'warning' as const },
          { brand: 'hotmama', daysUntilDepletion: 2, urgency: 'critical' as const },
          { brand: 'scalati', daysUntilDepletion: 18, urgency: 'ok' as const },
        ],
        demandSpikes: [
          { region: 'Bronx', expectedIncrease: 25, date: 'This weekend' },
          { region: 'Brooklyn', expectedIncrease: 15, date: 'Next Monday' },
        ],
      };
    },
    staleTime: 10 * 60 * 1000,
  });
};

// Store Quality Scores Hook
export const useStoreQualityScores = () => {
  return useQuery({
    queryKey: ['store-quality-scores'],
    queryFn: async () => {
      const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .limit(20);

      if (!stores) return [];

      const scores: StoreQualityScore[] = [];
      for (const store of stores) {
        const response = await getStoreQualityScore({
          id: store.id,
          name: store.name,
          totalOrders: Math.floor(Math.random() * 50) + 5,
          paidOnTime: Math.floor(Math.random() * 40) + 5,
          totalPaid: Math.floor(Math.random() * 45) + 5,
          responseRate: Math.floor(Math.random() * 40) + 60,
        });
        if (response.data) scores.push(response.data);
      }

      return scores;
    },
    staleTime: 5 * 60 * 1000,
  });
};
