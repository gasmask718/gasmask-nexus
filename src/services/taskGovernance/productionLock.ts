/**
 * Production Lock - Phase G: Global Governance Enforcement
 * 
 * This module implements a PRODUCTION_LOCK that prevents ungoverned data mutations.
 * When enabled, all direct writes are blocked unless routed through governance.
 * 
 * CRITICAL: This is the last line of defense against silent writes.
 */

// ============= PRODUCTION LOCK STATE =============

/**
 * PRODUCTION_LOCK flag - when true, all ungoverned writes are blocked
 * This should be TRUE in production environments
 */
let PRODUCTION_LOCK = true;

/**
 * Violation log for audit purposes
 */
interface GovernanceViolation {
  id: string;
  timestamp: string;
  caller: string;
  operation: string;
  table: string;
  blocked: boolean;
  reason: string;
  stackTrace?: string;
}

const violationLog: GovernanceViolation[] = [];
const MAX_VIOLATIONS = 1000;

// ============= CONFIGURATION =============

export interface ProductionLockConfig {
  enabled: boolean;
  mode: 'strict' | 'warn' | 'audit';
  allowedDirectWrites: string[];
  bypassTokens: Set<string>;
}

const defaultConfig: ProductionLockConfig = {
  enabled: true,
  mode: 'strict', // strict = block, warn = log only, audit = silent log
  allowedDirectWrites: [
    // System-level tables that are allowed direct writes
    'portal_audit_log',
    'portal_security_events',
    'portal_devices',
    'admin_impersonation_log',
    'admin_audit_log',
    'ai_task_activity_log',
    'governed_tasks',
    'ai_work_tasks',
    // Auth-related
    'profiles',
    // Offline queue (already cryptographically signed)
    'portal_action_queue',
  ],
  bypassTokens: new Set(),
};

let config: ProductionLockConfig = { ...defaultConfig };

// ============= LOCK CONTROL =============

/**
 * Enable production lock (should be called on app init in production)
 */
export function enableProductionLock(): void {
  PRODUCTION_LOCK = true;
  config.enabled = true;
  console.info('[GOVERNANCE] 🔒 Production lock ENABLED - All ungoverned writes blocked');
}

/**
 * Disable production lock (DANGEROUS - for development only)
 */
export function disableProductionLock(adminToken?: string): boolean {
  // In production, require admin token
  if (process.env.NODE_ENV === 'production' && !adminToken) {
    console.error('[GOVERNANCE] ❌ Cannot disable production lock without admin token');
    return false;
  }
  
  PRODUCTION_LOCK = false;
  config.enabled = false;
  console.warn('[GOVERNANCE] ⚠️ Production lock DISABLED - Ungoverned writes allowed');
  return true;
}

/**
 * Check if production lock is enabled
 */
export function isProductionLockEnabled(): boolean {
  return PRODUCTION_LOCK && config.enabled;
}

/**
 * Get current lock configuration
 */
export function getProductionLockConfig(): ProductionLockConfig {
  return { ...config };
}

/**
 * Set lock mode
 */
export function setLockMode(mode: 'strict' | 'warn' | 'audit'): void {
  config.mode = mode;
  console.info(`[GOVERNANCE] Lock mode set to: ${mode}`);
}

// ============= GOVERNANCE CHECK =============

/**
 * Check if a write operation is allowed
 * This should be called by the guardWrite function in dryRunService
 */
export function checkWriteAllowed(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  caller: string,
  bypassToken?: string
): { allowed: boolean; reason: string } {
  
  // If lock is disabled, allow all
  if (!PRODUCTION_LOCK || !config.enabled) {
    return { allowed: true, reason: 'Production lock disabled' };
  }

  // Check bypass token
  if (bypassToken && config.bypassTokens.has(bypassToken)) {
    return { allowed: true, reason: 'Valid bypass token' };
  }

  // Check if table is in allowed list
  if (config.allowedDirectWrites.includes(table)) {
    return { allowed: true, reason: `Table ${table} is in allowed list` };
  }

  // Check if caller is a governance service
  const governanceCallers = [
    'taskGovernanceService',
    'dryRunService',
    'useGovernedAction',
    'createGovernedTask',
    'recordItemResult',
  ];
  
  if (governanceCallers.some(gc => caller.includes(gc))) {
    return { allowed: true, reason: 'Called from governance service' };
  }

  // Block the write
  return { 
    allowed: false, 
    reason: `Direct ${operation} on ${table} blocked by production lock. Use governance.` 
  };
}

// ============= VIOLATION LOGGING =============

/**
 * Log a governance violation
 */
export function logViolation(violation: Omit<GovernanceViolation, 'id' | 'timestamp'>): void {
  const entry: GovernanceViolation = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...violation,
  };

  violationLog.unshift(entry);
  
  // Keep log size bounded
  if (violationLog.length > MAX_VIOLATIONS) {
    violationLog.pop();
  }

  // Log to console based on mode
  if (config.mode === 'strict' || config.mode === 'warn') {
    console.error(
      `[GOVERNANCE VIOLATION] ${entry.blocked ? '🚫 BLOCKED' : '⚠️ WARNING'}: ` +
      `${entry.operation} on ${entry.table} by ${entry.caller}. ` +
      `Reason: ${entry.reason}`
    );
  }
}

/**
 * Get recent violations
 */
export function getViolations(limit = 50): GovernanceViolation[] {
  return violationLog.slice(0, limit);
}

/**
 * Clear violation log
 */
export function clearViolations(): void {
  violationLog.length = 0;
}

// ============= BYPASS TOKEN MANAGEMENT =============

/**
 * Generate a temporary bypass token (for emergency use only)
 */
export function generateBypassToken(
  reason: string, 
  expiryMinutes = 5
): string | null {
  if (process.env.NODE_ENV === 'production') {
    console.error('[GOVERNANCE] Bypass tokens cannot be generated in production');
    return null;
  }

  const token = `bypass_${crypto.randomUUID()}`;
  config.bypassTokens.add(token);

  // Auto-expire
  setTimeout(() => {
    config.bypassTokens.delete(token);
    console.info(`[GOVERNANCE] Bypass token expired: ${token.substring(0, 20)}...`);
  }, expiryMinutes * 60 * 1000);

  console.warn(`[GOVERNANCE] ⚠️ Bypass token generated for: ${reason}`);
  return token;
}

// ============= ENFORCEMENT WRAPPER =============

/**
 * Governance guard - wraps any direct mutation with lock check
 * 
 * @example
 * ```ts
 * // Instead of:
 * await supabase.from('orders').insert({ ... });
 * 
 * // Use:
 * await governanceGuard('orders', 'insert', 'OrdersPage', async () => {
 *   await supabase.from('orders').insert({ ... });
 * });
 * ```
 */
export async function governanceGuard<T>(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  caller: string,
  action: () => Promise<T>,
  bypassToken?: string
): Promise<T> {
  const check = checkWriteAllowed(table, operation, caller, bypassToken);

  if (!check.allowed) {
    logViolation({
      caller,
      operation,
      table,
      blocked: true,
      reason: check.reason,
      stackTrace: new Error().stack,
    });

    if (config.mode === 'strict') {
      throw new Error(
        `[GOVERNANCE VIOLATION] ${check.reason}. ` +
        `Use useGovernedAction() or createGovernedTask() instead.`
      );
    }
  }

  // In warn mode, log but proceed
  if (!check.allowed && config.mode === 'warn') {
    logViolation({
      caller,
      operation,
      table,
      blocked: false,
      reason: check.reason,
    });
  }

  return action();
}

// ============= STATUS REPORT =============

export interface GovernanceLockStatus {
  enabled: boolean;
  mode: 'strict' | 'warn' | 'audit';
  violationsTotal: number;
  violationsBlocked: number;
  violationsWarned: number;
  recentViolations: GovernanceViolation[];
  allowedTables: string[];
  activeBypassTokens: number;
}

/**
 * Get current governance lock status
 */
export function getGovernanceLockStatus(): GovernanceLockStatus {
  return {
    enabled: PRODUCTION_LOCK && config.enabled,
    mode: config.mode,
    violationsTotal: violationLog.length,
    violationsBlocked: violationLog.filter(v => v.blocked).length,
    violationsWarned: violationLog.filter(v => !v.blocked).length,
    recentViolations: violationLog.slice(0, 10),
    allowedTables: config.allowedDirectWrites,
    activeBypassTokens: config.bypassTokens.size,
  };
}

// ============= INITIALIZATION =============

/**
 * Initialize production lock with optional configuration
 */
export function initializeProductionLock(options?: Partial<ProductionLockConfig>): void {
  if (options) {
    config = { ...defaultConfig, ...options };
  }
  
  // Enable by default in production
  if (process.env.NODE_ENV === 'production') {
    enableProductionLock();
  }
  
  console.info('[GOVERNANCE] Production lock initialized', {
    enabled: config.enabled,
    mode: config.mode,
    allowedTables: config.allowedDirectWrites.length,
  });
}
