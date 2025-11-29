import { useUserRole } from "@/hooks/useUserRole";

type Permission = 'create' | 'read' | 'update' | 'delete' | 'export';
type Module = 'crm' | 'inventory' | 'deliveries' | 'finance' | 'production' | 'wholesale' | 'ambassadors' | 'communication' | 'ai' | 'penthouse';

const ROLE_PERMISSIONS: Record<string, Record<Module, Permission[]>> = {
  admin: {
    crm: ['create', 'read', 'update', 'delete', 'export'],
    inventory: ['create', 'read', 'update', 'delete', 'export'],
    deliveries: ['create', 'read', 'update', 'delete', 'export'],
    finance: ['create', 'read', 'update', 'delete', 'export'],
    production: ['create', 'read', 'update', 'delete', 'export'],
    wholesale: ['create', 'read', 'update', 'delete', 'export'],
    ambassadors: ['create', 'read', 'update', 'delete', 'export'],
    communication: ['create', 'read', 'update', 'delete', 'export'],
    ai: ['create', 'read', 'update', 'delete', 'export'],
    penthouse: ['create', 'read', 'update', 'delete', 'export'],
  },
  manager: {
    crm: ['create', 'read', 'update', 'export'],
    inventory: ['create', 'read', 'update', 'export'],
    deliveries: ['create', 'read', 'update', 'export'],
    finance: ['read', 'export'],
    production: ['create', 'read', 'update', 'export'],
    wholesale: ['create', 'read', 'update', 'export'],
    ambassadors: ['read', 'export'],
    communication: ['create', 'read', 'update', 'export'],
    ai: ['read'],
    penthouse: ['read'],
  },
  va: {
    crm: ['create', 'read', 'update'],
    inventory: ['read'],
    deliveries: ['read'],
    finance: ['read'],
    production: ['read'],
    wholesale: ['read'],
    ambassadors: ['read'],
    communication: ['create', 'read', 'update'],
    ai: ['read'],
    penthouse: [],
  },
  driver: {
    crm: ['read'],
    inventory: ['read'],
    deliveries: ['read', 'update'],
    finance: [],
    production: [],
    wholesale: [],
    ambassadors: [],
    communication: ['read'],
    ai: [],
    penthouse: [],
  },
};

export function usePermissions() {
  const { role, loading: isLoading } = useUserRole();

  const hasPermission = (module: Module, permission: Permission): boolean => {
    if (isLoading) return false;
    const userRole = role || 'va';
    const rolePerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.va;
    return rolePerms[module]?.includes(permission) || false;
  };

  const canCreate = (module: Module) => hasPermission(module, 'create');
  const canRead = (module: Module) => hasPermission(module, 'read');
  const canUpdate = (module: Module) => hasPermission(module, 'update');
  const canDelete = (module: Module) => hasPermission(module, 'delete');
  const canExport = (module: Module) => hasPermission(module, 'export');

  const getAllowedModules = (): Module[] => {
    const userRole = role || 'va';
    const rolePerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.va;
    return Object.entries(rolePerms)
      .filter(([_, perms]) => perms.includes('read'))
      .map(([module]) => module as Module);
  };

  return {
    hasPermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canExport,
    getAllowedModules,
    role,
    isLoading,
  };
}
