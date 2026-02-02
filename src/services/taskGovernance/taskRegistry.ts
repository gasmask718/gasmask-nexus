/**
 * Global Task Registry
 * Defines available tasks for each floor (1-9)
 */

import { FloorId, FloorTaskRegistry, TaskTemplate } from './types';

// Floor 1 - CRM / Store Master
const floor1Tasks: TaskTemplate[] = [
  {
    id: 'crm_backfill_notes',
    floor_id: 'floor1_crm',
    task_type: 'backfill_notes',
    task_title: 'Backfill Store Notes',
    description: 'Analyze store history and generate missing contact notes',
    category: 'data_enrichment',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 15,
    icon: 'FileText',
  },
  {
    id: 'crm_clean_contacts',
    floor_id: 'floor1_crm',
    task_type: 'clean_contacts',
    task_title: 'Clean Contact Data',
    description: 'Normalize phone numbers, emails, and address formatting',
    category: 'data_quality',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'UserCheck',
  },
  {
    id: 'crm_verify_followups',
    floor_id: 'floor1_crm',
    task_type: 'verify_followups',
    task_title: 'Verify Follow-up Completion',
    description: 'Audit scheduled follow-ups and flag overdue items',
    category: 'compliance',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 10,
    icon: 'ClipboardCheck',
  },
  {
    id: 'crm_normalize_stores',
    floor_id: 'floor1_crm',
    task_type: 'normalize_stores',
    task_title: 'Normalize Store Data',
    description: 'Standardize store classifications, tiers, and metadata',
    category: 'data_quality',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 20,
    icon: 'Building2',
  },
];

// Floor 2 - Communication Hub
const floor2Tasks: TaskTemplate[] = [
  {
    id: 'comm_campaign_audit',
    floor_id: 'floor2_communication',
    task_type: 'campaign_audit',
    task_title: 'Campaign Send Audit',
    description: 'Verify campaign delivery status and flag failures',
    category: 'audit',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 10,
    icon: 'Send',
  },
  {
    id: 'comm_disposition_cleanup',
    floor_id: 'floor2_communication',
    task_type: 'disposition_cleanup',
    task_title: 'Call Disposition Cleanup',
    description: 'Categorize uncategorized calls and update dispositions',
    category: 'data_quality',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 20,
    icon: 'Phone',
  },
  {
    id: 'comm_inbox_triage',
    floor_id: 'floor2_communication',
    task_type: 'inbox_triage',
    task_title: 'Inbox Triage',
    description: 'Prioritize and categorize incoming messages',
    category: 'workflow',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 15,
    icon: 'Inbox',
  },
  {
    id: 'comm_ai_followups',
    floor_id: 'floor2_communication',
    task_type: 'ai_followups',
    task_title: 'AI Follow-up Generation',
    description: 'Generate follow-up drafts for pending conversations',
    category: 'automation',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 25,
    icon: 'MessageSquare',
  },
];

// Floor 3 - Inventory Engine
const floor3Tasks: TaskTemplate[] = [
  {
    id: 'inv_reconciliation',
    floor_id: 'floor3_inventory',
    task_type: 'inventory_reconciliation',
    task_title: 'Inventory Reconciliation',
    description: 'Compare physical counts vs system records',
    category: 'audit',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 45,
    icon: 'Package',
  },
  {
    id: 'inv_count_audit',
    floor_id: 'floor3_inventory',
    task_type: 'count_audit',
    task_title: 'Count Accuracy Audit',
    description: 'Verify inventory counts and flag discrepancies',
    category: 'audit',
    risk_level: 'medium',
    requires_approval: false,
    estimated_duration_minutes: 20,
    icon: 'ClipboardList',
  },
  {
    id: 'inv_low_stock_detection',
    floor_id: 'floor3_inventory',
    task_type: 'low_stock_detection',
    task_title: 'Low Stock Detection',
    description: 'Identify items below reorder threshold',
    category: 'alert',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 5,
    icon: 'AlertTriangle',
  },
  {
    id: 'inv_supplier_sync',
    floor_id: 'floor3_inventory',
    task_type: 'supplier_sync',
    task_title: 'Supplier Data Sync',
    description: 'Synchronize supplier pricing and availability',
    category: 'integration',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 15,
    icon: 'RefreshCw',
  },
];

// Floor 4 - Delivery & Routing
const floor4Tasks: TaskTemplate[] = [
  {
    id: 'del_route_optimization',
    floor_id: 'floor4_delivery',
    task_type: 'route_optimization',
    task_title: 'Route Optimization',
    description: 'Optimize delivery routes for efficiency',
    category: 'optimization',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'Route',
  },
  {
    id: 'del_capacity_recalc',
    floor_id: 'floor4_delivery',
    task_type: 'capacity_recalculation',
    task_title: 'Capacity Recalculation',
    description: 'Recalculate driver and vehicle capacity',
    category: 'planning',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 10,
    icon: 'Truck',
  },
  {
    id: 'del_exception_resolution',
    floor_id: 'floor4_delivery',
    task_type: 'exception_resolution',
    task_title: 'Delivery Exception Resolution',
    description: 'Resolve failed delivery attempts and exceptions',
    category: 'workflow',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 20,
    icon: 'AlertCircle',
  },
  {
    id: 'del_reconciliation',
    floor_id: 'floor4_delivery',
    task_type: 'delivery_reconciliation',
    task_title: 'Delivery Reconciliation',
    description: 'Match deliveries to orders and flag discrepancies',
    category: 'audit',
    risk_level: 'medium',
    requires_approval: false,
    estimated_duration_minutes: 15,
    icon: 'CheckSquare',
  },
];

// Floor 5 - Finance & Orders
const floor5Tasks: TaskTemplate[] = [
  {
    id: 'fin_invoice_creation',
    floor_id: 'floor5_finance',
    task_type: 'invoice_creation',
    task_title: 'Batch Invoice Creation',
    description: 'Generate invoices for completed orders',
    category: 'finance',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'FileText',
  },
  {
    id: 'fin_invoice_reconciliation',
    floor_id: 'floor5_finance',
    task_type: 'invoice_reconciliation',
    task_title: 'Invoice Reconciliation',
    description: 'Match invoices to payments and flag discrepancies',
    category: 'audit',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 45,
    icon: 'Scale',
  },
  {
    id: 'fin_unpaid_audit',
    floor_id: 'floor5_finance',
    task_type: 'unpaid_account_audit',
    task_title: 'Unpaid Account Audit',
    description: 'Identify overdue accounts and generate collection list',
    category: 'collections',
    risk_level: 'medium',
    requires_approval: false,
    estimated_duration_minutes: 20,
    icon: 'DollarSign',
  },
  {
    id: 'fin_ledger_validation',
    floor_id: 'floor5_finance',
    task_type: 'ledger_validation',
    task_title: 'Ledger Validation',
    description: 'Validate ledger entries and flag anomalies',
    category: 'audit',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 60,
    icon: 'BookOpen',
  },
];

// Floor 6 - Production
const floor6Tasks: TaskTemplate[] = [
  {
    id: 'prod_work_order_gen',
    floor_id: 'floor6_production',
    task_type: 'work_order_generation',
    task_title: 'Work Order Generation',
    description: 'Generate work orders based on demand forecast',
    category: 'planning',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 20,
    icon: 'Factory',
  },
  {
    id: 'prod_backfill',
    floor_id: 'floor6_production',
    task_type: 'production_backfill',
    task_title: 'Production Data Backfill',
    description: 'Fill missing production records from logs',
    category: 'data_quality',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'Database',
  },
  {
    id: 'prod_exception_audit',
    floor_id: 'floor6_production',
    task_type: 'exception_audit',
    task_title: 'Production Exception Audit',
    description: 'Review production exceptions and quality issues',
    category: 'audit',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 15,
    icon: 'Clipboard',
  },
];

// Floor 7 - Marketplace / Wholesale
const floor7Tasks: TaskTemplate[] = [
  {
    id: 'mkt_order_cleanup',
    floor_id: 'floor7_marketplace',
    task_type: 'order_cleanup',
    task_title: 'Order Data Cleanup',
    description: 'Clean and normalize marketplace order data',
    category: 'data_quality',
    risk_level: 'medium',
    requires_approval: true,
    estimated_duration_minutes: 25,
    icon: 'ShoppingCart',
  },
  {
    id: 'mkt_vendor_audit',
    floor_id: 'floor7_marketplace',
    task_type: 'vendor_audit',
    task_title: 'Vendor Compliance Audit',
    description: 'Audit vendor performance and compliance',
    category: 'audit',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 20,
    icon: 'Users',
  },
  {
    id: 'mkt_pricing_validation',
    floor_id: 'floor7_marketplace',
    task_type: 'pricing_validation',
    task_title: 'Pricing Validation',
    description: 'Validate pricing consistency across channels',
    category: 'audit',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'Tag',
  },
];

// Floor 8 - Ambassadors & Reps
const floor8Tasks: TaskTemplate[] = [
  {
    id: 'amb_attribution_audit',
    floor_id: 'floor8_ambassadors',
    task_type: 'attribution_audit',
    task_title: 'Store Attribution Audit',
    description: 'Verify store-ambassador attribution accuracy',
    category: 'audit',
    risk_level: 'medium',
    requires_approval: false,
    estimated_duration_minutes: 20,
    icon: 'Link',
  },
  {
    id: 'amb_payout_recalc',
    floor_id: 'floor8_ambassadors',
    task_type: 'payout_recalculation',
    task_title: 'Payout Recalculation',
    description: 'Recalculate ambassador commissions and payouts',
    category: 'finance',
    risk_level: 'critical',
    requires_approval: true,
    estimated_duration_minutes: 45,
    icon: 'Calculator',
  },
  {
    id: 'amb_performance_review',
    floor_id: 'floor8_ambassadors',
    task_type: 'performance_review',
    task_title: 'Performance Review Generation',
    description: 'Generate performance summaries for ambassadors',
    category: 'reporting',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 15,
    icon: 'TrendingUp',
  },
];

// Floor 9 - AI Operations (source of truth)
const floor9Tasks: TaskTemplate[] = [
  {
    id: 'ai_worker_health_check',
    floor_id: 'floor9_ai',
    task_type: 'worker_health_check',
    task_title: 'AI Worker Health Check',
    description: 'Verify AI worker status and performance metrics',
    category: 'monitoring',
    risk_level: 'low',
    requires_approval: false,
    estimated_duration_minutes: 5,
    icon: 'Activity',
  },
  {
    id: 'ai_playbook_audit',
    floor_id: 'floor9_ai',
    task_type: 'playbook_audit',
    task_title: 'Playbook Compliance Audit',
    description: 'Audit AI playbook execution and compliance',
    category: 'audit',
    risk_level: 'medium',
    requires_approval: false,
    estimated_duration_minutes: 20,
    icon: 'BookOpen',
  },
  {
    id: 'ai_confidence_calibration',
    floor_id: 'floor9_ai',
    task_type: 'confidence_calibration',
    task_title: 'Confidence Score Calibration',
    description: 'Recalibrate AI confidence scores based on feedback',
    category: 'optimization',
    risk_level: 'high',
    requires_approval: true,
    estimated_duration_minutes: 30,
    icon: 'Sliders',
  },
];

// Complete floor registry
export const FLOOR_REGISTRIES: FloorTaskRegistry[] = [
  {
    floor_id: 'floor1_crm',
    floor_name: 'CRM / Store Master',
    floor_icon: 'Building2',
    available_tasks: floor1Tasks,
  },
  {
    floor_id: 'floor2_communication',
    floor_name: 'Communication Hub',
    floor_icon: 'MessageSquare',
    available_tasks: floor2Tasks,
  },
  {
    floor_id: 'floor3_inventory',
    floor_name: 'Inventory Engine',
    floor_icon: 'Package',
    available_tasks: floor3Tasks,
  },
  {
    floor_id: 'floor4_delivery',
    floor_name: 'Delivery & Routing',
    floor_icon: 'Truck',
    available_tasks: floor4Tasks,
  },
  {
    floor_id: 'floor5_finance',
    floor_name: 'Finance & Orders',
    floor_icon: 'DollarSign',
    available_tasks: floor5Tasks,
  },
  {
    floor_id: 'floor6_production',
    floor_name: 'Production',
    floor_icon: 'Factory',
    available_tasks: floor6Tasks,
  },
  {
    floor_id: 'floor7_marketplace',
    floor_name: 'Marketplace / Wholesale',
    floor_icon: 'ShoppingCart',
    available_tasks: floor7Tasks,
  },
  {
    floor_id: 'floor8_ambassadors',
    floor_name: 'Ambassadors & Reps',
    floor_icon: 'Users',
    available_tasks: floor8Tasks,
  },
  {
    floor_id: 'floor9_ai',
    floor_name: 'AI Operations',
    floor_icon: 'Brain',
    available_tasks: floor9Tasks,
  },
];

// Helper functions
export function getFloorRegistry(floorId: FloorId): FloorTaskRegistry | undefined {
  return FLOOR_REGISTRIES.find(r => r.floor_id === floorId);
}

export function getTaskTemplate(taskId: string): TaskTemplate | undefined {
  for (const registry of FLOOR_REGISTRIES) {
    const task = registry.available_tasks.find(t => t.id === taskId);
    if (task) return task;
  }
  return undefined;
}

export function getAllTasks(): TaskTemplate[] {
  return FLOOR_REGISTRIES.flatMap(r => r.available_tasks);
}

export function getTasksByFloor(floorId: FloorId): TaskTemplate[] {
  const registry = getFloorRegistry(floorId);
  return registry?.available_tasks || [];
}

export function getTasksByCategory(category: string): TaskTemplate[] {
  return getAllTasks().filter(t => t.category === category);
}

export function getHighRiskTasks(): TaskTemplate[] {
  return getAllTasks().filter(t => t.risk_level === 'high' || t.risk_level === 'critical');
}
