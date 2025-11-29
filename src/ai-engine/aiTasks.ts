// AI Task Scheduler for Grabba Skyscraper
import { supabase } from '@/integrations/supabase/client';

export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';
export type TaskCategory = 'finance' | 'deliveries' | 'crm' | 'wholesale' | 'production' | 'communication' | 'inventory' | 'ambassadors';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AITask {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  frequency: TaskFrequency;
  isEnabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: TaskStatus;
  config?: Record<string, unknown>;
}

export interface TaskLog {
  id: string;
  taskId: string;
  taskName: string;
  startedAt: string;
  completedAt?: string;
  status: TaskStatus;
  result?: Record<string, unknown>;
  error?: string;
}

// Default AI Task Templates
export const DEFAULT_AI_TASKS: Omit<AITask, 'id'>[] = [
  // Daily Tasks
  {
    name: 'Daily Sales Report',
    description: 'Generate comprehensive daily sales report across all brands',
    category: 'finance',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Inventory Health Check',
    description: 'Scan all inventory levels and flag items below reorder point',
    category: 'inventory',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Route Optimization',
    description: 'Generate optimized delivery routes for all active drivers',
    category: 'deliveries',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'CRM Follow-up List',
    description: 'Generate prioritized list of stores requiring follow-up',
    category: 'crm',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Ambassador Performance Report',
    description: 'Calculate and update ambassador performance scores',
    category: 'ambassadors',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'AI Quality Alerts',
    description: 'Scan for anomalies and generate quality control alerts',
    category: 'production',
    frequency: 'daily',
    isEnabled: true,
    status: 'pending',
  },
  // Weekly Tasks
  {
    name: 'Deep Brand Audit',
    description: 'Comprehensive analysis of each brand performance',
    category: 'finance',
    frequency: 'weekly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Forecasting Refresh',
    description: 'Update all sales and demand forecasts with latest data',
    category: 'finance',
    frequency: 'weekly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Wholesaler Ranking Update',
    description: 'Recalculate wholesaler rankings and tiers',
    category: 'wholesale',
    frequency: 'weekly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Ambassador Tier Adjustments',
    description: 'Review and adjust ambassador tiers based on performance',
    category: 'ambassadors',
    frequency: 'weekly',
    isEnabled: true,
    status: 'pending',
  },
  // Monthly Tasks
  {
    name: 'Production vs Sales Audit',
    description: 'Compare production output against sales to identify gaps',
    category: 'production',
    frequency: 'monthly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Financial Margin Audit',
    description: 'Deep dive into profit margins by brand, region, and channel',
    category: 'finance',
    frequency: 'monthly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'Supply Chain Prediction',
    description: 'Long-term supply chain forecasting and risk assessment',
    category: 'inventory',
    frequency: 'monthly',
    isEnabled: true,
    status: 'pending',
  },
  {
    name: 'System Weak Points Detection',
    description: 'AI-powered detection of operational weak points',
    category: 'crm',
    frequency: 'monthly',
    isEnabled: true,
    status: 'pending',
  },
];

export const getNextRunDate = (frequency: TaskFrequency, lastRun?: string): Date => {
  const now = new Date();
  const last = lastRun ? new Date(lastRun) : now;
  
  switch (frequency) {
    case 'daily':
      const nextDaily = new Date(last);
      nextDaily.setDate(nextDaily.getDate() + 1);
      nextDaily.setHours(6, 0, 0, 0);
      return nextDaily > now ? nextDaily : new Date(now.setHours(6, 0, 0, 0));
    case 'weekly':
      const nextWeekly = new Date(last);
      nextWeekly.setDate(nextWeekly.getDate() + 7);
      nextWeekly.setHours(6, 0, 0, 0);
      return nextWeekly;
    case 'monthly':
      const nextMonthly = new Date(last);
      nextMonthly.setMonth(nextMonthly.getMonth() + 1);
      nextMonthly.setDate(1);
      nextMonthly.setHours(6, 0, 0, 0);
      return nextMonthly;
    default:
      return now;
  }
};

export const shouldRunTask = (task: AITask): boolean => {
  if (!task.isEnabled) return false;
  if (task.frequency === 'manual') return false;
  if (!task.nextRun) return true;
  return new Date(task.nextRun) <= new Date();
};

export const runTask = async (
  task: AITask,
  executor: (task: AITask) => Promise<Record<string, unknown>>
): Promise<TaskLog> => {
  const startedAt = new Date().toISOString();
  const logId = crypto.randomUUID();
  
  try {
    const result = await executor(task);
    return {
      id: logId,
      taskId: task.id,
      taskName: task.name,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'completed',
      result,
    };
  } catch (error) {
    return {
      id: logId,
      taskId: task.id,
      taskName: task.name,
      startedAt,
      completedAt: new Date().toISOString(),
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Task Executors
export const taskExecutors: Record<string, (task: AITask) => Promise<Record<string, unknown>>> = {
  'Daily Sales Report': async () => {
    const { data: orders } = await (supabase as any)
      .from('wholesale_orders')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const totalSales = orders?.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0) || 0;
    const orderCount = orders?.length || 0;
    
    return {
      reportDate: new Date().toISOString(),
      totalSales,
      orderCount,
      averageOrderValue: orderCount > 0 ? totalSales / orderCount : 0,
    };
  },
  
  'Inventory Health Check': async () => {
    const { data: inventory } = await supabase
      .from('store_tube_inventory')
      .select('*');
    
    const lowStock = inventory?.filter(i => (i.current_tubes_left || 0) < 50) || [];
    const criticalStock = inventory?.filter(i => (i.current_tubes_left || 0) < 20) || [];
    
    return {
      totalItems: inventory?.length || 0,
      lowStockCount: lowStock.length,
      criticalStockCount: criticalStock.length,
      criticalItems: criticalStock.map(i => ({ id: i.id, stock: i.current_tubes_left })),
    };
  },
  
  'CRM Follow-up List': async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, created_at')
      .limit(50);
    
    return {
      storesNeedingFollowUp: stores?.length || 0,
      stores: stores?.map(s => ({ id: s.id, name: s.name, createdAt: s.created_at })) || [],
    };
  },
};

export const executeTask = async (task: AITask): Promise<TaskLog> => {
  const executor = taskExecutors[task.name] || (async () => ({ message: 'No executor defined' }));
  return runTask(task, executor);
};
