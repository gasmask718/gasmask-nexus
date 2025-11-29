import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { hasPermission, Permission, Role } from '@/lib/permissions';

export function usePortalPermission(permission: Permission): boolean {
  const { data, isLoading } = useCurrentUserProfile();
  
  if (isLoading || !data?.profile) return false;
  
  const role = data.profile.primary_role as Role;
  return hasPermission(role, permission);
}

export function usePortalPermissions() {
  const { data, isLoading } = useCurrentUserProfile();
  
  const role = data?.profile?.primary_role as Role | undefined;
  
  const can = (permission: Permission): boolean => {
    if (isLoading || !role) return false;
    return hasPermission(role, permission);
  };
  
  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some(p => can(p));
  };
  
  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every(p => can(p));
  };
  
  return {
    can,
    canAny,
    canAll,
    role,
    isLoading,
  };
}
