import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';
import { Lock, Shield } from 'lucide-react';

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallbackPath?: string;
  readOnly?: boolean;
  showLocked?: boolean;
}

/**
 * RequireRole - Route protection component for Grabba Skyscraper
 * Wraps routes to enforce role-based access control
 */
export function RequireRole({ 
  children, 
  allowedRoles, 
  fallbackPath = '/',
  readOnly = false,
  showLocked = false
}: RequireRoleProps) {
  const { role, loading } = useUserRole();
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

  const hasAccess = role && allowedRoles.includes(role);

  if (!hasAccess) {
    if (showLocked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md p-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Access Restricted</h2>
            <p className="text-muted-foreground">
              You don't have permission to access this area. 
              Contact an administrator if you believe this is an error.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Required role: {allowedRoles.join(' or ')}
            </p>
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
