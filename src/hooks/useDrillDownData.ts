import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DrillDownEntity, DrillDownFilters, getEntityTable } from '@/lib/drilldown';
import { GRABBA_BRAND_IDS } from '@/config/grabbaSkyscraper';

interface UseDrillDownDataOptions {
  entity: DrillDownEntity;
  filters: DrillDownFilters;
  enabled?: boolean;
}

interface DrillDownResult {
  id: string;
  title: string;
  subtitle?: string;
  type?: string;
  status?: string;
  amount?: number;
  brand?: string;
  metadata?: Record<string, any>;
  raw: any;
}

export function useDrillDownData({ entity, filters, enabled = true }: UseDrillDownDataOptions) {
  return useQuery({
    queryKey: ['drilldown', entity, filters],
    queryFn: async (): Promise<DrillDownResult[]> => {
      switch (entity) {
        case 'stores':
          return fetchStores(filters);
        case 'invoices':
          return fetchInvoices(filters);
        case 'deliveries':
          return fetchDeliveries(filters);
        case 'inventory':
          return fetchInventory(filters);
        case 'drivers':
          return fetchDrivers(filters);
        case 'routes':
          return fetchRoutes(filters);
        case 'orders':
          return fetchOrders(filters);
        case 'ambassadors':
          return fetchAmbassadors(filters);
        case 'commissions':
          return fetchCommissions(filters);
        default:
          return [];
      }
    },
    enabled,
  });
}

async function fetchStores(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('stores')
    .select('*, company:companies(name, neighborhood, boro)')
    .order('name');

  if (filters.brand) {
    query = query.eq('brand', filters.brand);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.region) {
    query = query.eq('region', filters.region);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((store: any) => ({
    id: store.id,
    title: store.name || 'Unknown Store',
    subtitle: store.company?.neighborhood || store.address,
    type: 'store',
    status: store.status,
    brand: store.brand,
    metadata: { address: store.address, phone: store.phone },
    raw: store,
  }));
}

async function fetchInvoices(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('invoices')
    .select('*, company:companies(name, neighborhood)')
    .order('created_at', { ascending: false });

  if (filters.brand) {
    query = query.eq('brand', filters.brand);
  }

  if (filters.payment_status) {
    query = query.eq('payment_status', filters.payment_status);
  }

  if (filters.status) {
    query = query.eq('payment_status', filters.status);
  }

  if (filters.overdue) {
    query = query.lt('due_date', new Date().toISOString());
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((inv: any) => ({
    id: inv.id,
    title: inv.invoice_number || `Invoice #${inv.id.slice(0, 8)}`,
    subtitle: inv.company?.name,
    type: 'invoice',
    status: inv.payment_status,
    amount: inv.total_amount,
    brand: inv.brand,
    metadata: { due_date: inv.due_date, company: inv.company?.name },
    raw: inv,
  }));
}

async function fetchDeliveries(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('driver_route_stops')
    .select('*, driver_routes(route_date, driver:grabba_drivers(name)), company:companies(name), store:stores(name)')
    .order('created_at', { ascending: false });

  if (filters.brand) {
    query = query.eq('brand', filters.brand);
  }

  if (filters.status === 'pending' || filters.status === 'incomplete') {
    query = query.eq('completed', false);
  } else if (filters.status === 'completed') {
    query = query.eq('completed', true);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((stop: any) => ({
    id: stop.id,
    title: stop.store?.name || stop.company?.name || 'Delivery Stop',
    subtitle: stop.driver_routes?.driver?.name || 'Unassigned',
    type: stop.task_type || 'delivery',
    status: stop.completed ? 'completed' : 'pending',
    amount: stop.amount_owed,
    brand: stop.brand,
    metadata: { route_date: stop.driver_routes?.route_date },
    raw: stop,
  }));
}

async function fetchInventory(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('store_brand_accounts')
    .select('*, store:stores(name, address), company:companies(name)')
    .order('tubes_on_hand');

  if (filters.brand) {
    query = query.eq('brand', filters.brand);
  }

  if (filters.low_stock) {
    query = query.lt('tubes_on_hand', 50);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((inv: any) => ({
    id: inv.id,
    title: inv.store?.name || inv.company?.name || 'Unknown',
    subtitle: `${inv.tubes_on_hand || 0} tubes on hand`,
    type: 'inventory',
    status: (inv.tubes_on_hand || 0) < 50 ? 'low_stock' : 'in_stock',
    amount: inv.tubes_on_hand,
    brand: inv.brand,
    metadata: { tubes_sold: inv.tubes_sold, last_delivery: inv.last_delivery_date },
    raw: inv,
  }));
}

async function fetchDrivers(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('grabba_drivers')
    .select('*')
    .order('name');

  if (filters.status === 'active') {
    query = query.eq('active', true);
  } else if (filters.status === 'inactive') {
    query = query.eq('active', false);
  }

  if (filters.region) {
    query = query.eq('region', filters.region);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((driver: any) => ({
    id: driver.id,
    title: driver.name || 'Unknown Driver',
    subtitle: driver.region || driver.phone,
    type: 'driver',
    status: driver.active ? 'active' : 'inactive',
    metadata: { phone: driver.phone, commission_rate: driver.commission_rate },
    raw: driver,
  }));
}

async function fetchRoutes(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('driver_routes')
    .select('*, driver:grabba_drivers(name), stops:driver_route_stops(id, completed)')
    .order('route_date', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.driver_id) {
    query = query.eq('driver_id', filters.driver_id);
  }

  if (filters.date_from) {
    query = query.gte('route_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('route_date', filters.date_to);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((route: any) => ({
    id: route.id,
    title: route.driver?.name || 'Unassigned Route',
    subtitle: `${route.route_date} - ${route.stops?.length || 0} stops`,
    type: 'route',
    status: route.status || 'scheduled',
    metadata: { stops_completed: route.stops?.filter((s: any) => s.completed).length || 0 },
    raw: route,
  }));
}

async function fetchOrders(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('wholesale_orders')
    .select('*, company:companies(name), store:stores(name)')
    .order('created_at', { ascending: false });

  if (filters.brand) {
    query = query.eq('brand', filters.brand);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((order: any) => ({
    id: order.id,
    title: order.company?.name || order.store?.name || 'Order',
    subtitle: `${order.boxes || 0} boxes - ${order.tubes_total || 0} tubes`,
    type: 'order',
    status: order.status,
    amount: order.total_amount,
    brand: order.brand,
    metadata: { boxes: order.boxes, tubes: order.tubes_total },
    raw: order,
  }));
}

async function fetchAmbassadors(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('ambassadors')
    .select('*, user:profiles(name, email)')
    .order('created_at', { ascending: false });

  if (filters.status === 'active') {
    query = query.eq('is_active', true);
  } else if (filters.status === 'inactive') {
    query = query.eq('is_active', false);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((amb: any) => ({
    id: amb.id,
    title: amb.user?.name || 'Unknown Ambassador',
    subtitle: amb.tier || 'Standard',
    type: 'ambassador',
    status: amb.is_active ? 'active' : 'inactive',
    amount: amb.total_earnings,
    metadata: { tracking_code: amb.tracking_code, tier: amb.tier },
    raw: amb,
  }));
}

async function fetchCommissions(filters: DrillDownFilters): Promise<DrillDownResult[]> {
  const client = supabase as any;
  let query = client
    .from('ambassador_commissions')
    .select('*, ambassador:ambassadors(user_id, user:profiles(name))')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  return (data || []).map((comm: any) => ({
    id: comm.id,
    title: comm.ambassador?.user?.name || 'Commission',
    subtitle: comm.entity_type,
    type: 'commission',
    status: comm.status,
    amount: comm.amount,
    metadata: { paid_at: comm.paid_at, notes: comm.notes },
    raw: comm,
  }));
}
