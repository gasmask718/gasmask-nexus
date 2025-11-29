// AI Router - Central hub for all AI operations in Grabba Skyscraper
import { supabase } from '@/integrations/supabase/client';
import * as aiModels from './aiModels';
import * as aiUtils from './aiUtils';
import { AITask, executeTask, DEFAULT_AI_TASKS } from './aiTasks';

export type AIRequestType = 
  | 'store_quality_score'
  | 'reorder_prediction'
  | 'driver_performance'
  | 'sales_forecast'
  | 'inventory_needs'
  | 'wholesaler_fraud'
  | 'ambassador_score'
  | 'route_optimization'
  | 'churn_risk'
  | 'run_task';

export interface AIRequest {
  type: AIRequestType;
  params: Record<string, unknown>;
}

export interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Validation schemas
const validateRequest = (request: AIRequest): { valid: boolean; error?: string } => {
  if (!request.type) return { valid: false, error: 'Request type is required' };
  if (!request.params) return { valid: false, error: 'Request params are required' };
  return { valid: true };
};

// Main AI Router
export const processAIRequest = async <T>(request: AIRequest): Promise<AIResponse<T>> => {
  const validation = validateRequest(request);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    let result: unknown;

    switch (request.type) {
      case 'store_quality_score':
        result = aiModels.calculateStoreQualityScore(request.params as Parameters<typeof aiModels.calculateStoreQualityScore>[0]);
        break;

      case 'reorder_prediction':
        result = aiModels.predictReorderLikelihood(request.params as Parameters<typeof aiModels.predictReorderLikelihood>[0]);
        break;

      case 'driver_performance':
        result = aiModels.scoreDriverPerformance(request.params as Parameters<typeof aiModels.scoreDriverPerformance>[0]);
        break;

      case 'sales_forecast':
        const { brand, historicalSales } = request.params as { brand: string; historicalSales: number[] };
        result = aiModels.forecastBrandSales(brand, historicalSales);
        break;

      case 'inventory_needs':
        result = aiModels.predictInventoryNeeds(request.params.inventory as Parameters<typeof aiModels.predictInventoryNeeds>[0]);
        break;

      case 'wholesaler_fraud':
        result = aiModels.detectWholesalerFraud(request.params as Parameters<typeof aiModels.detectWholesalerFraud>[0]);
        break;

      case 'ambassador_score':
        result = aiModels.scoreAmbassadorPerformance(request.params as Parameters<typeof aiModels.scoreAmbassadorPerformance>[0]);
        break;

      case 'route_optimization':
        const stops = request.params.stops as Parameters<typeof aiUtils.optimizeRoute>[0];
        result = aiUtils.optimizeRoute(stops);
        break;

      case 'churn_risk':
        const { daysSinceLastOrder, totalOrders, averageOrderValue } = request.params as {
          daysSinceLastOrder: number;
          totalOrders: number;
          averageOrderValue: number;
        };
        result = aiUtils.calculateChurnRisk(daysSinceLastOrder, totalOrders, averageOrderValue);
        break;

      case 'run_task':
        const task = request.params.task as AITask;
        result = await executeTask(task);
        break;

      default:
        return {
          success: false,
          error: `Unknown request type: ${request.type}`,
          timestamp: new Date().toISOString(),
        };
    }

    return {
      success: true,
      data: result as T,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('AI Router error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Batch processing for multiple requests
export const processBatchRequests = async (requests: AIRequest[]): Promise<AIResponse[]> => {
  return Promise.all(requests.map(req => processAIRequest(req)));
};

// Quick access helpers
export const getStoreQualityScore = (store: Parameters<typeof aiModels.calculateStoreQualityScore>[0]) =>
  processAIRequest<aiModels.StoreQualityScore>({ type: 'store_quality_score', params: store });

export const getReorderPrediction = (entity: Parameters<typeof aiModels.predictReorderLikelihood>[0]) =>
  processAIRequest<aiModels.ReorderPrediction>({ type: 'reorder_prediction', params: entity });

export const getDriverScore = (driver: Parameters<typeof aiModels.scoreDriverPerformance>[0]) =>
  processAIRequest<aiModels.DriverPerformance>({ type: 'driver_performance', params: driver });

export const getSalesForecast = (brand: string, historicalSales: number[]) =>
  processAIRequest<aiModels.SalesForecast>({ type: 'sales_forecast', params: { brand, historicalSales } });

export const getInventoryNeeds = (inventory: Parameters<typeof aiModels.predictInventoryNeeds>[0]) =>
  processAIRequest({ type: 'inventory_needs', params: { inventory } });

export const getChurnRisk = (daysSinceLastOrder: number, totalOrders: number, averageOrderValue: number) =>
  processAIRequest({ type: 'churn_risk', params: { daysSinceLastOrder, totalOrders, averageOrderValue } });

export { DEFAULT_AI_TASKS };
