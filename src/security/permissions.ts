// src/security/permissions.ts

export type Permission =
  | 'crm.read'
  | 'crm.write'
  | 'finance.view'
  | 'finance.admin'
  | 'playboxxx.view'
  | 'playboxxx.admin'
  | 'sports-betting.view'
  | 'sports-betting.admin'
  | 'os.wealth-engine'
  | 'system.modules'
  | 'system.lockdown'
  | 'driver.portal'
  | 'biker.portal'
  | 'store.portal'
  | 'wholesale.portal'
  | 'ambassador.portal'
  | 'influencer.portal'
  | 'customer.portal'
  | '*'; // wildcard for full access

export const ROLE_PERMISSION_MATRIX: Record<string, Permission[]> = {
  admin: ['*'],
  employee: ['crm.read', 'crm.write', 'finance.view', 'playboxxx.view', 'system.modules'],
  staff: ['crm.read', 'crm.write', 'finance.view', 'playboxxx.view'],
  driver: ['driver.portal'],
  biker: ['biker.portal'],
  store: ['store.portal', 'crm.read'],
  wholesale: ['wholesale.portal', 'crm.read'],
  wholesaler: ['wholesale.portal', 'crm.read'],
  warehouse: ['crm.read'],
  influencer: ['influencer.portal', 'playboxxx.view'],
  ambassador: ['ambassador.portal', 'crm.read'],
  customer: ['customer.portal'],
  csr: ['crm.read', 'crm.write'],
  accountant: ['finance.view', 'finance.admin'],
  creator: ['playboxxx.view'],
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
