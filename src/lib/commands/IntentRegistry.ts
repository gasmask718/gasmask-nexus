// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA INTENT REGISTRY — Natural Language Intent Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export type QueryIntent =
  | 'query_unpaid'
  | 'query_no_visit'
  | 'query_low_inventory'
  | 'query_unassigned_stores'
  | 'query_route_gaps'
  | 'query_revenue'
  | 'query_store_activity'
  | 'query_ambassador_performance'
  | 'query_wholesale_items'
  | 'query_production'
  | 'query_missing_inventory'
  | 'query_driver_payments'
  | 'query_unpaid_orders'
  | 'query_unconfirmed_communications'
  | 'query_failed_deliveries'
  | 'query_slow_stores'
  | 'query_high_debt'
  | 'unknown';

export type ActionIntent =
  | 'assign'
  | 'create'
  | 'update'
  | 'notify'
  | 'text'
  | 'route'
  | 'escalate'
  | 'export';

export interface IntentDefinition {
  id: QueryIntent;
  name: string;
  description: string;
  keywords: string[];
  shortcuts: string[];
  floorId: string;
  suggestedActions: ActionIntent[];
}

export const INTENT_REGISTRY: IntentDefinition[] = [
  {
    id: 'query_unpaid',
    name: 'Unpaid Stores/Invoices',
    description: 'Find all stores or invoices with outstanding balances',
    keywords: ['unpaid', 'owe', 'owing', 'balance', 'debt', 'outstanding', 'overdue', 'not paid'],
    shortcuts: ['/unpaid', '/debt', '/owed'],
    floorId: 'floor-5-orders',
    suggestedActions: ['notify', 'escalate', 'export'],
  },
  {
    id: 'query_no_visit',
    name: 'Stores Without Recent Visits',
    description: 'Find stores that have not been visited recently',
    keywords: ['no visit', "haven't seen", 'not visited', 'days ago', 'inactive', 'no contact', 'missing'],
    shortcuts: ['/novisit', '/inactive'],
    floorId: 'floor-1-crm',
    suggestedActions: ['route', 'assign', 'notify'],
  },
  {
    id: 'query_low_inventory',
    name: 'Low Inventory Alert',
    description: 'Find items with low stock levels',
    keywords: ['low stock', 'low inventory', 'running out', 'need restock', 'below threshold', 'critical stock'],
    shortcuts: ['/lowstock', '/inventory'],
    floorId: 'floor-3-inventory',
    suggestedActions: ['create', 'notify'],
  },
  {
    id: 'query_unassigned_stores',
    name: 'Unassigned Stores',
    description: 'Find stores not assigned to any route or driver',
    keywords: ['unassigned', 'no driver', 'no route', 'not assigned', 'orphan stores'],
    shortcuts: ['/unassigned'],
    floorId: 'floor-4-delivery',
    suggestedActions: ['assign', 'route'],
  },
  {
    id: 'query_route_gaps',
    name: 'Route Gaps',
    description: 'Find gaps or issues in delivery routes',
    keywords: ['route gap', 'missing route', 'route issue', 'delivery gap'],
    shortcuts: ['/routegap'],
    floorId: 'floor-4-delivery',
    suggestedActions: ['assign', 'route'],
  },
  {
    id: 'query_revenue',
    name: 'Revenue Report',
    description: 'Get revenue breakdown by brand or period',
    keywords: ['revenue', 'sales', 'income', 'earnings', 'money made', 'total sales'],
    shortcuts: ['/revenue', '/sales'],
    floorId: 'floor-5-orders',
    suggestedActions: ['export'],
  },
  {
    id: 'query_store_activity',
    name: 'Store Activity',
    description: 'Get activity metrics for stores',
    keywords: ['store activity', 'active stores', 'store performance', 'busy stores'],
    shortcuts: ['/activity'],
    floorId: 'floor-1-crm',
    suggestedActions: ['export', 'notify'],
  },
  {
    id: 'query_ambassador_performance',
    name: 'Ambassador Performance',
    description: 'Get performance metrics for ambassadors',
    keywords: ['ambassador', 'performance', 'poor performance', 'top performer', 'sales rep'],
    shortcuts: ['/ambassador'],
    floorId: 'floor-8-ambassadors',
    suggestedActions: ['notify', 'assign'],
  },
  {
    id: 'query_wholesale_items',
    name: 'Wholesale Items',
    description: 'Find wholesale products and inventory',
    keywords: ['wholesale', 'products', 'items', 'catalog', 'marketplace'],
    shortcuts: ['/wholesale'],
    floorId: 'floor-7-wholesale',
    suggestedActions: ['create', 'update'],
  },
  {
    id: 'query_production',
    name: 'Production Status',
    description: 'Get production batch status and metrics',
    keywords: ['production', 'batch', 'manufacturing', 'boxes', 'tubes made'],
    shortcuts: ['/production'],
    floorId: 'floor-6-production',
    suggestedActions: ['create'],
  },
  {
    id: 'query_missing_inventory',
    name: 'Missing Inventory',
    description: 'Find discrepancies between expected and actual inventory',
    keywords: ['missing', 'discrepancy', 'lost', 'variance', 'mismatch'],
    shortcuts: ['/missing'],
    floorId: 'floor-3-inventory',
    suggestedActions: ['escalate', 'notify'],
  },
  {
    id: 'query_driver_payments',
    name: 'Driver Payments',
    description: 'Get driver payment status and dues',
    keywords: ['driver payment', 'driver due', 'biker payout', 'delivery pay'],
    shortcuts: ['/driverpay'],
    floorId: 'floor-5-orders',
    suggestedActions: ['notify', 'export'],
  },
  {
    id: 'query_unpaid_orders',
    name: 'Unpaid Orders',
    description: 'Find orders that have not been paid',
    keywords: ['unpaid order', 'order not paid', 'pending payment'],
    shortcuts: ['/unpaidorders'],
    floorId: 'floor-5-orders',
    suggestedActions: ['notify', 'escalate'],
  },
  {
    id: 'query_unconfirmed_communications',
    name: 'Unconfirmed Communications',
    description: 'Find messages without response',
    keywords: ['no response', 'unconfirmed', 'unanswered', 'no reply'],
    shortcuts: ['/noresponse'],
    floorId: 'floor-2-communication',
    suggestedActions: ['notify', 'text'],
  },
  {
    id: 'query_failed_deliveries',
    name: 'Failed Deliveries',
    description: 'Find deliveries that failed or were not completed',
    keywords: ['failed delivery', 'delivery failed', 'not delivered', 'delivery issue'],
    shortcuts: ['/failed'],
    floorId: 'floor-4-delivery',
    suggestedActions: ['assign', 'route', 'notify'],
  },
  {
    id: 'query_slow_stores',
    name: 'Slow Stores',
    description: 'Find stores with declining activity or orders',
    keywords: ['slow store', 'declining', 'inactive store', 'dropping'],
    shortcuts: ['/slow'],
    floorId: 'floor-1-crm',
    suggestedActions: ['notify', 'assign'],
  },
  {
    id: 'query_high_debt',
    name: 'High Debt Stores',
    description: 'Find stores with debt above threshold',
    keywords: ['high debt', 'owe more than', 'over $', 'debt above'],
    shortcuts: ['/highdebt'],
    floorId: 'floor-5-orders',
    suggestedActions: ['escalate', 'notify'],
  },
];

export function getIntentById(id: QueryIntent): IntentDefinition | undefined {
  return INTENT_REGISTRY.find((intent) => intent.id === id);
}

export function getIntentsByFloor(floorId: string): IntentDefinition[] {
  return INTENT_REGISTRY.filter((intent) => intent.floorId === floorId);
}

export function getAllShortcuts(): Record<string, QueryIntent> {
  const shortcuts: Record<string, QueryIntent> = {};
  INTENT_REGISTRY.forEach((intent) => {
    intent.shortcuts.forEach((shortcut) => {
      shortcuts[shortcut] = intent.id;
    });
  });
  return shortcuts;
}
