import { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

/**
 * Routes user to appropriate portal based on their role
 * Returns the path for the user's primary dashboard
 */
export function routeUserByRole(role: AppRole): string {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'employee':
      return '/';
    case 'developer':
      return '/developer'; // UI-only access
    case 'driver':
      return '/driver/home';
    case 'biker':
      return '/biker/home';
    case 'store':
      return '/portal/store';
    case 'wholesale':
    case 'wholesaler':
      return '/portal/wholesale';
    case 'influencer':
      return '/portal/influencer';
    case 'ambassador':
      return '/portal/ambassador';
    case 'customer':
      return '/portal/customer';
    case 'staff':
      return '/';
    case 'creator':
      return '/portal/creator';
    default:
      return '/portal/dashboard';
  }
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: AppRole): string {
  const names: Partial<Record<AppRole, string>> = {
    owner: 'Dynasty Owner',
    admin: 'Administrator',
    employee: 'Employee',
    staff: 'Staff',
    developer: 'Developer',
    driver: 'Driver',
    biker: 'Biker',
    store: 'Store',
    wholesale: 'Wholesale Partner',
    wholesaler: 'Wholesaler',
    warehouse: 'Warehouse',
    influencer: 'Influencer',
    ambassador: 'Ambassador',
    customer: 'Customer',
    csr: 'Customer Service',
    accountant: 'Accountant',
    creator: 'Creator',
    pod_worker: 'POD Worker',
    realestate_worker: 'Real Estate Worker',
  };
  return names[role] || role;
}

/**
 * Check if a role is the owner (highest privilege)
 */
export function isOwnerRole(role: AppRole): boolean {
  return role === 'owner';
}

/**
 * Check if a role has access to admin features
 */
export function isAdminRole(role: AppRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'employee';
}

/**
 * Check if a role is developer (UI only, no data)
 */
export function isDeveloperRole(role: AppRole): boolean {
  return role === 'developer';
}

/**
 * Check if a role has access to field operations
 */
export function isFieldRole(role: AppRole): boolean {
  return role === 'driver' || role === 'biker';
}

/**
 * Check if a role is a portal user (external, strict isolation)
 */
export function isPortalRole(role: AppRole): boolean {
  return ['store', 'wholesale', 'wholesaler', 'influencer', 'ambassador', 'customer', 'driver', 'biker'].includes(role);
}

/**
 * Get theme color for role
 */
export function getRoleThemeColor(role: AppRole): string {
  const colors: Partial<Record<AppRole, string>> = {
    owner: 'hsl(45, 100%, 50%)', // Gold
    admin: 'hsl(var(--primary))',
    employee: 'hsl(var(--primary))',
    staff: 'hsl(var(--primary))',
    developer: 'hsl(0, 0%, 50%)', // Gray (limited access)
    driver: 'hsl(210, 100%, 50%)',
    biker: 'hsl(180, 100%, 40%)',
    store: 'hsl(270, 100%, 50%)',
    wholesale: 'hsl(30, 100%, 50%)',
    wholesaler: 'hsl(35, 100%, 45%)',
    warehouse: 'hsl(25, 100%, 45%)',
    influencer: 'hsl(340, 100%, 50%)',
    ambassador: 'hsl(150, 100%, 40%)',
    customer: 'hsl(240, 100%, 50%)',
    csr: 'hsl(200, 100%, 50%)',
    accountant: 'hsl(120, 100%, 40%)',
    creator: 'hsl(320, 100%, 50%)',
    pod_worker: 'hsl(190, 100%, 45%)',
    realestate_worker: 'hsl(15, 100%, 45%)',
  };
  return colors[role] || 'hsl(var(--primary))';
}
