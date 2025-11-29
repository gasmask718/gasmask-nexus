// Role-based field editing permissions

import { DrillDownEntity } from './drilldown';

export type UserRole = 'admin' | 'manager' | 'va' | 'driver' | 'ambassador' | 'csr' | 'warehouse';

interface FieldPermission {
  editable: boolean;
  roles: UserRole[];
}

type EntityFieldPermissions = Record<string, FieldPermission>;

const storePermissions: EntityFieldPermissions = {
  name: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  address: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  phone: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  email: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  status: { editable: true, roles: ['admin', 'manager'] },
  notes: { editable: true, roles: ['admin', 'manager', 'va', 'csr', 'driver'] },
  region: { editable: true, roles: ['admin', 'manager'] },
  owner_name: { editable: true, roles: ['admin', 'manager', 'va'] },
  credit_limit: { editable: true, roles: ['admin'] },
  payment_terms: { editable: true, roles: ['admin', 'manager'] },
};

const invoicePermissions: EntityFieldPermissions = {
  status: { editable: true, roles: ['admin', 'manager'] },
  payment_status: { editable: true, roles: ['admin', 'manager'] },
  notes: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  due_date: { editable: true, roles: ['admin', 'manager'] },
  amount: { editable: true, roles: ['admin'] },
  discount: { editable: true, roles: ['admin', 'manager'] },
};

const deliveryPermissions: EntityFieldPermissions = {
  status: { editable: true, roles: ['admin', 'manager', 'driver', 'csr'] },
  notes: { editable: true, roles: ['admin', 'manager', 'va', 'csr', 'driver'] },
  delivery_notes: { editable: true, roles: ['admin', 'manager', 'driver'] },
  scheduled_time: { editable: true, roles: ['admin', 'manager', 'csr'] },
  driver_id: { editable: true, roles: ['admin', 'manager'] },
  completed_at: { editable: true, roles: ['admin', 'manager', 'driver'] },
};

const inventoryPermissions: EntityFieldPermissions = {
  quantity: { editable: true, roles: ['admin', 'manager', 'warehouse', 'va'] },
  notes: { editable: true, roles: ['admin', 'manager', 'warehouse', 'va'] },
  reorder_point: { editable: true, roles: ['admin', 'manager', 'warehouse'] },
  unit_price: { editable: true, roles: ['admin'] },
  location: { editable: true, roles: ['admin', 'manager', 'warehouse'] },
};

const driverPermissions: EntityFieldPermissions = {
  name: { editable: true, roles: ['admin', 'manager'] },
  phone: { editable: true, roles: ['admin', 'manager', 'driver'] },
  status: { editable: true, roles: ['admin', 'manager'] },
  notes: { editable: true, roles: ['admin', 'manager', 'csr'] },
  vehicle_info: { editable: true, roles: ['admin', 'manager', 'driver'] },
};

const ambassadorPermissions: EntityFieldPermissions = {
  notes: { editable: true, roles: ['admin', 'manager', 'ambassador'] },
  tracking_code: { editable: true, roles: ['admin', 'manager'] },
  tier: { editable: true, roles: ['admin', 'manager'] },
  is_active: { editable: true, roles: ['admin', 'manager'] },
  commission_rate: { editable: true, roles: ['admin'] },
};

const orderPermissions: EntityFieldPermissions = {
  status: { editable: true, roles: ['admin', 'manager', 'csr'] },
  notes: { editable: true, roles: ['admin', 'manager', 'va', 'csr'] },
  shipping_address: { editable: true, roles: ['admin', 'manager', 'csr'] },
  priority: { editable: true, roles: ['admin', 'manager'] },
};

const routePermissions: EntityFieldPermissions = {
  name: { editable: true, roles: ['admin', 'manager', 'csr'] },
  status: { editable: true, roles: ['admin', 'manager', 'driver'] },
  notes: { editable: true, roles: ['admin', 'manager', 'csr', 'driver'] },
  scheduled_date: { editable: true, roles: ['admin', 'manager', 'csr'] },
  driver_id: { editable: true, roles: ['admin', 'manager'] },
};

const commissionPermissions: EntityFieldPermissions = {
  status: { editable: true, roles: ['admin', 'manager'] },
  notes: { editable: true, roles: ['admin', 'manager', 'ambassador'] },
  amount: { editable: true, roles: ['admin'] },
  paid_at: { editable: true, roles: ['admin', 'manager'] },
};

const entityPermissions: Record<DrillDownEntity, EntityFieldPermissions> = {
  stores: storePermissions,
  invoices: invoicePermissions,
  deliveries: deliveryPermissions,
  inventory: inventoryPermissions,
  drivers: driverPermissions,
  ambassadors: ambassadorPermissions,
  orders: orderPermissions,
  routes: routePermissions,
  commissions: commissionPermissions,
};

export function canEditField(
  entity: DrillDownEntity,
  field: string,
  userRole: UserRole
): boolean {
  const permissions = entityPermissions[entity];
  if (!permissions) return false;
  
  const fieldPerm = permissions[field];
  if (!fieldPerm) return false;
  
  return fieldPerm.editable && fieldPerm.roles.includes(userRole);
}

export function getEditableFields(
  entity: DrillDownEntity,
  userRole: UserRole
): string[] {
  const permissions = entityPermissions[entity];
  if (!permissions) return [];
  
  return Object.entries(permissions)
    .filter(([_, perm]) => perm.editable && perm.roles.includes(userRole))
    .map(([field]) => field);
}

export function isAdminOrManager(role: UserRole): boolean {
  return ['admin', 'manager'].includes(role);
}
