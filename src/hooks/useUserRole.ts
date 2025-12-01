import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/utils/roleRouting';

// Check if we're in development/preview mode
const isDev = import.meta.env.DEV || window.location.hostname.includes('lovable');

export function useUserRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

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

        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) throw error;

        // Force admin for the owner account - bypass DB entirely
        if (user?.email?.toLowerCase() === 'gasmaskapprovedllc@gmail.com') {
          console.log('🔐 OWNER DETECTED - Forcing admin role');
          setRole('admin');
          setRoles(['admin']);
        } else if (userRoles && userRoles.length > 0) {
          // Normalize all roles to lowercase
          const rolesList = userRoles.map(r => (r.role as string).trim().toLowerCase() as AppRole);
          
          // Remove duplicates
          const uniqueRoles = Array.from(new Set(rolesList));
          
          setRoles(uniqueRoles);
          
          // Set primary role (admin takes precedence)
          const primaryRole = uniqueRoles.includes('admin') 
            ? 'admin' 
            : uniqueRoles[0];
          
          setRole(primaryRole);
          
          console.log('👤 User roles loaded:', uniqueRoles, 'Primary:', primaryRole);
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
    return roles.includes('admin');
  };

  return { role, roles, loading, hasRole, isAdmin };
}
