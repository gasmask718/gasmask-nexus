import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/utils/roleRouting';

// Check if we're in development/preview mode
const isDev = import.meta.env.DEV || window.location.hostname.includes('lovable');

export function useUserRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDriverAssigned, setIsDriverAssigned] = useState(false);
  const [isBikerAssigned, setIsBikerAssigned] = useState(false);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // In dev mode, default to admin for testing
          if (isDev) {
            console.log('🔧 DEV MODE: Defaulting to admin role for preview');
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

        // Fetch roles, driver assignment, and biker assignment in parallel
        const [rolesResult, driverResult, bikerResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id),
          supabase
            .from('drivers')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle(),
          supabase
            .from('bikers')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
        ]);

        // Track driver/biker assignments
        const isDriver = !!driverResult.data;
        const isBiker = !!bikerResult.data;
        setIsDriverAssigned(isDriver);
        setIsBikerAssigned(isBiker);

        // Force admin for the owner account - bypass DB entirely
        if (user?.email?.toLowerCase() === 'gasmaskapprovedllc@gmail.com') {
          console.log('🔐 OWNER DETECTED - Forcing admin role');
          setRole('admin');
          setRoles(['admin', 'owner']);
        } else {
          const rolesList: AppRole[] = [];
          
          // Add roles from user_roles table
          if (rolesResult.data && rolesResult.data.length > 0) {
            rolesResult.data.forEach(r => {
              const normalizedRole = (r.role as string).trim().toLowerCase() as AppRole;
              if (!rolesList.includes(normalizedRole)) {
                rolesList.push(normalizedRole);
              }
            });
          }

          // Add driver role if assigned in drivers table
          if (isDriver && !rolesList.includes('driver')) {
            rolesList.push('driver');
            console.log('🚗 User is an active driver');
          }

          // Add biker role if assigned in bikers table
          if (isBiker && !rolesList.includes('biker')) {
            rolesList.push('biker');
            console.log('🚴 User is an active biker');
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
            
            console.log('👤 User roles loaded:', rolesList, 'Primary:', primaryRole);
          } else if (isDev) {
            // In dev mode with logged-in user but no roles, default to admin
            console.log('🔧 DEV MODE: No roles found, defaulting to admin');
            setRole('admin');
            setRoles(['admin']);
          }
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
  }, []);

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

  return { role, roles, loading, hasRole, isAdmin, isDriver, isBiker, isDriverAssigned, isBikerAssigned };
}
