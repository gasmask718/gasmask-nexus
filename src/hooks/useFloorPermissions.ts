import { useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';
import { GRABBA_FLOORS, GRABBA_PENTHOUSE, GrabbaFloor } from '@/config/grabbaSkyscraper';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR PERMISSION MATRIX
// Defines which roles can access which floors and with what permissions
// ═══════════════════════════════════════════════════════════════════════════════

export type FloorPermission = 'full' | 'read' | 'none';

interface FloorAccess {
  canAccess: boolean;
  permission: FloorPermission;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

// Floor access configuration by role
const FLOOR_ACCESS_MATRIX: Record<string, Partial<Record<AppRole, FloorPermission>>> = {
  'penthouse': {
    admin: 'full',
    employee: 'read',
    driver: 'none',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'none',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'none',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-1-crm': {
    admin: 'full',
    employee: 'full',
    driver: 'read',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'none',
    influencer: 'none',
    ambassador: 'read',
    customer: 'none',
    csr: 'full',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-2-communication': {
    admin: 'full',
    employee: 'full',
    driver: 'read',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'none',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'full',
    accountant: 'none',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-3-inventory': {
    admin: 'full',
    employee: 'full',
    driver: 'read',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'full',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'read',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-4-delivery': {
    admin: 'full',
    employee: 'full',
    driver: 'full',
    biker: 'full',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'read',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'read',
    accountant: 'none',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-5-orders': {
    admin: 'full',
    employee: 'full',
    driver: 'none',
    biker: 'none',
    store: 'read',
    wholesale: 'read',
    wholesaler: 'read',
    warehouse: 'read',
    influencer: 'none',
    ambassador: 'none',
    customer: 'read',
    csr: 'read',
    accountant: 'full',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-6-production': {
    admin: 'full',
    employee: 'full',
    driver: 'none',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'full',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'none',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-7-wholesale': {
    admin: 'full',
    employee: 'full',
    driver: 'none',
    biker: 'none',
    store: 'none',
    wholesale: 'full',
    wholesaler: 'full',
    warehouse: 'read',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'read',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-8-ambassadors': {
    admin: 'full',
    employee: 'full',
    driver: 'none',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'none',
    influencer: 'none',
    ambassador: 'read',
    customer: 'none',
    csr: 'read',
    accountant: 'read',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
  'floor-9-ai': {
    admin: 'full',
    employee: 'read',
    driver: 'none',
    biker: 'none',
    store: 'none',
    wholesale: 'none',
    wholesaler: 'none',
    warehouse: 'none',
    influencer: 'none',
    ambassador: 'none',
    customer: 'none',
    csr: 'none',
    accountant: 'none',
    pod_worker: 'none',
    realestate_worker: 'none',
  },
};

/**
 * Hook to get floor-level permissions for the current user
 */
export function useFloorPermissions() {
  const { role, loading, isAdmin } = useUserRole();

  const getFloorAccess = useMemo(() => {
    return (floorId: string): FloorAccess => {
      if (!role) {
        return {
          canAccess: false,
          permission: 'none',
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          canExport: false,
        };
      }

      const floorMatrix = FLOOR_ACCESS_MATRIX[floorId];
      if (!floorMatrix) {
        return {
          canAccess: isAdmin(),
          permission: isAdmin() ? 'full' : 'none',
          canCreate: isAdmin(),
          canUpdate: isAdmin(),
          canDelete: isAdmin(),
          canExport: isAdmin(),
        };
      }

      const permission = floorMatrix[role] || 'none';
      
      return {
        canAccess: permission !== 'none',
        permission,
        canCreate: permission === 'full',
        canUpdate: permission === 'full',
        canDelete: permission === 'full' && isAdmin(),
        canExport: permission !== 'none',
      };
    };
  }, [role, isAdmin]);

  /**
   * Get all floors the current user can access
   */
  const getAllowedFloors = useMemo(() => {
    return (): GrabbaFloor[] => {
      if (!role) return [];

      const allowedFloors: GrabbaFloor[] = [];

      // Check penthouse
      const penthouseAccess = getFloorAccess('penthouse');
      if (penthouseAccess.canAccess) {
        allowedFloors.push(GRABBA_PENTHOUSE);
      }

      // Check each floor
      for (const floor of GRABBA_FLOORS) {
        const access = getFloorAccess(floor.id);
        if (access.canAccess) {
          allowedFloors.push(floor);
        }
      }

      return allowedFloors;
    };
  }, [role, getFloorAccess]);

  /**
   * Get roles allowed for a specific floor
   */
  const getRolesForFloor = (floorId: string): AppRole[] => {
    const floorMatrix = FLOOR_ACCESS_MATRIX[floorId];
    if (!floorMatrix) return ['admin'];
    
    return (Object.entries(floorMatrix) as [AppRole, FloorPermission][])
      .filter(([_, permission]) => permission !== 'none')
      .map(([role]) => role);
  };

  /**
   * Check if current user can access penthouse
   */
  const canAccessPenthouse = useMemo(() => {
    return getFloorAccess('penthouse').canAccess;
  }, [getFloorAccess]);

  /**
   * Check if current user can access AI floor
   */
  const canAccessAI = useMemo(() => {
    return getFloorAccess('floor-9-ai').canAccess;
  }, [getFloorAccess]);

  return {
    loading,
    role,
    getFloorAccess,
    getAllowedFloors,
    getRolesForFloor,
    canAccessPenthouse,
    canAccessAI,
    isAdmin: isAdmin(),
  };
}

/**
 * Get allowed roles for a specific floor (static helper)
 */
export function getFloorAllowedRoles(floorId: string): AppRole[] {
  const floorMatrix = FLOOR_ACCESS_MATRIX[floorId];
  if (!floorMatrix) return ['admin'];
  
  return (Object.entries(floorMatrix) as [AppRole, FloorPermission][])
    .filter(([_, permission]) => permission !== 'none')
    .map(([role]) => role);
}

export default useFloorPermissions;
