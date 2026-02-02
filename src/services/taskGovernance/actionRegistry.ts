/**
 * Action Registry
 * Phase B: Task Coverage Audit
 * 
 * Maps all real-world button actions to governed task templates.
 * Every meaningful action must map to exactly one task template.
 */

import { FloorId, TaskRiskLevel } from './types';

// ============= ACTION → TASK MAPPING =============

export interface ActionMapping {
  action_id: string;
  action_name: string;
  button_label: string;
  floor_id: FloorId;
  task_type: string;
  task_title: string;
  risk_level: TaskRiskLevel;
  requires_approval: boolean;
  entity_type: string;
  mutation_type: 'create' | 'update' | 'delete' | 'batch' | 'sync';
  description: string;
}

export const ACTION_REGISTRY: ActionMapping[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 1 - CRM / STORE MASTER
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'crm_create_store',
    action_name: 'Create Store',
    button_label: 'Create Store',
    floor_id: 'floor1_crm',
    task_type: 'create_store',
    task_title: 'Create New Store',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'store',
    mutation_type: 'create',
    description: 'Add a new store to the system',
  },
  {
    action_id: 'crm_update_store',
    action_name: 'Update Store',
    button_label: 'Save Store',
    floor_id: 'floor1_crm',
    task_type: 'update_store',
    task_title: 'Update Store Information',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'store',
    mutation_type: 'update',
    description: 'Modify store details',
  },
  {
    action_id: 'crm_add_note',
    action_name: 'Add Note',
    button_label: 'Add Note',
    floor_id: 'floor1_crm',
    task_type: 'add_note',
    task_title: 'Add Contact Note',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'note',
    mutation_type: 'create',
    description: 'Add a note to a contact or store',
  },
  {
    action_id: 'crm_create_followup',
    action_name: 'Create Follow-up',
    button_label: 'Schedule Follow-up',
    floor_id: 'floor1_crm',
    task_type: 'create_followup',
    task_title: 'Schedule Follow-up',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'follow_up',
    mutation_type: 'create',
    description: 'Schedule a follow-up task',
  },
  {
    action_id: 'crm_bulk_update',
    action_name: 'Bulk Update Stores',
    button_label: 'Bulk Update',
    floor_id: 'floor1_crm',
    task_type: 'normalize_stores',
    task_title: 'Bulk Store Update',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'store',
    mutation_type: 'batch',
    description: 'Update multiple stores at once',
  },
  {
    action_id: 'crm_import_data',
    action_name: 'Import Data',
    button_label: 'Import',
    floor_id: 'floor1_crm',
    task_type: 'import_data',
    task_title: 'Import CRM Data',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'import',
    mutation_type: 'batch',
    description: 'Import data from external source',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 2 - COMMUNICATION HUB
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'comm_send_sms',
    action_name: 'Send SMS',
    button_label: 'Send',
    floor_id: 'floor2_communication',
    task_type: 'send_sms',
    task_title: 'Send SMS Message',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'sms',
    mutation_type: 'create',
    description: 'Send SMS to a contact',
  },
  {
    action_id: 'comm_send_email',
    action_name: 'Send Email',
    button_label: 'Send',
    floor_id: 'floor2_communication',
    task_type: 'send_email',
    task_title: 'Send Email',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'email',
    mutation_type: 'create',
    description: 'Send email to a contact',
  },
  {
    action_id: 'comm_bulk_sms',
    action_name: 'Bulk SMS',
    button_label: 'Send Campaign',
    floor_id: 'floor2_communication',
    task_type: 'bulk_sms',
    task_title: 'Send Bulk SMS Campaign',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'campaign',
    mutation_type: 'batch',
    description: 'Send SMS to multiple recipients',
  },
  {
    action_id: 'comm_log_call',
    action_name: 'Log Call',
    button_label: 'Log Call',
    floor_id: 'floor2_communication',
    task_type: 'log_call',
    task_title: 'Log Phone Call',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'call',
    mutation_type: 'create',
    description: 'Log a completed phone call',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 3 - INVENTORY
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'inv_adjust_stock',
    action_name: 'Adjust Stock',
    button_label: 'Adjust',
    floor_id: 'floor3_inventory',
    task_type: 'adjust_stock',
    task_title: 'Adjust Inventory Stock',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'inventory',
    mutation_type: 'update',
    description: 'Adjust inventory quantities',
  },
  {
    action_id: 'inv_transfer_stock',
    action_name: 'Transfer Stock',
    button_label: 'Transfer',
    floor_id: 'floor3_inventory',
    task_type: 'transfer_stock',
    task_title: 'Transfer Inventory',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'transfer',
    mutation_type: 'create',
    description: 'Transfer stock between locations',
  },
  {
    action_id: 'inv_receive_shipment',
    action_name: 'Receive Shipment',
    button_label: 'Receive',
    floor_id: 'floor3_inventory',
    task_type: 'receive_shipment',
    task_title: 'Receive Inventory Shipment',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'shipment',
    mutation_type: 'create',
    description: 'Record incoming shipment',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 4 - DELIVERY & ROUTING
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'del_create_route',
    action_name: 'Create Route',
    button_label: 'Create Route',
    floor_id: 'floor4_delivery',
    task_type: 'create_route',
    task_title: 'Create Delivery Route',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'route',
    mutation_type: 'create',
    description: 'Create a new delivery route',
  },
  {
    action_id: 'del_assign_stops',
    action_name: 'Assign Stops',
    button_label: 'Add to Route',
    floor_id: 'floor4_delivery',
    task_type: 'assign_stops',
    task_title: 'Assign Stops to Route',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'stop',
    mutation_type: 'batch',
    description: 'Add stops to a delivery route',
  },
  {
    action_id: 'del_optimize_route',
    action_name: 'Optimize Route',
    button_label: 'Optimize',
    floor_id: 'floor4_delivery',
    task_type: 'route_optimization',
    task_title: 'Optimize Delivery Route',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'route',
    mutation_type: 'update',
    description: 'AI-powered route optimization',
  },
  {
    action_id: 'del_complete_delivery',
    action_name: 'Complete Delivery',
    button_label: 'Complete',
    floor_id: 'floor4_delivery',
    task_type: 'complete_delivery',
    task_title: 'Mark Delivery Complete',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'delivery',
    mutation_type: 'update',
    description: 'Mark a delivery as completed',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 5 - FINANCE & ORDERS (HIGH RISK)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'fin_create_order',
    action_name: 'Create Order',
    button_label: 'Create Order',
    floor_id: 'floor5_finance',
    task_type: 'create_order',
    task_title: 'Create New Order',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'order',
    mutation_type: 'create',
    description: 'Create a new sales order',
  },
  {
    action_id: 'fin_create_invoice',
    action_name: 'Create Invoice',
    button_label: 'Create Invoice',
    floor_id: 'floor5_finance',
    task_type: 'invoice_creation',
    task_title: 'Create Invoice',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'invoice',
    mutation_type: 'create',
    description: 'Generate a new invoice',
  },
  {
    action_id: 'fin_batch_invoice',
    action_name: 'Batch Invoices',
    button_label: 'Generate Invoices',
    floor_id: 'floor5_finance',
    task_type: 'invoice_creation',
    task_title: 'Batch Invoice Generation',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'invoice',
    mutation_type: 'batch',
    description: 'Generate multiple invoices',
  },
  {
    action_id: 'fin_record_payment',
    action_name: 'Record Payment',
    button_label: 'Record Payment',
    floor_id: 'floor5_finance',
    task_type: 'record_payment',
    task_title: 'Record Payment',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'payment',
    mutation_type: 'create',
    description: 'Record an incoming payment',
  },
  {
    action_id: 'fin_void_invoice',
    action_name: 'Void Invoice',
    button_label: 'Void',
    floor_id: 'floor5_finance',
    task_type: 'void_invoice',
    task_title: 'Void Invoice',
    risk_level: 'critical',
    requires_approval: true,
    entity_type: 'invoice',
    mutation_type: 'update',
    description: 'Void an existing invoice',
  },
  {
    action_id: 'fin_ledger_entry',
    action_name: 'Create Ledger Entry',
    button_label: 'Add Entry',
    floor_id: 'floor5_finance',
    task_type: 'ledger_entry',
    task_title: 'Create Ledger Entry',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'ledger',
    mutation_type: 'create',
    description: 'Add entry to accounting ledger',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 6 - PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'prod_create_batch',
    action_name: 'Create Batch',
    button_label: 'Create Batch',
    floor_id: 'floor6_production',
    task_type: 'create_batch',
    task_title: 'Create Production Batch',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'batch',
    mutation_type: 'create',
    description: 'Create a new production batch',
  },
  {
    action_id: 'prod_close_batch',
    action_name: 'Close Batch',
    button_label: 'Close Batch',
    floor_id: 'floor6_production',
    task_type: 'close_batch',
    task_title: 'Close Production Batch',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'batch',
    mutation_type: 'update',
    description: 'Close and finalize a production batch',
  },
  {
    action_id: 'prod_record_output',
    action_name: 'Record Output',
    button_label: 'Record',
    floor_id: 'floor6_production',
    task_type: 'record_output',
    task_title: 'Record Production Output',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'output',
    mutation_type: 'create',
    description: 'Record production output',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 7 - MARKETPLACE / WHOLESALE
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'mkt_update_pricing',
    action_name: 'Update Pricing',
    button_label: 'Update Prices',
    floor_id: 'floor7_marketplace',
    task_type: 'pricing_validation',
    task_title: 'Update Product Pricing',
    risk_level: 'high',
    requires_approval: true,
    entity_type: 'pricing',
    mutation_type: 'batch',
    description: 'Update product pricing',
  },
  {
    action_id: 'mkt_process_order',
    action_name: 'Process Order',
    button_label: 'Process',
    floor_id: 'floor7_marketplace',
    task_type: 'process_order',
    task_title: 'Process Wholesale Order',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'order',
    mutation_type: 'update',
    description: 'Process a wholesale order',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 8 - AMBASSADORS
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'amb_assign_store',
    action_name: 'Assign Store',
    button_label: 'Assign',
    floor_id: 'floor8_ambassadors',
    task_type: 'assign_store',
    task_title: 'Assign Store to Ambassador',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'assignment',
    mutation_type: 'create',
    description: 'Assign a store to an ambassador',
  },
  {
    action_id: 'amb_calculate_payout',
    action_name: 'Calculate Payout',
    button_label: 'Calculate',
    floor_id: 'floor8_ambassadors',
    task_type: 'payout_recalculation',
    task_title: 'Calculate Ambassador Payout',
    risk_level: 'critical',
    requires_approval: true,
    entity_type: 'payout',
    mutation_type: 'create',
    description: 'Calculate and record ambassador payout',
  },
  {
    action_id: 'amb_process_payout',
    action_name: 'Process Payout',
    button_label: 'Process Payout',
    floor_id: 'floor8_ambassadors',
    task_type: 'process_payout',
    task_title: 'Process Ambassador Payout',
    risk_level: 'critical',
    requires_approval: true,
    entity_type: 'payout',
    mutation_type: 'update',
    description: 'Execute ambassador payout',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOOR 9 - AI OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    action_id: 'ai_execute_task',
    action_name: 'Execute AI Task',
    button_label: 'Execute',
    floor_id: 'floor9_ai',
    task_type: 'execute_ai_task',
    task_title: 'Execute AI Task',
    risk_level: 'medium',
    requires_approval: true,
    entity_type: 'task',
    mutation_type: 'create',
    description: 'Execute an AI-driven task',
  },
  {
    action_id: 'ai_approve_action',
    action_name: 'Approve AI Action',
    button_label: 'Approve',
    floor_id: 'floor9_ai',
    task_type: 'approve_action',
    task_title: 'Approve AI Action',
    risk_level: 'medium',
    requires_approval: false,
    entity_type: 'action',
    mutation_type: 'update',
    description: 'Approve a pending AI action',
  },
  {
    action_id: 'ai_reject_action',
    action_name: 'Reject AI Action',
    button_label: 'Reject',
    floor_id: 'floor9_ai',
    task_type: 'reject_action',
    task_title: 'Reject AI Action',
    risk_level: 'low',
    requires_approval: false,
    entity_type: 'action',
    mutation_type: 'update',
    description: 'Reject a pending AI action',
  },
];

// ============= LOOKUP FUNCTIONS =============

export function getActionMapping(actionId: string): ActionMapping | undefined {
  return ACTION_REGISTRY.find(a => a.action_id === actionId);
}

export function getActionsByFloor(floorId: FloorId): ActionMapping[] {
  return ACTION_REGISTRY.filter(a => a.floor_id === floorId);
}

export function getActionsByRisk(riskLevel: TaskRiskLevel): ActionMapping[] {
  return ACTION_REGISTRY.filter(a => a.risk_level === riskLevel);
}

export function getHighRiskActions(): ActionMapping[] {
  return ACTION_REGISTRY.filter(a => a.risk_level === 'high' || a.risk_level === 'critical');
}

export function getActionsRequiringApproval(): ActionMapping[] {
  return ACTION_REGISTRY.filter(a => a.requires_approval);
}

// ============= AUDIT HELPERS =============

export interface ActionCoverageReport {
  total_actions: number;
  by_floor: Record<FloorId, number>;
  by_risk: Record<TaskRiskLevel, number>;
  requiring_approval: number;
  missing_task_templates: string[];
}

export function generateActionCoverageReport(): ActionCoverageReport {
  const byFloor: Record<string, number> = {};
  const byRisk: Record<TaskRiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const action of ACTION_REGISTRY) {
    byFloor[action.floor_id] = (byFloor[action.floor_id] || 0) + 1;
    byRisk[action.risk_level]++;
  }

  return {
    total_actions: ACTION_REGISTRY.length,
    by_floor: byFloor as Record<FloorId, number>,
    by_risk: byRisk,
    requiring_approval: ACTION_REGISTRY.filter(a => a.requires_approval).length,
    missing_task_templates: [], // TODO: Cross-reference with taskRegistry
  };
}
