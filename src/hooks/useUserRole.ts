import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/utils/roleRouting';

export function useUserRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
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
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
        setRoles([]);
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
    return roles.includes('admin');
  };

  return { role, roles, loading, hasRole, isAdmin };
}
