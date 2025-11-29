// Drilldown URL builder and parser utilities

export type DrillDownEntity = 'stores' | 'invoices' | 'deliveries' | 'inventory' | 'drivers' | 'routes' | 'orders' | 'ambassadors' | 'commissions';

export interface DrillDownFilters {
  status?: string;
  brand?: string;
  region?: string;
  payment_status?: string;
  low_stock?: boolean;
  overdue?: boolean;
  days_since_visit?: number;
  driver_id?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: string | boolean | number | undefined;
}

export interface DrillDownConfig {
  entity: DrillDownEntity;
  filters: DrillDownFilters;
  title?: string;
}

/**
 * Build a drilldown URL from entity and filters
 */
export function buildDrillDownUrl(config: DrillDownConfig): string {
  const params = new URLSearchParams();
  
  Object.entries(config.filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  
  if (config.title) {
    params.set('title', config.title);
  }
  
  return `/grabba/drilldown/${config.entity}?${params.toString()}`;
}

/**
 * Parse drilldown URL params into filters object
 */
export function parseDrillDownParams(searchParams: URLSearchParams): DrillDownFilters {
  const filters: DrillDownFilters = {};
  
  searchParams.forEach((value, key) => {
    if (key === 'title') return; // Skip title, it's metadata
    
    // Handle boolean values
    if (value === 'true') {
      filters[key] = true;
    } else if (value === 'false') {
      filters[key] = false;
    } else if (!isNaN(Number(value)) && key.includes('days') || key.includes('count')) {
      filters[key] = Number(value);
    } else {
      filters[key] = value;
    }
  });
  
  return filters;
}

/**
 * Get human-readable title for entity type
 */
export function getEntityTitle(entity: DrillDownEntity): string {
  const titles: Record<DrillDownEntity, string> = {
    stores: 'Stores',
    invoices: 'Invoices',
    deliveries: 'Deliveries',
    inventory: 'Inventory',
    drivers: 'Drivers',
    routes: 'Routes',
    orders: 'Orders',
    ambassadors: 'Ambassadors',
    commissions: 'Commissions',
  };
  return titles[entity] || entity;
}

/**
 * Get the table name for Supabase queries
 */
export function getEntityTable(entity: DrillDownEntity): string {
  const tables: Record<DrillDownEntity, string> = {
    stores: 'stores',
    invoices: 'invoices',
    deliveries: 'driver_route_stops',
    inventory: 'store_brand_accounts',
    drivers: 'grabba_drivers',
    routes: 'driver_routes',
    orders: 'wholesale_orders',
    ambassadors: 'ambassadors',
    commissions: 'ambassador_commissions',
  };
  return tables[entity] || entity;
}
