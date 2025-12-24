import { ReactNode, createContext, useContext } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useBusinessStore } from '@/stores/businessStore';
import { AppRole } from '@/utils/roleRouting';
import { Lock, Shield, UserPlus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const isDev = import.meta.env.DEV || window.location.hostname.includes('lovable');

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallbackPath?: string;
  readOnly?: boolean;
  showLocked?: boolean;
}

// Elevated roles that ALWAYS bypass access checks
const ELEVATED_ROLES: AppRole[] = ['admin', 'owner', 'employee'];

// Context for read-only mode
const ReadOnlyContext = createContext(false);

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

/**
 * RequireRole - Route protection component for Grabba Skyscraper
 * Wraps routes to enforce role-based access control
 * 
 * Important: Admin, Owner, and Employee can access ALL pages
 */
export function RequireRole({ 
  children, 
  allowedRoles, 
  fallbackPath = '/',
  readOnly = false,
  showLocked = false
}: RequireRoleProps) {
  const { selectedBusiness } = useBusinessStore();
  const currentBusinessId = selectedBusiness?.id;
  
  // Pass business context to role hook for scoped assignment checks
  const { role, roles, loading, isAdmin, isDriver, isBiker, isDriverAssigned, isBikerAssigned } = useUserRole(currentBusinessId);
  const location = useLocation();

  // Show loading state - NEVER deny while loading
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

  // Check if user has any elevated role (ALWAYS allowed)
  const hasElevatedAccess = roles.some(r => ELEVATED_ROLES.includes(r)) || isAdmin();
  
  // Check if user has any of the allowed roles
  const hasDirectAccess = role && allowedRoles.includes(role);
  const hasAnyAllowedRole = roles.some(r => allowedRoles.includes(r));
  
  // Special check for driver/biker pages based on assignment
  const isDriverPage = allowedRoles.includes('driver');
  const isBikerPage = allowedRoles.includes('biker');
  const hasDriverAccess = isDriverPage && isDriver();
  const hasBikerAccess = isBikerPage && isBiker();

  // Determine which rule granted access
  let accessGrantedBy = 'none';
  if (hasElevatedAccess) accessGrantedBy = 'elevated_role';
  else if (hasDirectAccess) accessGrantedBy = 'direct_role';
  else if (hasAnyAllowedRole) accessGrantedBy = 'any_allowed_role';
  else if (hasDriverAccess) accessGrantedBy = 'driver_assignment';
  else if (hasBikerAccess) accessGrantedBy = 'biker_assignment';

  const hasAccess = hasElevatedAccess || hasDirectAccess || hasAnyAllowedRole || hasDriverAccess || hasBikerAccess;

  // DEV: Debug logging
  if (isDev) {
    console.log('🔐 [RequireRole DEBUG]', {
      path: location.pathname,
      allowedRoles,
      currentBusinessId: currentBusinessId ?? 'not set',
      userRoles: roles,
      primaryRole: role,
      isDriverAssigned,
      isBikerAssigned,
      checks: {
        hasElevatedAccess,
        hasDirectAccess,
        hasAnyAllowedRole,
        hasDriverAccess,
        hasBikerAccess
      },
      finalDecision: hasAccess ? `GRANTED (${accessGrantedBy})` : 'DENIED'
    });
  }

  // If no business selected and this is a business-scoped page (driver/biker), show selector
  if (!currentBusinessId && (isDriverPage || isBikerPage) && !hasElevatedAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Select a Business</h2>
          <p className="text-muted-foreground">
            Please select a business to view your driver/biker assignments.
          </p>
          <Button asChild variant="default">
            <Link to="/settings/business">
              Select Business
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
                ? "You are not assigned as a Driver for this business. Contact an administrator to be assigned."
                : needsBikerAssignment
                ? "You are not assigned as a Biker for this business. Contact an administrator to be assigned."
                : "You don't have permission to access this area. Contact an administrator if you believe this is an error."
              }
            </p>
            <p className="text-xs text-muted-foreground/60">
              Required: {allowedRoles.join(' or ')} | Your roles: {roles.join(', ') || 'none'}
              {currentBusinessId && ` | Business: ${currentBusinessId.slice(0,8)}...`}
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

export default RequireRole;
