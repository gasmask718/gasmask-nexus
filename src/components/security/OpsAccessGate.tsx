import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePortalDevice } from '@/hooks/usePortalDevice';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OPS_ROLES = ['driver', 'biker', 'ambassador', 'influencer', 'store', 'store_owner', 'wholesaler', 'customer', 'production', 'owner', 'admin', 'ceo', 'va', 'manager', 'accountant', 'csr', 'dynasty_owner', 'super_admin', 'developer'];

interface OpsAccessGateProps {
  children: React.ReactNode;
}

/**
 * OpsAccessGate — Validates device trust + role for /portal/* access
 * Wraps portal content; blocks access if device is revoked or role is missing
 * Checks BOTH user_profiles.primary_role AND user_roles table
 */
export default function OpsAccessGate({ children }: OpsAccessGateProps) {
  const { user } = useAuth();
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();
  const { roles: systemRoles, loading: rolesLoading } = useUserRole();
  const portalType = (profileData?.profile?.primary_role as 'driver' | 'biker') || 'driver';
  const { device, isLoading: deviceLoading, error: deviceError } = usePortalDevice(portalType);
  const [accessState, setAccessState] = useState<'loading' | 'granted' | 'no_role' | 'device_blocked'>('loading');

  useEffect(() => {
    if (!user || profileLoading || deviceLoading || rolesLoading) {
      setAccessState('loading');
      return;
    }

    // Collect all roles from both user_profiles AND user_roles table
    const allRoles: string[] = [...systemRoles];
    const profileRole = profileData?.profile?.primary_role;
    if (profileRole && !allRoles.includes(profileRole)) {
      allRoles.push(profileRole);
    }

    // Check if user has any ops role from either source
    const hasOpsRole = allRoles.some(r => OPS_ROLES.includes(r));
    if (!hasOpsRole) {
      setAccessState('no_role');
      return;
    }

    // Check device trust
    if (device?.is_revoked) {
      setAccessState('device_blocked');
      return;
    }

    setAccessState('granted');
  }, [user, profileData, profileLoading, systemRoles, rolesLoading, device, deviceLoading]);

  if (accessState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (accessState === 'device_blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Device Not Authorized</h2>
          <p className="text-sm text-muted-foreground">
            This device has been revoked by an administrator. Contact your manager to restore access.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/auth'}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (accessState === 'no_role') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-accent/50 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-accent-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground">
            You don't have an operations role assigned. If you received an invite link, please use it to activate your account.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
