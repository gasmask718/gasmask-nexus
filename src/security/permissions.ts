// src/security/permissions.ts
// Dynasty OS Permission Matrix (from RLS Constitution)

export type Permission =
  | 'crm.read'
  | 'crm.write'
  | 'finance.view'
  | 'finance.admin'
  | 'finance.owner' // Owner-only financial access
  | 'playboxxx.view'
  | 'playboxxx.admin'
  | 'sports-betting.view'
  | 'sports-betting.admin'
  | 'os.wealth-engine'
  | 'os.ai-core' // Owner-only AI core access
  | 'system.modules'
  | 'system.lockdown'
  | 'system.audit' // Access to audit logs
  | 'driver.portal'
  | 'biker.portal'
  | 'store.portal'
  | 'wholesale.portal'
  | 'ambassador.portal'
  | 'influencer.portal'
  | 'customer.portal'
  | 'developer.ui' // Developer UI-only access
  | '*'; // wildcard for full access

/**
 * Role Permission Matrix
 * Defines what each role can do in the system
 * 
 * HIERARCHY:
 * - owner: Full access ('*'), bypasses all limits
 * - admin: Operational access, limited finance
 * - employee/staff: Scoped by assignment
 * - Portal roles: Own data only
 * - developer: UI only, NO data
 */
export const ROLE_PERMISSION_MATRIX: Record<string, Permission[]> = {
  // Owner - Full access
  owner: ['*'],
  
  // Admin - Operational but not owner-level
  admin: [
    'crm.read', 'crm.write', 
    'finance.view', 'finance.admin',
    'playboxxx.view', 'playboxxx.admin',
    'sports-betting.view', 'sports-betting.admin',
    'os.wealth-engine',
    'system.modules', 'system.lockdown', 'system.audit'
  ],
  
  // Employee - Day-to-day operations
  employee: ['crm.read', 'crm.write', 'finance.view', 'playboxxx.view', 'system.modules'],
  
  // Staff - Limited operations
  staff: ['crm.read', 'crm.write', 'finance.view', 'playboxxx.view'],
  
  // Developer - UI ONLY, no data access
  developer: ['developer.ui'],
  
  // Portal roles - strict isolation
  driver: ['driver.portal'],
  biker: ['biker.portal'],
  store: ['store.portal', 'crm.read'],
  wholesale: ['wholesale.portal', 'crm.read'],
  wholesaler: ['wholesale.portal', 'crm.read'],
  warehouse: ['crm.read'],
  influencer: ['influencer.portal', 'playboxxx.view'],
  ambassador: ['ambassador.portal', 'crm.read'],
  customer: ['customer.portal'],
  
  // Specialized roles
  csr: ['crm.read', 'crm.write'],
  accountant: ['finance.view', 'finance.admin'],
  creator: ['playboxxx.view'],
  pod_worker: ['crm.read'],
  realestate_worker: ['crm.read'],
};

/**
 * Check if user has required permission(s)
 * Supports wildcard '*' for full access
 */
export function hasPermission(
  userPermissions: Permission[],
  required: Permission | Permission[]
): boolean {
  const req = Array.isArray(required) ? required : [required];
  
  // Wildcard grants all permissions
  if (userPermissions.includes('*')) return true;
  
  return req.every(r => userPermissions.includes(r));
}

/**
 * Check if user has ANY of the required permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  required: Permission[]
): boolean {
  if (userPermissions.includes('*')) return true;
  return required.some(r => userPermissions.includes(r));
}

/**
 * Get permissions for a role from the matrix
 */
export function getPermissionsForRole(roleName: string): Permission[] {
  return ROLE_PERMISSION_MATRIX[roleName] || [];
}

/**
 * Merge permissions from multiple roles
 */
export function mergePermissions(roles: string[]): Permission[] {
  const allPermissions = new Set<Permission>();
  
  for (const role of roles) {
    const perms = ROLE_PERMISSION_MATRIX[role] || [];
    perms.forEach(p => allPermissions.add(p));
  }
  
  return Array.from(allPermissions);
}

/**
 * Check if role is owner (has wildcard)
 */
export function isOwnerPermission(roleName: string): boolean {
  const perms = ROLE_PERMISSION_MATRIX[roleName] || [];
  return perms.includes('*');
}

/**
 * Check if role is developer (UI only)
 */
export function isDeveloperPermission(roleName: string): boolean {
  const perms = ROLE_PERMISSION_MATRIX[roleName] || [];
  return perms.includes('developer.ui') && perms.length === 1;
}
