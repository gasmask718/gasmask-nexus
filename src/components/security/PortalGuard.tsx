import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  getPortalConfig, 
  getRoleLandingPage, 
  isElevatedRole,
  hasPathAccess,
  type PortalRole 
} from '@/config/portalSidebars';
import { Shield, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * PORTAL GUARD — ROUTE PROTECTION & PORTAL ISOLATION
 * 
 * Implements strict role-based routing per MASTER PROMPT #4:
 * - Users are redirected to their role-specific portal
 * - Users cannot manually navigate to unauthorized portals
 * - All denied access is logged to security audit
 */

interface PortalGuardProps {
  children: ReactNode;
  allowedRoles?: PortalRole[];
  requireElevated?: boolean;
}

export function PortalGuard({ 
  children, 
  allowedRoles,
  requireElevated = false 
}: PortalGuardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, roles, loading, isAdmin } = useUserRole();

  const userRole = role as PortalRole | null;
  const isElevated = userRole ? isElevatedRole(userRole) : false;

  // Log access denial to audit
  const logAccessDenial = async (reason: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from('security_audit_log').insert({
        user_id: user.id,
        event_type: 'route_access_denied',
        event_severity: 'warning',
        resource_type: 'route',
        resource_id: location.pathname,
        action: 'navigate',
        outcome: 'denied',
        details: {
          reason,
          userRole,
          allowedRoles,
          path: location.pathname,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('Failed to log access denial:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Verifying portal access...</p>
        </div>
      </div>
    );
  }

  // No role found
  if (!userRole) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check elevated requirement
  if (requireElevated && !isElevated) {
    logAccessDenial('Elevated role required');
    const landingPage = getRoleLandingPage(userRole);
    return <Navigate to={landingPage} replace />;
  }

  // Check allowed roles if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = roles.some(r => allowedRoles.includes(r as PortalRole)) || isElevated;
    
    if (!hasAllowedRole) {
      logAccessDenial(`Role ${userRole} not in allowed roles: ${allowedRoles.join(', ')}`);
      const landingPage = getRoleLandingPage(userRole);
      return <Navigate to={landingPage} replace />;
    }
  }

  // For non-elevated users, verify path access
  if (!isElevated) {
    const hasAccess = hasPathAccess(userRole, location.pathname);
    
    if (!hasAccess) {
      logAccessDenial(`Path ${location.pathname} not accessible for role ${userRole}`);
      const landingPage = getRoleLandingPage(userRole);
      return <Navigate to={landingPage} replace />;
    }
  }

  return <>{children}</>;
}

/**
 * PORTAL REDIRECT — Redirects users to their role-specific landing page
 */
export function PortalRedirect() {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && role) {
      const landingPage = getRoleLandingPage(role as PortalRole);
      navigate(landingPage, { replace: true });
    }
  }, [role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * ACCESS DENIED PAGE — Shows when user lacks permission
 */
export function AccessDenied({ 
  message = "You don't have permission to access this area.",
  allowedRoles 
}: { 
  message?: string;
  allowedRoles?: PortalRole[];
}) {
  const { role, roles } = useUserRole();
  const landingPage = role ? getRoleLandingPage(role as PortalRole) : '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md p-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground">{message}</p>
        {allowedRoles && (
          <p className="text-xs text-muted-foreground/60">
            Required: {allowedRoles.join(' or ')} | Your role: {role}
          </p>
        )}
        <a 
          href={landingPage}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to My Portal
        </a>
      </div>
    </div>
  );
}

export default PortalGuard;
