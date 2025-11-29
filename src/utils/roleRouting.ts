import { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

/**
 * Routes user to appropriate portal based on their role
 * Returns the path for the user's primary dashboard
 */
export function routeUserByRole(role: AppRole): string {
  switch (role) {
    case 'admin':
    case 'employee':
      return '/';
    case 'driver':
      return '/driver/home';
    case 'biker':
      return '/biker/home';
    case 'store':
      return '/portal/store';
    case 'wholesale':
      return '/portal/wholesale';
    case 'influencer':
      return '/portal/influencer';
    case 'ambassador':
      return '/portal/ambassador';
    case 'customer':
      return '/portal/customer';
    default:
      return '/portal/dashboard';
  }
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: AppRole): string {
  const names: Partial<Record<AppRole, string>> = {
    admin: 'Administrator',
    employee: 'Employee',
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
  };
  return names[role] || role;
}

/**
 * Check if a role has access to admin features
 */
export function isAdminRole(role: AppRole): boolean {
  return role === 'admin' || role === 'employee';
}

/**
 * Check if a role has access to field operations
 */
export function isFieldRole(role: AppRole): boolean {
  return role === 'driver' || role === 'biker';
}

/**
 * Check if a role is a portal user (external)
 */
export function isPortalRole(role: AppRole): boolean {
  return ['store', 'wholesale', 'influencer', 'ambassador', 'customer'].includes(role);
}

/**
 * Get theme color for role
 */
export function getRoleThemeColor(role: AppRole): string {
  const colors: Partial<Record<AppRole, string>> = {
    admin: 'hsl(var(--primary))',
    employee: 'hsl(var(--primary))',
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
  };
  return colors[role] || 'hsl(var(--primary))';
}
