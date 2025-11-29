import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useFloorPermissions } from '@/hooks/useFloorPermissions';
import { useReadOnly } from '@/components/security/RequireRole';

/**
 * Grabba-specific permission hook that combines floor permissions
 * with module-level permissions for granular access control
 */
export function useGrabbaPermissions() {
  const {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canExport,
    role,
    isLoading
  } = usePermissions();

  const {
    getFloorAccess,
    getAllowedFloors,
    canAccessPenthouse,
    canAccessAI,
    isAdmin
  } = useFloorPermissions();

  const isReadOnly = useReadOnly();

  // CRM Permissions (Floor 1)
  const crmPermissions = useMemo(() => ({
    canCreate: canCreate('crm') && !isReadOnly,
    canUpdate: canUpdate('crm') && !isReadOnly,
    canDelete: canDelete('crm') && !isReadOnly,
    canExport: canExport('crm'),
    canRead: canRead('crm'),
  }), [canCreate, canUpdate, canDelete, canExport, canRead, isReadOnly]);

  // Communication Permissions (Floor 2)
  const communicationPermissions = useMemo(() => ({
    canCreate: canCreate('communication') && !isReadOnly,
    canUpdate: canUpdate('communication') && !isReadOnly,
    canDelete: canDelete('communication') && !isReadOnly,
    canExport: canExport('communication'),
    canRead: canRead('communication'),
    canSendMessages: ['admin', 'employee', 'csr'].includes(role || '') && !isReadOnly,
    canViewLogs: ['admin', 'employee', 'csr', 'driver'].includes(role || ''),
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Inventory Permissions (Floor 3)
  const inventoryPermissions = useMemo(() => ({
    canCreate: canCreate('inventory') && !isReadOnly,
    canUpdate: canUpdate('inventory') && !isReadOnly,
    canDelete: canDelete('inventory') && !isReadOnly,
    canExport: canExport('inventory'),
    canRead: canRead('inventory'),
    canTransfer: ['admin', 'employee', 'warehouse'].includes(role || '') && !isReadOnly,
    canAdjust: ['admin', 'employee', 'warehouse'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Delivery Permissions (Floor 4)
  const deliveryPermissions = useMemo(() => ({
    canCreate: canCreate('deliveries') && !isReadOnly,
    canUpdate: canUpdate('deliveries') && !isReadOnly,
    canDelete: canDelete('deliveries') && !isReadOnly,
    canExport: canExport('deliveries'),
    canRead: canRead('deliveries'),
    canAssignDrivers: ['admin', 'employee'].includes(role || '') && !isReadOnly,
    canCompleteDelivery: ['admin', 'employee', 'driver', 'biker'].includes(role || '') && !isReadOnly,
    canRecordPayment: ['admin', 'employee', 'driver'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Finance Permissions (Floor 5)
  const financePermissions = useMemo(() => ({
    canCreate: canCreate('finance') && !isReadOnly,
    canUpdate: canUpdate('finance') && !isReadOnly,
    canDelete: canDelete('finance') && !isReadOnly,
    canExport: canExport('finance'),
    canRead: canRead('finance'),
    canViewFinancials: ['admin', 'employee', 'accountant'].includes(role || ''),
    canEditInvoices: ['admin', 'employee', 'accountant'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Production Permissions (Floor 6)
  const productionPermissions = useMemo(() => ({
    canCreate: canCreate('production') && !isReadOnly,
    canUpdate: canUpdate('production') && !isReadOnly,
    canDelete: canDelete('production') && !isReadOnly,
    canExport: canExport('production'),
    canRead: canRead('production'),
    canCreateBatch: ['admin', 'employee', 'warehouse'].includes(role || '') && !isReadOnly,
    canLogMaintenance: ['admin', 'employee', 'warehouse'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Wholesale Permissions (Floor 7)
  const wholesalePermissions = useMemo(() => ({
    canCreate: canCreate('wholesale') && !isReadOnly,
    canUpdate: canUpdate('wholesale') && !isReadOnly,
    canDelete: canDelete('wholesale') && !isReadOnly,
    canExport: canExport('wholesale'),
    canRead: canRead('wholesale'),
    canUploadItems: ['admin', 'employee', 'wholesale', 'wholesaler'].includes(role || '') && !isReadOnly,
    canPushToMarketplace: ['admin', 'employee'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Ambassador Permissions (Floor 8)
  const ambassadorPermissions = useMemo(() => ({
    canCreate: canCreate('ambassadors') && !isReadOnly,
    canUpdate: canUpdate('ambassadors') && !isReadOnly,
    canDelete: canDelete('ambassadors') && !isReadOnly,
    canExport: canExport('ambassadors'),
    canRead: canRead('ambassadors'),
    canAssignRegions: ['admin', 'employee'].includes(role || '') && !isReadOnly,
    canAdjustPayouts: ['admin', 'accountant'].includes(role || '') && !isReadOnly,
    canAssignStores: ['admin', 'employee'].includes(role || '') && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // AI Permissions (Floor 9)
  const aiPermissions = useMemo(() => ({
    canCreate: canCreate('ai') && !isReadOnly,
    canUpdate: canUpdate('ai') && !isReadOnly,
    canDelete: canDelete('ai') && !isReadOnly,
    canExport: canExport('ai'),
    canRead: canRead('ai'),
    canRunEngine: role === 'admin' && !isReadOnly,
    canQueueTasks: role === 'admin' && !isReadOnly,
    canConfigureAutopilot: role === 'admin' && !isReadOnly,
  }), [canCreate, canUpdate, canDelete, canExport, canRead, role, isReadOnly]);

  // Penthouse Permissions
  const penthousePermissions = useMemo(() => ({
    canAccess: canAccessPenthouse,
    canEdit: role === 'admin' && !isReadOnly,
    canViewCluster: ['admin', 'employee'].includes(role || ''),
    canEditBrandSettings: role === 'admin' && !isReadOnly,
    canExportData: ['admin', 'employee', 'accountant'].includes(role || ''),
  }), [canAccessPenthouse, role, isReadOnly]);

  return {
    role,
    isLoading,
    isReadOnly,
    isAdmin,
    
    // Floor access
    getFloorAccess,
    getAllowedFloors,
    canAccessPenthouse,
    canAccessAI,
    
    // Module permissions
    crmPermissions,
    communicationPermissions,
    inventoryPermissions,
    deliveryPermissions,
    financePermissions,
    productionPermissions,
    wholesalePermissions,
    ambassadorPermissions,
    aiPermissions,
    penthousePermissions,
  };
}

export default useGrabbaPermissions;
