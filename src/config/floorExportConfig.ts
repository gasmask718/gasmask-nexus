/**
 * Floor Export Configuration
 * Maps each floor to its database tables and display metadata for export + analytics
 */

export interface FloorTableConfig {
  table: string;
  label: string;
  /** Columns to show in analytics summary */
  analyticsColumns?: { key: string; label: string; type: 'count' | 'sum' | 'avg' | 'latest' }[];
}

export interface FloorExportConfig {
  floorId: string;
  name: string;
  emoji: string;
  description: string;
  path: string;
  tables: FloorTableConfig[];
}

export const FLOOR_EXPORT_CONFIGS: FloorExportConfig[] = [
  {
    floorId: 'grabba-command',
    name: 'Grabba Command Penthouse',
    emoji: '🔥',
    description: 'Empire KPIs, AI insights, and cluster intelligence',
    path: '/grabba/export/command',
    tables: [
      { table: 'companies', label: 'Companies', analyticsColumns: [
        { key: 'id', label: 'Total Companies', type: 'count' },
      ]},
      { table: 'ai_recommendations', label: 'AI Recommendations', analyticsColumns: [
        { key: 'id', label: 'Total Recommendations', type: 'count' },
      ]},
      { table: 'ai_kpi_snapshots', label: 'KPI Snapshots', analyticsColumns: [
        { key: 'id', label: 'Total Snapshots', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-1-crm',
    name: 'CRM & Store Control',
    emoji: '🏢',
    description: 'All stores, contacts, companies, and store health data',
    path: '/grabba/export/floor1',
    tables: [
      { table: 'store_master', label: 'Store Master', analyticsColumns: [
        { key: 'id', label: 'Total Stores', type: 'count' },
        { key: 'owed_amount', label: 'Total Owed', type: 'sum' },
      ]},
      { table: 'store_contacts', label: 'Store Contacts', analyticsColumns: [
        { key: 'id', label: 'Total Contacts', type: 'count' },
      ]},
      { table: 'companies', label: 'Companies', analyticsColumns: [
        { key: 'id', label: 'Total Companies', type: 'count' },
      ]},
      // Legacy 'stores' table dropped 2026-06-04 — store_master is canonical.
      // Restoring stale shape would diverge field crews from CRM. Do not re-add.
    ],
  },
  {
    floorId: 'floor-2-communication',
    name: 'Communication Center',
    emoji: '📞',
    description: 'Call logs, SMS, email, campaigns, and AI agent activity',
    path: '/grabba/export/floor2',
    tables: [
      { table: 'ai_call_logs', label: 'AI Call Logs', analyticsColumns: [
        { key: 'id', label: 'Total Calls', type: 'count' },
        { key: 'duration_seconds', label: 'Avg Duration (s)', type: 'avg' },
      ]},
      { table: 'ai_call_campaigns', label: 'Call Campaigns', analyticsColumns: [
        { key: 'id', label: 'Total Campaigns', type: 'count' },
        { key: 'completed_calls', label: 'Completed Calls', type: 'sum' },
      ]},
      { table: 'ai_communication_queue', label: 'Communication Queue', analyticsColumns: [
        { key: 'id', label: 'Queued Messages', type: 'count' },
      ]},
      { table: 'ai_text_sequences', label: 'Text Sequences', analyticsColumns: [
        { key: 'id', label: 'Total Sequences', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-3-inventory',
    name: 'Inventory Engine',
    emoji: '📦',
    description: 'Tube counts, inventory movements, and consumption tracking',
    path: '/grabba/export/floor3',
    tables: [
      { table: 'store_tube_inventory', label: 'Store Tube Inventory', analyticsColumns: [
        { key: 'id', label: 'Inventory Records', type: 'count' },
        { key: 'current_count', label: 'Total Tubes', type: 'sum' },
      ]},
      { table: 'brand_inventory_movements', label: 'Inventory Movements', analyticsColumns: [
        { key: 'id', label: 'Total Movements', type: 'count' },
        { key: 'quantity', label: 'Total Quantity Moved', type: 'sum' },
      ]},
    ],
  },
  {
    floorId: 'floor-4-delivery',
    name: 'Delivery & Drivers',
    emoji: '🚴',
    description: 'Routes, drivers, bikers, assignments, and delivery operations',
    path: '/grabba/export/floor4',
    tables: [
      { table: 'biker_routes', label: 'Biker Routes', analyticsColumns: [
        { key: 'id', label: 'Total Routes', type: 'count' },
      ]},
      { table: 'biker_profiles', label: 'Biker Profiles', analyticsColumns: [
        { key: 'id', label: 'Total Bikers', type: 'count' },
      ]},
      { table: 'biker_assignments', label: 'Biker Assignments', analyticsColumns: [
        { key: 'id', label: 'Total Assignments', type: 'count' },
      ]},
      { table: 'biker_performance_daily', label: 'Biker Performance', analyticsColumns: [
        { key: 'id', label: 'Performance Records', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-5-orders',
    name: 'Orders & Invoices',
    emoji: '📑',
    description: 'Wholesale orders, invoices, payments, and billing data',
    path: '/grabba/export/floor5',
    tables: [
      { table: 'wholesale_orders', label: 'Wholesale Orders', analyticsColumns: [
        { key: 'id', label: 'Total Orders', type: 'count' },
        { key: 'total_amount', label: 'Total Revenue', type: 'sum' },
      ]},
      { table: 'accounting_ledger', label: 'Accounting Ledger', analyticsColumns: [
        { key: 'id', label: 'Ledger Entries', type: 'count' },
        { key: 'amount', label: 'Total Amount', type: 'sum' },
      ]},
      { table: 'invoices', label: 'Invoices', analyticsColumns: [
        { key: 'id', label: 'Total Invoices', type: 'count' },
        { key: 'amount', label: 'Total Invoiced', type: 'sum' },
      ]},
    ],
  },
  {
    floorId: 'floor-6-production',
    name: 'Production & Machinery',
    emoji: '🏭',
    description: 'Box output, production logs, and machinery service',
    path: '/grabba/export/floor6',
    tables: [
      { table: 'production_logs', label: 'Production Logs', analyticsColumns: [
        { key: 'id', label: 'Total Logs', type: 'count' },
      ]},
      { table: 'production_machines', label: 'Machines', analyticsColumns: [
        { key: 'id', label: 'Total Machines', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-7-wholesale',
    name: 'Wholesale Marketplace',
    emoji: '🏬',
    description: 'Marketplace orders, wholesaler uploads, and fulfillment data',
    path: '/grabba/export/floor7',
    tables: [
      { table: 'wholesale_orders', label: 'Wholesale Orders', analyticsColumns: [
        { key: 'id', label: 'Total Orders', type: 'count' },
        { key: 'total_amount', label: 'Total Revenue', type: 'sum' },
      ]},
      { table: 'marketplace_orders', label: 'Marketplace Orders', analyticsColumns: [
        { key: 'id', label: 'Marketplace Orders', type: 'count' },
      ]},
      { table: 'marketplace_products', label: 'Marketplace Products', analyticsColumns: [
        { key: 'id', label: 'Total Products', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-8-ambassadors',
    name: 'Ambassadors & Reps',
    emoji: '🤝',
    description: 'Ambassador profiles, commissions, payouts, and regional data',
    path: '/grabba/export/floor8',
    tables: [
      { table: 'ambassadors', label: 'Ambassadors', analyticsColumns: [
        { key: 'id', label: 'Total Ambassadors', type: 'count' },
      ]},
      { table: 'ambassador_commissions', label: 'Commissions', analyticsColumns: [
        { key: 'id', label: 'Total Commissions', type: 'count' },
        { key: 'amount', label: 'Total Commission $', type: 'sum' },
      ]},
      { table: 'ambassador_payout_history', label: 'Payout History', analyticsColumns: [
        { key: 'id', label: 'Total Payouts', type: 'count' },
        { key: 'amount', label: 'Total Paid', type: 'sum' },
      ]},
      { table: 'ambassador_regions', label: 'Regions', analyticsColumns: [
        { key: 'id', label: 'Total Regions', type: 'count' },
      ]},
    ],
  },
  {
    floorId: 'floor-9-ai',
    name: 'AI Operations Center',
    emoji: '🤖',
    description: 'AI tasks, action queue, decision logs, and performance metrics',
    path: '/grabba/export/floor9',
    tables: [
      { table: 'ai_work_tasks', label: 'AI Work Tasks', analyticsColumns: [
        { key: 'id', label: 'Total Tasks', type: 'count' },
      ]},
      { table: 'ai_action_queue', label: 'Action Queue', analyticsColumns: [
        { key: 'id', label: 'Queued Actions', type: 'count' },
      ]},
      { table: 'ai_decision_log', label: 'Decision Log', analyticsColumns: [
        { key: 'id', label: 'Total Decisions', type: 'count' },
      ]},
      { table: 'ai_feedback_entries', label: 'Feedback Entries', analyticsColumns: [
        { key: 'id', label: 'Total Feedback', type: 'count' },
      ]},
      { table: 'ai_performance_metrics', label: 'Performance Metrics', analyticsColumns: [
        { key: 'id', label: 'Metric Records', type: 'count' },
      ]},
    ],
  },
];
