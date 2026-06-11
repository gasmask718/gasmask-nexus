import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ensureBikerRecord, ensureDriverRecord } from '@/services/roleService';
import { Loader2, ShieldAlert } from 'lucide-react';

interface PortalAuthGuardProps {
  children: ReactNode;
  allowedRoles: ('driver' | 'biker')[];
  portalType: 'driver' | 'biker';
}

/**
 * Operational Portal Auth Guard
 * - Enforces strict role isolation for driver/biker portals
 * - Checks BOTH user_profiles.primary_role AND user_roles table (system roles)
 * - Logs all portal access attempts for audit
 * - Blocks access if role doesn't match
 */
export function PortalAuthGuard({ children, allowedRoles, portalType }: PortalAuthGuardProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();
  const { roles: systemRoles, loading: rolesLoading } = useUserRole();
  const healedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/portal/${portalType}/login`, { replace: true });
    }
  }, [user, authLoading, navigate, portalType]);

  // Auto-heal: ensure operational record exists for biker/driver
  useEffect(() => {
    if (user && !healedRef.current) {
      healedRef.current = true;
      const role = ((profileData?.profile as any)?.role || profileData?.profile?.primary_role) as string | undefined;
      if (role === 'biker' || portalType === 'biker') {
        ensureBikerRecord(user.id);
      } else if (role === 'driver' || portalType === 'driver') {
        ensureDriverRecord(user.id);
      }
    }
  }, [user, profileData, portalType]);

  // Log portal access for audit + fire session-start location signal
  useEffect(() => {
    if (user) {
      const roleValue = (profileData?.profile as any)?.role || profileData?.profile?.primary_role;
      supabase.from('portal_audit_log').insert([{
        user_id: user.id,
        portal_type: portalType,
        action_type: 'portal_access',
        metadata: { role: String(roleValue || 'unknown') }
      }]).then(() => {});

      if (portalType === 'biker' || portalType === 'driver') {
        supabase.from('location_events').insert({
          user_id: user.id,
          event_type: 'gps_ping' as any,
          lat: 0,
          lng: 0,
        }).then(() => {});
      }
    }
  }, [user, profileData, portalType]);

  if (authLoading || profileLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Source of truth = user_roles (systemRoles). Profile is optional — many
  // field users (drivers/bikers) are assigned roles via admin UI without ever
  // having a user_profiles row written. Don't block on a missing profile.
  const userRole = ((profileData?.profile as any)?.role || profileData?.profile?.primary_role || '') as string;

  const isElevated = ['owner', 'admin', 'ceo', 'va'].includes(userRole) ||
                     systemRoles.some(r => ['owner', 'admin', 'ceo'].includes(r));

  const hasProfileAccess = !!userRole && allowedRoles.includes(userRole as 'driver' | 'biker');
  const hasSystemRoleAccess = systemRoles.some(r => allowedRoles.includes(r as 'driver' | 'biker'));
  const hasAccess = isElevated || hasProfileAccess || hasSystemRoleAccess;

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access the {portalType} portal.
            Your role: <strong>{userRole}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
