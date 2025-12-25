import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Role } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

type PortalRole = Role | 'national_wholesale' | 'marketplace_admin';

interface PortalRBACGateProps {
  children: ReactNode;
  allowedRoles: PortalRole[];
  portalName: string;
  fallbackPath?: string;
}

/**
 * RBAC gate specifically for portals
 * - Checks user role from profile
 * - Owner/Admin can access all portals
 * - Shows helpful access setup page if role doesn't match
 */
export function PortalRBACGate({ 
  children, 
  allowedRoles,
  portalName,
  fallbackPath = '/portal/home'
}: PortalRBACGateProps) {
  const { data, isLoading, error } = useCurrentUserProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.profile) {
    return (
      <AccessDeniedPage 
        portalName={portalName}
        reason="profile_error"
        fallbackPath={fallbackPath}
      />
    );
  }

  const userRole = data.profile.primary_role as PortalRole;
  
  // Owner and admin always have access
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Check if user's role is in the allowed list
  if (allowedRoles.includes(userRole)) {
    return <>{children}</>;
  }

  return (
    <AccessDeniedPage 
      portalName={portalName}
      currentRole={userRole}
      requiredRoles={allowedRoles}
      fallbackPath={fallbackPath}
    />
  );
}

interface AccessDeniedPageProps {
  portalName: string;
  reason?: 'profile_error' | 'role_mismatch';
  currentRole?: PortalRole;
  requiredRoles?: PortalRole[];
  fallbackPath: string;
}

function AccessDeniedPage({ 
  portalName, 
  reason = 'role_mismatch',
  currentRole,
  requiredRoles,
  fallbackPath 
}: AccessDeniedPageProps) {
  const formatRole = (role: string) => 
    role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Access Setup Needed</CardTitle>
          <CardDescription>
            {reason === 'profile_error' 
              ? "We couldn't verify your profile. Please try again or contact support."
              : `You don't currently have access to the ${portalName}.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason === 'role_mismatch' && currentRole && requiredRoles && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Your role:</span>
                <span className="font-medium">{formatRole(currentRole)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Required:</span>
                <span className="font-medium">
                  {requiredRoles.map(formatRole).join(' or ')}
                </span>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">
            If you believe you should have access, please contact your administrator 
            to update your role assignment.
          </p>

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to={fallbackPath}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Portal Home
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/portal/onboarding">
                Request Role Change
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PortalRBACGate;
