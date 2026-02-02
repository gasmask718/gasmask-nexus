/**
 * PHASE E — BYPASS AUDIT REPORT
 * Governance Verification & Production Lockdown
 * 
 * Generated: 2026-02-02
 * 
 * This document reports on all direct database mutation paths found in the codebase.
 * Each occurrence must be either:
 * 1. Wrapped in governance (useGovernedAction/createGovernedTask)
 * 2. Added to the allowed direct writes list (system-level tables)
 * 3. Refactored to use governance
 * 
 * FINDINGS SUMMARY:
 * ================
 * - Total files with direct mutations: 100+
 * - Total direct mutation calls: 919+
 * - Files using governance: 7
 * 
 * CRITICAL: Many mutations are NOT yet wrapped in governance.
 * 
 * ALLOWED DIRECT WRITES (System Tables):
 * =====================================
 * These tables are allowed direct writes because they are:
 * - Audit/logging tables (must be low-latency, no overhead)
 * - Security event tables (must not be blocked)
 * - Offline queue tables (already cryptographically signed)
 * - Governance tables themselves (avoid circular dependency)
 * 
 * Allowed tables:
 * - portal_audit_log
 * - portal_security_events
 * - portal_devices
 * - admin_impersonation_log
 * - admin_audit_log
 * - ai_task_activity_log
 * - governed_tasks / ai_work_tasks
 * - profiles (auth-related)
 * - portal_action_queue (offline, signed)
 * 
 * HIGH-PRIORITY BYPASS PATHS (MUST FIX BEFORE PRODUCTION):
 * ========================================================
 * 
 * FLOOR 1 - CRM:
 * - src/components/crm/CustomerNotesSimpleEditor.tsx (line 30-34)
 *   VIOLATION: Direct update to 'people' table
 *   FIX: Wrap in GovernedButton with action 'crm_update_contact'
 * 
 * FLOOR 2 - COMMUNICATION:
 * - src/pages/communication/manual/ManualCallPage.tsx (line 102)
 *   VIOLATION: Direct insert to 'communication_logs'
 *   STATUS: ALLOWED - This is a logging table
 * 
 * - src/components/communication/AutoCampaigns.tsx (lines 61, 81)
 *   VIOLATION: Direct insert/update to 'ai_text_sequences'
 *   FIX: Wrap in governance with action 'comm_create_campaign'
 * 
 * FLOOR 3 - INVENTORY:
 * - src/lib/inventory/calculateReorderSuggestions.ts (line 198)
 *   VIOLATION: Direct insert to 'purchase_order_items'
 *   FIX: Wrap in governance with action 'inv_create_po'
 * 
 * FLOOR 4 - DELIVERY:
 * - src/pages/delivery/BikerTasks.tsx (lines 122, 136)
 *   VIOLATION: Direct update/insert to 'store_checks'
 *   FIX: Wrap in governance with action 'del_update_check'
 * 
 * FLOOR 5 - FINANCE:
 * - src/components/communication/deals/CreateDealDialog.tsx (line 65)
 *   VIOLATION: Direct insert to 'deals'
 *   FIX: Wrap in GovernedButton with action 'fin_create_deal'
 * 
 * FLOOR 6 - PRODUCTION:
 * - (Audit in progress - multiple files)
 * 
 * FLOOR 7 - MARKETPLACE:
 * - (Audit in progress - multiple files)
 * 
 * FLOOR 8 - AMBASSADORS:
 * - src/contexts/ViewAsContext.tsx (line 79)
 *   VIOLATION: Direct insert to 'admin_impersonation_log'
 *   STATUS: ALLOWED - This is an audit table
 * 
 * FLOOR 9 - AI OPS:
 * - Governance services themselves
 *   STATUS: ALLOWED - Core governance infrastructure
 * 
 * MEDIUM-PRIORITY (Dynamic/UI Config):
 * ====================================
 * - src/hooks/useDynamicKPIs.ts (lines 367, 375, 382, etc.)
 *   VIOLATION: Direct updates to kpi_categories, kpi_definitions
 *   STATUS: LOW RISK - UI configuration only, no financial impact
 *   FIX: Consider wrapping in governance for audit trail
 * 
 * LOW-PRIORITY (Real Estate/Holdings):
 * ====================================
 * - src/pages/HoldingsStrategy.tsx (line 88)
 *   VIOLATION: Direct insert to 'holdings_targets'
 *   STATUS: LOW RISK - Strategic planning data
 * 
 * ENFORCEMENT RECOMMENDATIONS:
 * ===========================
 * 
 * 1. IMMEDIATE: Enable PRODUCTION_LOCK in strict mode
 *    - File: src/services/taskGovernance/productionLock.ts
 *    - Call: initializeProductionLock({ mode: 'strict' })
 * 
 * 2. PHASE 1: High-risk tables (Finance, Orders, Inventory)
 *    - All insert/update/delete must use GovernedButton
 *    - Add code comment: // GOVERNANCE REQUIRED — DO NOT BYPASS
 * 
 * 3. PHASE 2: Medium-risk tables (CRM, Communication)
 *    - Wrap mutations in useGovernedAction
 *    - Log activity for audit trail
 * 
 * 4. PHASE 3: Low-risk tables (Config, UI preferences)
 *    - Consider governance for audit completeness
 *    - May remain direct if no business impact
 * 
 * VERIFICATION COMMANDS:
 * =====================
 * 
 * Search for remaining violations:
 * ```bash
 * grep -r "supabase.from.*\.(insert|update|delete)" src/ --include="*.ts" --include="*.tsx" | grep -v "taskGovernance" | grep -v "audit" | grep -v "log"
 * ```
 * 
 * Count governed actions:
 * ```bash
 * grep -r "useGovernedAction\|createGovernedTask\|GovernedButton" src/ --include="*.ts" --include="*.tsx" | wc -l
 * ```
 * 
 * ACCEPTANCE CRITERIA:
 * ===================
 * ❌ No button mutates data directly (except allowed tables)
 * ❌ No background logic bypasses tasks (except audit/logging)
 * ❌ No action lacks visibility
 * ❌ No task lacks a report
 * ❌ No high-risk task runs without governance
 * 
 * STATUS: IN PROGRESS
 * Next: Refactor high-priority bypass paths in Phase 1
 */

export const BYPASS_AUDIT_VERSION = '2026-02-02';

export const ALLOWED_DIRECT_WRITE_TABLES = [
  'portal_audit_log',
  'portal_security_events',
  'portal_devices',
  'admin_impersonation_log',
  'admin_audit_log',
  'ai_task_activity_log',
  'governed_tasks',
  'ai_work_tasks',
  'profiles',
  'portal_action_queue',
];

export const HIGH_RISK_TABLES = [
  'invoices',
  'orders',
  'marketplace_orders',
  'payments',
  'commissions',
  'payouts',
  'inventory',
  'purchase_orders',
  'purchase_order_items',
  'production_work_orders',
  'accounting_ledger',
];

export const MEDIUM_RISK_TABLES = [
  'people',
  'contacts',
  'crm_businesses',
  'store_master',
  'deals',
  'follow_ups',
  'ai_text_sequences',
  'ai_call_campaigns',
];

export interface BypassViolation {
  file: string;
  line: number;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'fixed' | 'allowed';
  recommendation: string;
}

// Known violations to track
export const KNOWN_VIOLATIONS: BypassViolation[] = [
  {
    file: 'src/components/crm/CustomerNotesSimpleEditor.tsx',
    line: 30,
    table: 'people',
    operation: 'update',
    severity: 'medium',
    status: 'pending',
    recommendation: 'Wrap in GovernedButton with action crm_update_contact',
  },
  {
    file: 'src/components/communication/AutoCampaigns.tsx',
    line: 61,
    table: 'ai_text_sequences',
    operation: 'insert',
    severity: 'medium',
    status: 'pending',
    recommendation: 'Wrap in governance with action comm_create_campaign',
  },
  {
    file: 'src/lib/inventory/calculateReorderSuggestions.ts',
    line: 198,
    table: 'purchase_order_items',
    operation: 'insert',
    severity: 'high',
    status: 'pending',
    recommendation: 'Wrap in governance with action inv_create_po',
  },
  {
    file: 'src/components/communication/deals/CreateDealDialog.tsx',
    line: 65,
    table: 'deals',
    operation: 'insert',
    severity: 'high',
    status: 'pending',
    recommendation: 'Wrap in GovernedButton with action fin_create_deal',
  },
];
