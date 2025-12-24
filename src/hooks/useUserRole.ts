import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/utils/roleRouting';

// Check if we're in development/preview mode
const isDev = import.meta.env.DEV || window.location.hostname.includes('lovable');

export function useUserRole(currentBusinessId?: string | null) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDriverAssigned, setIsDriverAssigned] = useState(false);
  const [isBikerAssigned, setIsBikerAssigned] = useState(false);
  const [driverAssignmentBusinessId, setDriverAssignmentBusinessId] = useState<string | null>(null);
  const [bikerAssignmentBusinessId, setBikerAssignmentBusinessId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (isDev) {
          console.log('🔐 [RBAC DEBUG] Auth user:', user?.id, user?.email);
          console.log('🔐 [RBAC DEBUG] Current business ID:', currentBusinessId ?? 'not set');
        }
        
        if (!user) {
          // In dev mode, default to admin for testing
          if (isDev) {
            console.log('🔧 DEV MODE: No user, defaulting to admin role for preview');
            setRole('admin');
            setRoles(['admin']);
            setLoading(false);
            return;
          }
          setRole(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        // Build assignment queries (always check cross-business; additionally check scoped when business is selected)
        const rolesQuery = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const driverAnyQuery = supabase
          .from('drivers')
          .select('id, status, business_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        const bikerAnyQuery = supabase
          .from('bikers')
          .select('id, status, business_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        const driverScopedQuery = currentBusinessId
          ? supabase
              .from('drivers')
              .select('id, status, business_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .eq('business_id', currentBusinessId)
              .maybeSingle()
          : null;

        const bikerScopedQuery = currentBusinessId
          ? supabase
              .from('bikers')
              .select('id, status, business_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .eq('business_id', currentBusinessId)
              .maybeSingle()
          : null;

        const emptyResult = { data: null, error: null } as { data: any; error: any };

        const [rolesResult, driverAnyResult, bikerAnyResult, driverScopedResult, bikerScopedResult] =
          await Promise.all([
            rolesQuery,
            driverAnyQuery,
            bikerAnyQuery,
            driverScopedQuery ?? Promise.resolve(emptyResult),
            bikerScopedQuery ?? Promise.resolve(emptyResult),
          ]);

        const driverAny = driverAnyResult.data ?? null;
        const bikerAny = bikerAnyResult.data ?? null;
        const driverScoped = currentBusinessId ? (driverScopedResult.data ?? null) : null;
        const bikerScoped = currentBusinessId ? (bikerScopedResult.data ?? null) : null;

        setDriverAssignmentBusinessId(driverAny?.business_id ?? null);
        setBikerAssignmentBusinessId(bikerAny?.business_id ?? null);

        // Track driver/biker assignments for the current business (when selected), otherwise any business
        const driverAssignedForScope = currentBusinessId ? !!driverScoped : !!driverAny;
        const bikerAssignedForScope = currentBusinessId ? !!bikerScoped : !!bikerAny;
        setIsDriverAssigned(driverAssignedForScope);
        setIsBikerAssigned(bikerAssignedForScope);

        if (isDev) {
          const statusOf = (r: { data: any; error: any }) => (r.error ? 'error' : r.data ? 'assigned' : 'empty');

          console.log('🔐 [RBAC DEBUG] user_roles query:', {
            status: statusOf(rolesResult as any),
            data: rolesResult.data,
            error: rolesResult.error?.message,
          });

          console.log('🔐 [RBAC DEBUG] drivers(any) query:', {
            status: statusOf(driverAnyResult as any),
            data: driverAnyResult.data,
            error: driverAnyResult.error?.message,
          });

          console.log('🔐 [RBAC DEBUG] bikers(any) query:', {
            status: statusOf(bikerAnyResult as any),
            data: bikerAnyResult.data,
            error: bikerAnyResult.error?.message,
          });

          console.log('🔐 [RBAC DEBUG] drivers(scoped) query:', {
            status: statusOf(driverScopedResult as any),
            data: driverScopedResult.data,
            error: driverScopedResult.error?.message,
            currentBusinessId: currentBusinessId ?? 'not set',
          });

          console.log('🔐 [RBAC DEBUG] bikers(scoped) query:', {
            status: statusOf(bikerScopedResult as any),
            data: bikerScopedResult.data,
            error: bikerScopedResult.error?.message,
            currentBusinessId: currentBusinessId ?? 'not set',
          });
        }

        const rolesList: AppRole[] = [];

        // Add roles from user_roles table
        if (rolesResult.data && rolesResult.data.length > 0) {
          rolesResult.data.forEach((r: any) => {
            const normalizedRole = (r.role as string).trim().toLowerCase() as AppRole;
            if (!rolesList.includes(normalizedRole)) {
              rolesList.push(normalizedRole);
            }
          });
        }

        // Add driver role if assigned (scoped when business selected)
        if (driverAssignedForScope && !rolesList.includes('driver')) {
          rolesList.push('driver');
          if (isDev) {
            console.log('🚗 User is an active driver', {
              assignedBusinessId: driverAny?.business_id ?? null,
              currentBusinessId: currentBusinessId ?? null,
            });
          }
        }

        // Add biker role if assigned (scoped when business selected)
        if (bikerAssignedForScope && !rolesList.includes('biker')) {
          rolesList.push('biker');
          if (isDev) {
            console.log('🚴 User is an active biker', {
              assignedBusinessId: bikerAny?.business_id ?? null,
              currentBusinessId: currentBusinessId ?? null,
            });
          }
        }

        if (rolesList.length > 0) {
          setRoles(rolesList);

          // Set primary role (admin takes precedence, then driver, then biker)
          const primaryRole = rolesList.includes('admin')
            ? 'admin'
            : rolesList.includes('driver')
              ? 'driver'
              : rolesList[0];

          setRole(primaryRole);

          if (isDev) {
            console.log('🔐 [RBAC DEBUG] Computed booleans:', {
              isAdmin: rolesList.includes('admin') || rolesList.includes('owner'),
              isDriver: driverAssignedForScope || rolesList.includes('driver'),
              isBiker: bikerAssignedForScope || rolesList.includes('biker'),
            });
            console.log('🔐 [RBAC DEBUG] Final roles:', rolesList, 'Primary:', primaryRole);
          }
        } else if (isDev) {
          // In dev mode with logged-in user but no roles, default to admin
          console.log('🔧 DEV MODE: No roles found, defaulting to admin');
          setRole('admin');
          setRoles(['admin']);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        // In dev mode, still default to admin on error
        if (isDev) {
          console.log('🔧 DEV MODE: Error fetching roles, defaulting to admin');
          setRole('admin');
          setRoles(['admin']);
        } else {
          setRole(null);
          setRoles([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUserRole();

    // Listen for role changes
    const channel = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        () => {
          fetchUserRole();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
        },
        () => {
          fetchUserRole();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bikers',
        },
        () => {
          fetchUserRole();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentBusinessId]);

  const hasRole = (checkRole: AppRole): boolean => {
    return roles.includes(checkRole);
  };

  const isAdmin = (): boolean => {
    // In dev mode, always return true for admin check
    if (isDev && loading) return true;
    return roles.includes('admin') || roles.includes('owner');
  };

  const isDriver = (): boolean => {
    return isDriverAssigned || roles.includes('driver');
  };

  const isBiker = (): boolean => {
    return isBikerAssigned || roles.includes('biker');
  };

  return { role, roles, loading, hasRole, isAdmin, isDriver, isBiker, isDriverAssigned, isBikerAssigned, driverAssignmentBusinessId, bikerAssignmentBusinessId };
}
