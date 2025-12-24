import { ReactNode } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';
import { Lock, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallbackPath?: string;
  readOnly?: boolean;
  showLocked?: boolean;
}

// Elevated roles that can access most pages
const ELEVATED_ROLES: AppRole[] = ['admin', 'owner', 'employee'];

/**
 * RequireRole - Route protection component for Grabba Skyscraper
 * Wraps routes to enforce role-based access control
 * 
 * Important: Admin, Owner, and Ops Manager can access ALL pages
 */
export function RequireRole({ 
  children, 
  allowedRoles, 
  fallbackPath = '/',
  readOnly = false,
  showLocked = false
}: RequireRoleProps) {
  const { role, roles, loading, isAdmin, isDriver, isBiker } = useUserRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Check if user has any elevated role (always allowed)
  const hasElevatedAccess = roles.some(r => ELEVATED_ROLES.includes(r)) || isAdmin();
  
  // Check if user has any of the allowed roles
  const hasDirectAccess = role && allowedRoles.includes(role);
  const hasAnyAllowedRole = roles.some(r => allowedRoles.includes(r));
  
  // Special check for driver/biker pages based on assignment
  const isDriverPage = allowedRoles.includes('driver');
  const isBikerPage = allowedRoles.includes('biker');
  const hasDriverAccess = isDriverPage && isDriver();
  const hasBikerAccess = isBikerPage && isBiker();

  const hasAccess = hasElevatedAccess || hasDirectAccess || hasAnyAllowedRole || hasDriverAccess || hasBikerAccess;

  if (!hasAccess) {
    if (showLocked) {
      // Determine what type of assignment is needed
      const needsDriverAssignment = isDriverPage && !isDriver();
      const needsBikerAssignment = isBikerPage && !isBiker();
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md p-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground">
              {needsDriverAssignment 
                ? "You are not assigned as a Driver. Contact an administrator to be assigned as a driver."
                : needsBikerAssignment
                ? "You are not assigned as a Biker. Contact an administrator to be assigned as a biker."
                : "You don't have permission to access this area. Contact an administrator if you believe this is an error."
              }
            </p>
            <p className="text-xs text-muted-foreground/60">
              Required: {allowedRoles.join(' or ')} | Your roles: {roles.join(', ') || 'none'}
            </p>
            {(needsDriverAssignment || needsBikerAssignment) && isAdmin() && (
              <Button asChild variant="outline" className="mt-4">
                <Link to={needsDriverAssignment ? '/delivery/drivers' : '/delivery/bikers'}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage {needsDriverAssignment ? 'Drivers' : 'Bikers'}
                </Link>
              </Button>
            )}
          </div>
        </div>
      );
    }
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // For read-only mode, wrap children with context
  if (readOnly) {
    return (
      <ReadOnlyContext.Provider value={true}>
        {children}
      </ReadOnlyContext.Provider>
    );
  }

  return <>{children}</>;
}

// Context for read-only mode
import { createContext, useContext } from 'react';

const ReadOnlyContext = createContext(false);

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

export default RequireRole;
