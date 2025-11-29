// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA COMMAND ENGINE — Central Query Execution System
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import { ParsedCommand, parseCommand } from './CommandParser';
import { QueryIntent, getIntentById, ActionIntent } from './IntentRegistry';
import { executeAction, ExecutionResult, mapActionIntentToExecution } from './ExecutionEngine';

export interface CommandResponse {
  id: string;
  command: ParsedCommand;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  results: QueryResult[];
  summary: string;
  suggestedActions: ActionIntent[];
  error?: string;
}

export interface QueryResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function processCommand(input: string): Promise<CommandResponse> {
  const commandId = crypto.randomUUID();
  const parsedCommand = parseCommand(input);
  
  const response: CommandResponse = {
    id: commandId,
    command: parsedCommand,
    timestamp: new Date().toISOString(),
    status: 'processing',
    results: [],
    summary: '',
    suggestedActions: [],
  };

  try {
    const intentDef = getIntentById(parsedCommand.intent);
    
    if (!intentDef || parsedCommand.intent === 'unknown') {
      response.status = 'completed';
      response.summary = "I couldn't understand that query. Try using shortcuts like /unpaid or /lowstock, or ask about specific data.";
      response.suggestedActions = [];
      return response;
    }

    // Execute query based on intent
    const results = await executeQuery(parsedCommand);
    response.results = results;
    response.suggestedActions = intentDef.suggestedActions;
    response.status = 'completed';
    response.summary = generateSummary(parsedCommand.intent, results, parsedCommand.entities);

  } catch (error) {
    response.status = 'error';
    response.error = error instanceof Error ? error.message : 'Query execution failed';
    response.summary = `Error: ${response.error}`;
  }

  return response;
}

async function executeQuery(command: ParsedCommand): Promise<QueryResult[]> {
  const { intent, entities } = command;

  switch (intent) {
    case 'query_unpaid':
      return await queryUnpaidStores(entities.amount);
    case 'query_no_visit':
      return await queryNoVisitStores(entities.days || 10);
    case 'query_low_inventory':
      return await queryLowInventory();
    case 'query_unassigned_stores':
      return await queryUnassignedStores();
    case 'query_revenue':
      return await queryRevenue(entities.brand);
    case 'query_failed_deliveries':
      return await queryFailedDeliveries(entities.date);
    case 'query_ambassador_performance':
      return await queryAmbassadorPerformance();
    case 'query_slow_stores':
      return await querySlowStores();
    case 'query_high_debt':
      return await queryHighDebtStores(entities.amount || 300);
    case 'query_missing_inventory':
      return await queryMissingInventory();
    case 'query_production':
      return await queryProduction();
    case 'query_wholesale_items':
      return await queryWholesaleItems();
    default:
      return [];
  }
}

// Query implementations
async function queryUnpaidStores(minAmount?: number): Promise<QueryResult[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, companies(name)')
    .eq('payment_status', 'unpaid')
    .order('total_amount', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || [])
    .filter((inv: any) => !minAmount || inv.total_amount >= minAmount)
    .map((inv: any) => ({
      id: inv.id,
      type: 'invoice',
      title: inv.companies?.name || 'Unknown Store',
      subtitle: `$${inv.total_amount?.toLocaleString() || 0} unpaid`,
      data: inv,
    }));
}

async function queryNoVisitStores(days: number): Promise<QueryResult[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('store_master')
    .select('*')
    .or(`last_visit_date.is.null,last_visit_date.lt.${cutoffDate.toISOString()}`)
    .limit(50);

  if (error) throw error;

  return (data || []).map((store: any) => ({
    id: store.id,
    type: 'store',
    title: store.store_name || 'Unknown Store',
    subtitle: store.last_visit_date 
      ? `Last visited: ${new Date(store.last_visit_date).toLocaleDateString()}`
      : 'Never visited',
    data: store,
  }));
}

async function queryLowInventory(): Promise<QueryResult[]> {
  // Use brand_inventory_movements as proxy for inventory
  const { data, error } = await supabase
    .from('brand_inventory_movements')
    .select('*')
    .lt('quantity', 50)
    .order('quantity', { ascending: true })
    .limit(50);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    type: 'inventory',
    title: item.product_type || 'Unknown Item',
    subtitle: `${item.quantity || 0} units • ${item.brand}`,
    data: item,
  }));
}

async function queryUnassignedStores(): Promise<QueryResult[]> {
  const { data, error } = await supabase
    .from('store_master')
    .select('*')
    .is('assigned_driver_id', null)
    .limit(50);

  if (error) throw error;

  return (data || []).map((store: any) => ({
    id: store.id,
    type: 'store',
    title: store.store_name || 'Unknown Store',
    subtitle: store.neighborhood || store.city || 'No location',
    data: store,
  }));
}

async function queryRevenue(brand?: string): Promise<QueryResult[]> {
  let query = supabase
    .from('invoices')
    .select('brand, total_amount')
    .eq('payment_status', 'paid');

  const { data, error } = await query;

  if (error) throw error;

  // Aggregate by brand
  const byBrand: Record<string, number> = {};
  (data || []).forEach((inv: any) => {
    const b = inv.brand || 'Unknown';
    byBrand[b] = (byBrand[b] || 0) + (inv.total_amount || 0);
  });

  return Object.entries(byBrand).map(([brandName, amount]) => ({
    id: brandName,
    type: 'revenue',
    title: brandName,
    subtitle: `$${amount.toLocaleString()} total revenue`,
    data: { brand: brandName, total: amount },
  }));
}

async function queryFailedDeliveries(date?: string): Promise<QueryResult[]> {
  // Use biker_routes as proxy for deliveries
  const { data, error } = await supabase
    .from('biker_routes')
    .select('*, store_master(store_name)')
    .eq('completed', false)
    .limit(50);

  if (error) throw error;

  return (data || []).map((del: any) => ({
    id: del.id,
    type: 'delivery',
    title: del.store_master?.store_name || del.biker_name || 'Unknown',
    subtitle: `Route date: ${new Date(del.route_date).toLocaleDateString()}`,
    data: del,
  }));
}

async function queryAmbassadorPerformance(): Promise<QueryResult[]> {
  const { data, error } = await supabase
    .from('ambassadors')
    .select('*, profiles(name)')
    .order('total_earnings', { ascending: true })
    .limit(20);

  if (error) throw error;

  return (data || []).map((amb: any) => ({
    id: amb.id,
    type: 'ambassador',
    title: amb.profiles?.name || 'Unknown Ambassador',
    subtitle: `$${amb.total_earnings?.toLocaleString() || 0} earnings • ${amb.tier} tier`,
    data: amb,
  }));
}

async function querySlowStores(): Promise<QueryResult[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('store_master')
    .select('*')
    .or(`last_order_date.is.null,last_order_date.lt.${thirtyDaysAgo.toISOString()}`)
    .limit(50);

  if (error) throw error;

  return (data || []).map((store: any) => ({
    id: store.id,
    type: 'store',
    title: store.store_name || 'Unknown Store',
    subtitle: store.last_order_date 
      ? `Last order: ${new Date(store.last_order_date).toLocaleDateString()}`
      : 'No orders recorded',
    data: store,
  }));
}

async function queryHighDebtStores(threshold: number): Promise<QueryResult[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('company_id, total_amount, companies(name)')
    .eq('payment_status', 'unpaid')
    .gte('total_amount', threshold)
    .order('total_amount', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((inv: any) => ({
    id: inv.company_id,
    type: 'debt',
    title: inv.companies?.name || 'Unknown Store',
    subtitle: `Owes $${inv.total_amount?.toLocaleString() || 0}`,
    data: inv,
  }));
}

async function queryMissingInventory(): Promise<QueryResult[]> {
  // Use brand_inventory_movements for discrepancies
  const { data, error } = await supabase
    .from('brand_inventory_movements')
    .select('*')
    .eq('movement_type', 'adjustment')
    .limit(50);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    type: 'inventory_discrepancy',
    title: item.product_type || 'Unknown Item',
    subtitle: `${item.movement_type} • ${item.quantity} units`,
    data: item,
  }));
}

async function queryProduction(): Promise<QueryResult[]> {
  const { data, error } = await supabase
    .from('production_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data || []).map((batch: any) => ({
    id: batch.id,
    type: 'production',
    title: `Batch ${batch.batch_number || batch.id.slice(0, 8)}`,
    subtitle: `${batch.tubes_produced || 0} tubes, ${batch.boxes_produced || 0} boxes`,
    data: batch,
  }));
}

async function queryWholesaleItems(): Promise<QueryResult[]> {
  // Use wholesale_orders as proxy
  const { data, error } = await supabase
    .from('wholesale_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    type: 'wholesale_item',
    title: `Order ${item.id.slice(0, 8)}`,
    subtitle: `${item.tubes_total || 0} tubes • ${item.brand || 'Unknown'}`,
    data: item,
  }));
}

function generateSummary(intent: QueryIntent, results: QueryResult[], entities: any): string {
  const count = results.length;
  
  const summaries: Record<QueryIntent, string> = {
    query_unpaid: `Found ${count} unpaid ${count === 1 ? 'invoice' : 'invoices'}${entities.amount ? ` over $${entities.amount}` : ''}`,
    query_no_visit: `Found ${count} ${count === 1 ? 'store' : 'stores'} not visited in ${entities.days || 10} days`,
    query_low_inventory: `Found ${count} ${count === 1 ? 'item' : 'items'} with low stock`,
    query_unassigned_stores: `Found ${count} unassigned ${count === 1 ? 'store' : 'stores'}`,
    query_route_gaps: `Found ${count} route ${count === 1 ? 'gap' : 'gaps'}`,
    query_revenue: `Revenue breakdown across ${count} ${count === 1 ? 'brand' : 'brands'}`,
    query_store_activity: `Found ${count} ${count === 1 ? 'store' : 'stores'} with activity data`,
    query_ambassador_performance: `Found ${count} ${count === 1 ? 'ambassador' : 'ambassadors'}`,
    query_wholesale_items: `Found ${count} wholesale ${count === 1 ? 'item' : 'items'}`,
    query_production: `Found ${count} production ${count === 1 ? 'batch' : 'batches'}`,
    query_missing_inventory: `Found ${count} inventory ${count === 1 ? 'discrepancy' : 'discrepancies'}`,
    query_driver_payments: `Found ${count} driver ${count === 1 ? 'payment' : 'payments'} due`,
    query_unpaid_orders: `Found ${count} unpaid ${count === 1 ? 'order' : 'orders'}`,
    query_unconfirmed_communications: `Found ${count} unconfirmed ${count === 1 ? 'message' : 'messages'}`,
    query_failed_deliveries: `Found ${count} failed ${count === 1 ? 'delivery' : 'deliveries'}`,
    query_slow_stores: `Found ${count} slow/inactive ${count === 1 ? 'store' : 'stores'}`,
    query_high_debt: `Found ${count} ${count === 1 ? 'store' : 'stores'} with high debt`,
    unknown: count > 0 ? `Found ${count} results` : 'No results found',
  };

  return summaries[intent] || `Found ${count} results`;
}

export async function executeCommandAction(
  action: ActionIntent,
  results: QueryResult[],
  params?: Record<string, unknown>
): Promise<ExecutionResult> {
  const entityIds = results.map((r) => r.id);
  const executionAction = mapActionIntentToExecution(action);
  
  return executeAction(executionAction, {
    entityIds,
    ...params,
  });
}
