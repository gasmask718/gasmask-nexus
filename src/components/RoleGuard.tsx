import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallbackPath?: string;
}

export default function RoleGuard({ children, allowedRoles, fallbackPath = '/' }: RoleGuardProps) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

interface RoleCheckProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallback?: ReactNode;
  showError?: boolean;
}

export function RoleCheck({ children, allowedRoles, fallback, showError = false }: RoleCheckProps) {
  const { role, loading } = useUserRole();

  if (loading) {
    return null;
  }

  if (!role || !allowedRoles.includes(role)) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
