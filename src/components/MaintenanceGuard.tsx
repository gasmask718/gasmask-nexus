/**
 * MaintenanceGuard - Checks kill switch and shows maintenance screen
 * Exempts /developer and /auth routes, and admin role holders.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { MaintenanceScreen } from '@/pages/developer/components/MaintenanceScreen';

const EXEMPT_PATHS = ['/developer', '/auth'];

export const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const { role, loading: roleLoading } = useUserRole();
  const location = useLocation();

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('developer_portal_config')
        .select('config_value')
        .eq('config_key', 'maintenance_mode')
        .single();
      setIsLocked((data?.config_value as any)?.enabled === true);
      setChecked(true);
    };
    check();

    const channel = supabase
      .channel('maintenance-guard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'developer_portal_config' }, check)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!checked || roleLoading) return null;

  const isExemptPath = EXEMPT_PATHS.some(p => location.pathname.startsWith(p));
  const isAdmin = role === 'admin' || role === 'owner';

  if (isLocked && !isExemptPath && !isAdmin) {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
};
