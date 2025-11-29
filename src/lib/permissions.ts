// Role-based permission definitions
export type Role = 'admin' | 'va' | 'driver' | 'biker' | 'ambassador' | 'wholesaler' | 'store_owner' | 'production' | 'customer';

export type Permission = 
  // Driver permissions
  | 'view_routes'
  | 'view_assigned_stores'
  | 'update_store_status'
  | 'view_driver_tasks'
  | 'view_driver_earnings'
  // Biker permissions
  | 'view_pickups'
  | 'confirm_deliveries'
  | 'upload_photos'
  | 'view_biker_tasks'
  // Ambassador permissions
  | 'view_store_list'
  | 'submit_new_store'
  | 'view_commissions'
  | 'chat_support'
  | 'view_ambassador_bonuses'
  // Store permissions
  | 'place_orders'
  | 'view_order_history'
  | 'view_delivery_eta'
  | 'reorder_products'
  // Wholesaler permissions
  | 'upload_products'
  | 'manage_inventory'
  | 'view_orders_from_stores'
  | 'view_direct_customer_orders'
  | 'view_wholesaler_earnings'
  // Production permissions
  | 'update_inventory_counts'
  | 'log_defects'
  | 'record_box_output'
  | 'view_production_stats'
  // VA permissions
  | 'crm_access'
  | 'edit_store'
  | 'edit_contact'
  | 'upload_docs'
  | 'assign_tasks'
  | 'view_all_stores'
  | 'view_all_orders'
  // Customer permissions
  | 'shop_products'
  | 'manage_cart'
  | 'view_customer_orders'
  | 'manage_addresses'
  | 'view_rewards'
  // Admin permissions
  | 'admin_full_access';

export const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'admin_full_access',
    'view_routes',
    'view_assigned_stores',
    'update_store_status',
    'view_driver_tasks',
    'view_driver_earnings',
    'view_pickups',
    'confirm_deliveries',
    'upload_photos',
    'view_biker_tasks',
    'view_store_list',
    'submit_new_store',
    'view_commissions',
    'chat_support',
    'view_ambassador_bonuses',
    'place_orders',
    'view_order_history',
    'view_delivery_eta',
    'reorder_products',
    'upload_products',
    'manage_inventory',
    'view_orders_from_stores',
    'view_direct_customer_orders',
    'view_wholesaler_earnings',
    'update_inventory_counts',
    'log_defects',
    'record_box_output',
    'view_production_stats',
    'crm_access',
    'edit_store',
    'edit_contact',
    'upload_docs',
    'assign_tasks',
    'view_all_stores',
    'view_all_orders',
  ],
  va: [
    'crm_access',
    'edit_store',
    'edit_contact',
    'upload_docs',
    'assign_tasks',
    'view_all_stores',
    'view_all_orders',
    'view_routes',
    'view_assigned_stores',
    'view_store_list',
  ],
  driver: [
    'view_routes',
    'view_assigned_stores',
    'update_store_status',
    'view_driver_tasks',
    'view_driver_earnings',
  ],
  biker: [
    'view_pickups',
    'confirm_deliveries',
    'upload_photos',
    'view_biker_tasks',
  ],
  ambassador: [
    'view_store_list',
    'submit_new_store',
    'view_commissions',
    'chat_support',
    'view_ambassador_bonuses',
  ],
  store_owner: [
    'place_orders',
    'view_order_history',
    'view_delivery_eta',
    'reorder_products',
  ],
  wholesaler: [
    'upload_products',
    'manage_inventory',
    'view_orders_from_stores',
    'view_direct_customer_orders',
    'view_wholesaler_earnings',
  ],
  production: [
    'update_inventory_counts',
    'log_defects',
    'record_box_output',
    'view_production_stats',
  ],
  customer: [
    'shop_products',
    'manage_cart',
    'view_customer_orders',
    'manage_addresses',
    'view_rewards',
  ],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role): Permission[] {
  return PERMISSIONS[role] || [];
}
