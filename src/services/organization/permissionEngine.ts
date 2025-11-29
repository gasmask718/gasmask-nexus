import { supabase } from '@/integrations/supabase/client';

export type OrgRole = 'owner' | 'manager' | 'inventory_staff' | 'cashier' | 'shipping_staff' | 'support_staff' | 'back_office';

export type Permission = 
  | 'manage_products'
  | 'view_products'
  | 'manage_inventory'
  | 'view_orders'
  | 'manage_orders'
  | 'ship_orders'
  | 'refund_orders'
  | 'view_financials'
  | 'manage_payments'
  | 'edit_prices'
  | 'manage_staff'
  | 'view_staff'
  | 'manage_profile'
  | 'view_reports'
  | 'send_messages'
  | 'view_activity';

// Default permissions by role
export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  owner: [
    'manage_products', 'view_products', 'manage_inventory', 'view_orders',
    'manage_orders', 'ship_orders', 'refund_orders', 'view_financials',
    'manage_payments', 'edit_prices', 'manage_staff', 'view_staff',
    'manage_profile', 'view_reports', 'send_messages', 'view_activity'
  ],
  manager: [
    'view_products', 'manage_inventory', 'view_orders', 'manage_orders',
    'view_financials', 'manage_payments', 'manage_staff', 'view_staff',
    'view_reports', 'send_messages', 'view_activity'
  ],
  inventory_staff: [
    'view_products', 'manage_inventory', 'view_orders', 'send_messages'
  ],
  cashier: [
    'view_orders', 'manage_payments', 'send_messages'
  ],
  shipping_staff: [
    'view_orders', 'ship_orders', 'send_messages'
  ],
  support_staff: [
    'view_orders', 'send_messages', 'view_products'
  ],
  back_office: [
    'manage_products', 'view_products', 'manage_inventory', 'view_orders',
    'edit_prices', 'view_financials', 'send_messages', 'view_reports'
  ]
};

// Store-specific roles
export const STORE_ROLES: OrgRole[] = ['owner', 'manager', 'inventory_staff', 'cashier', 'support_staff'];

// Wholesaler-specific roles
export const WHOLESALER_ROLES: OrgRole[] = ['owner', 'manager', 'back_office', 'shipping_staff', 'support_staff'];

export function getRoleDefaults(role: OrgRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(
  userPermissions: Permission[] | undefined,
  permission: Permission
): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(permission);
}

export function getRolesForOrgType(orgType: 'store' | 'wholesaler'): OrgRole[] {
  return orgType === 'store' ? STORE_ROLES : WHOLESALER_ROLES;
}

export function getRoleDisplayName(role: OrgRole): string {
  const names: Record<OrgRole, string> = {
    owner: 'Owner',
    manager: 'Manager',
    inventory_staff: 'Inventory Staff',
    cashier: 'Cashier',
    shipping_staff: 'Shipping Staff',
    support_staff: 'Support Staff',
    back_office: 'Back Office'
  };
  return names[role] || role;
}

export function getPermissionDisplayName(permission: Permission): string {
  const names: Record<Permission, string> = {
    manage_products: 'Manage Products',
    view_products: 'View Products',
    manage_inventory: 'Manage Inventory',
    view_orders: 'View Orders',
    manage_orders: 'Manage Orders',
    ship_orders: 'Ship Orders',
    refund_orders: 'Refund Orders',
    view_financials: 'View Financials',
    manage_payments: 'Manage Payments',
    edit_prices: 'Edit Prices',
    manage_staff: 'Manage Staff',
    view_staff: 'View Staff',
    manage_profile: 'Manage Profile',
    view_reports: 'View Reports',
    send_messages: 'Send Messages',
    view_activity: 'View Activity'
  };
  return names[permission] || permission;
}

// Generate invite code
export function generateInviteCode(): string {
  return Array.from({ length: 8 }, () => 
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
  ).join('');
}
