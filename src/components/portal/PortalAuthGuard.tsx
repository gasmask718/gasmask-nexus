import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldAlert } from 'lucide-react';

interface PortalAuthGuardProps {
  children: ReactNode;
  allowedRoles: ('driver' | 'biker')[];
  portalType: 'driver' | 'biker';
}

/**
 * Operational Portal Auth Guard
 * - Enforces strict role isolation for driver/biker portals
 * - Logs all portal access attempts for audit
 * - Blocks access if role doesn't match
 */
export function PortalAuthGuard({ children, allowedRoles, portalType }: PortalAuthGuardProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/portal/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Log portal access for audit
  useEffect(() => {
    if (user && profileData?.profile) {
      supabase.from('portal_audit_log').insert([{
        user_id: user.id,
        portal_type: portalType,
        action_type: 'portal_access',
        metadata: { role: (profileData.profile as any).role || profileData.profile.primary_role }
      }]).then(() => {});
    }
  }, [user, profileData, portalType]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user || !profileData?.profile) {
    return null;
  }

  const userRole = ((profileData.profile as any).role || profileData.profile.primary_role) as string;
  const isElevated = ['owner', 'admin', 'ceo', 'va'].includes(userRole);
  const hasAccess = isElevated || allowedRoles.includes(userRole as 'driver' | 'biker');

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
